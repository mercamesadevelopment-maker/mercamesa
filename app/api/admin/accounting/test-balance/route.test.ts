import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Sin base ni sesión: el permiso y el historial se simulan; Siigo, con `fetch`.
const saveBalanceReport = vi.fn(async (_service: unknown, req: any, result: any) => ({
  id: 'r1',
  kind: req.kind,
  fileUrl: result.file_url,
}));
vi.mock('@/lib/accounting/route-helpers', () => ({
  accountingAuth: async () => ({ service: {}, userId: 'u1' }),
  serverError: (_w: string, e: unknown) => new Response(JSON.stringify({ error: String(e) }), { status: 500 }),
}));
vi.mock('@/lib/accounting/test-balance', () => ({
  saveBalanceReport: (...args: unknown[]) => saveBalanceReport(...(args as [unknown, unknown, unknown])),
  listBalanceReports: async () => [],
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const pedir = async (body: unknown) => {
  const { POST } = await import('./route');
  const res = await POST(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

const valido = { year: 2026, month_start: 1, month_end: 12 };

describe('POST /api/admin/accounting/test-balance', () => {
  let siigo: (path: string) => Response;

  beforeEach(() => {
    vi.resetModules();
    saveBalanceReport.mockClear();
    vi.stubEnv('SIIGO_USERNAME', 'usuario');
    vi.stubEnv('SIIGO_ACCESS_KEY', 'llave');
    vi.stubEnv('SIIGO_API_URL', 'https://siigo.prueba');
    siigo = () => json(201, { file_id: 'f1', file_url: 'https://blob.prueba/balance.xlsx' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (url.endsWith('/auth') ? json(200, { access_token: 't', expires_in: 3600 }) : siigo(url)))
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('genera el general y lo guarda en el historial', async () => {
    const r = await pedir(valido);
    expect(r.status).toBe(201);
    expect(r.body.data).toEqual({ id: 'r1', kind: 'general', fileUrl: 'https://blob.prueba/balance.xlsx' });
    expect(saveBalanceReport).toHaveBeenCalledOnce();
  });

  it('por tercero va al endpoint de terceros', async () => {
    const llamadas: string[] = [];
    siigo = (url) => (llamadas.push(url), json(201, { file_id: 'f2', file_url: 'https://blob.prueba/t.xlsx' }));
    const r = await pedir({ ...valido, kind: 'third_party', identification: '71385915' });
    expect(r.status).toBe(201);
    expect(llamadas).toEqual(['https://siigo.prueba/v1/test-balance-report-by-thirdparty']);
  });

  it('valida antes de llamar a Siigo (400)', async () => {
    const r = await pedir({ ...valido, month_start: 5, month_end: 2 });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('mes inicial');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sin credenciales de Siigo responde 503 con un código para la pantalla', async () => {
    vi.stubEnv('SIIGO_ACCESS_KEY', '');
    const r = await pedir(valido);
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('siigo_not_configured');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('si Siigo rechaza los datos, muestra su mensaje (422)', async () => {
    siigo = () => json(400, { Errors: [{ Code: 'invalid_account', Message: 'La cuenta 9999 no existe' }] });
    const r = await pedir({ ...valido, account_start: '9999' });
    expect(r.status).toBe(422);
    expect(r.body.error).toBe('Siigo no pudo generar el balance: La cuenta 9999 no existe');
    expect(saveBalanceReport).not.toHaveBeenCalled();
  });

  it('si Siigo falla o no responde, 502 sin guardar nada', async () => {
    siigo = () => json(500, { error: 'boom' });
    expect((await pedir(valido)).status).toBe(502);
    siigo = () => {
      throw new TypeError('fetch failed');
    };
    expect((await pedir(valido)).status).toBe(502);
    expect(saveBalanceReport).not.toHaveBeenCalled();
  });

  it('un enlace que no es https no se guarda (502)', async () => {
    siigo = () => json(201, { file_id: 'f3', file_url: 'javascript:alert(1)' });
    const r = await pedir(valido);
    expect(r.status).toBe(502);
    expect(saveBalanceReport).not.toHaveBeenCalled();
  });
});
