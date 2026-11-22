import { describe, expect, it } from 'vitest';
import { isRepeatedCaseMessage, matchItems, pickPart, reasonsCatalog, whoHandles } from './cases';
import { downloadChatPhoto, isAllowedMediaUrl, photoTypeOf } from './media';
import { getPqrsReason } from '@/lib/pqrs/reasons';

describe('registrar_caso: la parte del pedido', () => {
  const partes = [
    { id: 'a', code: 'MM-2026-000010-1', storeName: 'Carnes' },
    { id: 'b', code: 'MM-2026-000010-2', storeName: 'Quesos' },
  ];

  it('con el código de la parte, esa; con el del pedido de una sola tienda, la única', () => {
    expect(pickPart('mm-2026-000010-2', partes)).toEqual({ ok: true, part: partes[1] });
    expect(pickPart('MM-2026-000011', [partes[0]])).toEqual({ ok: true, part: partes[0] });
  });

  it('con el del pedido de varias tiendas, pide cuál; sin partes, no existe', () => {
    const r = pickPart('MM-2026-000010', partes);
    expect(r.ok).toBe(false);
    expect('message' in r && r.message).toMatch(/MM-2026-000010-1 \(Carnes\), MM-2026-000010-2 \(Quesos\)/);
    expect(pickPart('MM-2026-000099', [])).toEqual({ ok: false, message: 'No encontramos ese pedido.' });
  });
});

describe('registrar_caso: los productos por su nombre', () => {
  const lineas = [
    { id: 'l1', name: 'Pechuga de pollo', quantity: 2 },
    { id: 'l2', name: 'Pollo entero', quantity: 1 },
    { id: 'l3', name: 'Aguacate Hass', quantity: 3 },
  ];

  it('exacto sin tildes, o el único que lo contiene; sin cantidad, la de la línea', () => {
    expect(matchItems(lineas, [{ producto: 'aguacate' }, { producto: 'POLLO ENTERO', cantidad: 1 }])).toEqual({
      ok: true,
      items: [
        { orderItemId: 'l3', quantity: 3 },
        { orderItemId: 'l2', quantity: 1 },
      ],
    });
  });

  it('si coincide con varios pide cuál, y si no está dice qué hay', () => {
    expect(matchItems(lineas, [{ producto: 'pollo' }])).toMatchObject({ ok: false, message: expect.stringMatching(/varios/) });
    expect(matchItems(lineas, [{ producto: 'arroz' }])).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Pechuga de pollo, Pollo entero, Aguacate Hass/),
    });
  });
});

describe('registrar_caso: quién atiende', () => {
  it('la tienda primero en un reclamo con pedido; si no, MercaMesa', () => {
    expect(whoHandles(getPqrsReason('producto_faltante')!, true, 24)).toMatch(/tienda, que tiene 24 horas/);
    expect(whoHandles(getPqrsReason('sugerencia')!, false, 24)).toBe('Lo atiende el equipo de MercaMesa.');
  });

  it('la lista de motivos dice para quién es cada uno y qué pide', () => {
    expect(reasonsCatalog()).toMatch(/producto_mal_estado \(comprador; pide pedido, productos, foto\)/);
    expect(reasonsCatalog()).toMatch(/bloquear_comprador \(tendero/);
  });
});

describe('fotos del chat', () => {
  const hosts = ['media.meteor.example'];

  it('solo https, del dominio permitido o un subdominio, sin usuario ni puerto', () => {
    expect(isAllowedMediaUrl('https://media.meteor.example/f/1.jpg', hosts)).toBe(true);
    expect(isAllowedMediaUrl('https://cdn.media.meteor.example/f/1.jpg', hosts)).toBe(true);
    expect(isAllowedMediaUrl('http://media.meteor.example/f/1.jpg', hosts)).toBe(false);
    expect(isAllowedMediaUrl('https://media.meteor.example.evil.com/1.jpg', hosts)).toBe(false);
    expect(isAllowedMediaUrl('https://evilmedia.meteor.example.com/1.jpg', hosts)).toBe(false);
    expect(isAllowedMediaUrl('https://u:p@media.meteor.example/1.jpg', hosts)).toBe(false);
    expect(isAllowedMediaUrl('https://media.meteor.example:8443/1.jpg', hosts)).toBe(false);
    expect(isAllowedMediaUrl('https://169.254.169.254/latest', hosts)).toBe(false);
    expect(isAllowedMediaUrl('no es url', hosts)).toBe(false);
    expect(isAllowedMediaUrl('https://media.meteor.example/1.jpg', [])).toBe(false);
  });

  it('el tipo de la respuesta: solo JPG, PNG o WebP', () => {
    expect(photoTypeOf('image/jpeg; charset=binary')).toBe('image/jpeg');
    expect(photoTypeOf('IMAGE/PNG')).toBe('image/png');
    expect(photoTypeOf('image/svg+xml')).toBeNull();
    expect(photoTypeOf(null)).toBeNull();
  });
});

describe('fotos del chat: la descarga', () => {
  // El enlace de Meteor redirige a una URL firmada de su almacenamiento.
  const hosts = ['api.met.meteor.com.co', 'cxabyznqncjjnxaerssj.supabase.co'];
  const ENLACE = 'https://api.met.meteor.com.co/api/v1/f/abc';
  const FIRMADA = 'https://cxabyznqncjjnxaerssj.supabase.co/storage/v1/object/sign/x?token=t';
  const foto = (bytes: number, headers: Record<string, string> = {}) =>
    new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': 'image/jpeg', ...headers } });
  const redirige = (a: string) => new Response(null, { status: 302, headers: { location: a } });
  const servidor = (rutas: Record<string, () => Response>) => {
    const pedidas: string[] = [];
    const impl = (async (url: string, init: RequestInit) => {
      expect(init.redirect).toBe('manual');
      pedidas.push(url);
      const r = rutas[url];
      if (!r) throw new Error(`no debía pedir ${url}`);
      return r();
    }) as unknown as typeof fetch;
    return { impl, pedidas };
  };

  it('sigue la redirección a la URL firmada y valida el tipo por la respuesta', async () => {
    const s = servidor({ [ENLACE]: () => redirige(FIRMADA), [FIRMADA]: () => foto(1000) });
    const r = await downloadChatPhoto(ENLACE, hosts, s.impl);
    expect(r.type).toBe('image/jpeg');
    expect(r.bytes.byteLength).toBe(1000);
    expect(s.pedidas).toEqual([ENLACE, FIRMADA]);
  });

  it('no sigue una redirección a un dominio que no está en la lista', async () => {
    const s = servidor({ [ENLACE]: () => redirige('https://169.254.169.254/latest/meta-data') });
    await expect(downloadChatPhoto(ENLACE, hosts, s.impl)).rejects.toThrow(/no viene del almacenamiento de Meteor/);
    expect(s.pedidas).toEqual([ENLACE]);
  });

  it('ni a http, ni más de dos saltos', async () => {
    const http = servidor({ [ENLACE]: () => redirige('http://cxabyznqncjjnxaerssj.supabase.co/x') });
    await expect(downloadChatPhoto(ENLACE, hosts, http.impl)).rejects.toThrow(/no viene del almacenamiento/);
    const bucle = servidor({ [ENLACE]: () => redirige(ENLACE) });
    await expect(downloadChatPhoto(ENLACE, hosts, bucle.impl)).rejects.toThrow(/No se pudo descargar/);
    expect(bucle.pedidas).toHaveLength(3);
  });

  it('corta una foto de más de 8 MB aunque no diga su tamaño', async () => {
    const s = servidor({ [FIRMADA]: () => foto(8 * 1024 * 1024 + 1) });
    await expect(downloadChatPhoto(FIRMADA, hosts, s.impl)).rejects.toThrow(/8 MB/);
  });

  it('lo que no es JPG, PNG o WebP no entra, termine como termine la URL', async () => {
    const s = servidor({ [FIRMADA]: () => foto(10, { 'content-type': 'text/html' }) });
    await expect(downloadChatPhoto(FIRMADA, hosts, s.impl)).rejects.toThrow(/JPG, PNG o WebP/);
  });
});

describe('agregar_a_caso: el reintento', () => {
  // Un mensaje ya guardado: de «u1», en el caso «propio», con la clave «clave-0001».
  const guardado = { pqrs_id: 'propio', author_id: 'u1', client_idempotency_key: 'clave-0001' };
  const service = () => {
    const filtros: Record<string, string> = {};
    const query: any = {
      select: () => query,
      eq: (columna: string, valor: string) => ((filtros[columna] = valor), query),
      maybeSingle: async () => ({
        data: Object.entries(filtros).every(([c, v]) => (guardado as any)[c] === v) ? { id: 'm1' } : null,
        error: null,
      }),
    };
    return { from: () => query } as any;
  };

  it('la misma clave en el mismo caso es un reintento', async () => {
    expect(await isRepeatedCaseMessage(service(), { caseId: 'propio', authorId: 'u1', key: 'clave-0001' })).toBe(true);
  });

  it('una clave propia con el código de otro caso no lo devuelve', async () => {
    // Antes se buscaba solo por persona y clave, y respondía con el caso ajeno.
    expect(await isRepeatedCaseMessage(service(), { caseId: 'ajeno', authorId: 'u1', key: 'clave-0001' })).toBe(false);
  });
});
