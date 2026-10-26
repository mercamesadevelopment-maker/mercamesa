import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const respuesta = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('balance.service', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // El token de Siigo se guarda en memoria del módulo: cada prueba lo carga de cero.
    vi.resetModules();
    vi.stubEnv('SIIGO_USERNAME', 'usuario');
    vi.stubEnv('SIIGO_ACCESS_KEY', 'llave');
    vi.stubEnv('SIIGO_PARTNER_ID', 'MercaMesa');
    vi.stubEnv('SIIGO_API_URL', 'https://siigo.prueba');
    fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/auth')
        ? respuesta(200, { access_token: 'tok', expires_in: 86400 })
        : respuesta(201, { file_id: 'f1', file_url: 'https://blob/b.xlsx' })
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const payload = {
    year: 2026,
    month_start: 1,
    month_end: 12,
    includes_tax_difference: false,
    customer: { identification: '123', branch_office: 0 },
  };

  it('el general va a /v1/test-balance-report sin el tercero, con token y Partner-Id', async () => {
    const { generateTestBalance } = await import('./balance.service');
    await expect(generateTestBalance(payload)).resolves.toEqual({ file_id: 'f1', file_url: 'https://blob/b.xlsx' });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://siigo.prueba/v1/test-balance-report');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ year: 2026, month_start: 1, month_end: 12, includes_tax_difference: false });
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'Partner-Id': 'MercaMesa' });
  });

  it('por tercero va a /v1/test-balance-report-by-thirdparty con el customer', async () => {
    const { generateTestBalanceByThirdParty } = await import('./balance.service');
    await generateTestBalanceByThirdParty(payload);

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://siigo.prueba/v1/test-balance-report-by-thirdparty');
    expect(JSON.parse(init.body).customer).toEqual({ identification: '123', branch_office: 0 });
  });

  it('un rechazo de Siigo sale como error con su estado y mensaje', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/auth')
        ? respuesta(200, { access_token: 'tok', expires_in: 86400 })
        : respuesta(400, { Errors: [{ Message: 'La cuenta no existe' }] })
    );
    const { generateTestBalance } = await import('./balance.service');
    await expect(generateTestBalance(payload)).rejects.toThrow(/\(400\).*La cuenta no existe/);
  });

  it('sabe si el entorno tiene credenciales', async () => {
    const { isSiigoConfigured } = await import('./balance.service');
    expect(isSiigoConfigured()).toBe(true);
    vi.stubEnv('SIIGO_ACCESS_KEY', '');
    expect(isSiigoConfigured()).toBe(false);
  });
});
