import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const listar = (token?: string) =>
  POST(
    new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
  );

describe('/api/mcp', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('sin token configurado en el entorno no responde: 503', async () => {
    vi.stubEnv('METEOR_MCP_TOKEN', '');
    expect((await listar('cualquiera')).status).toBe(503);
  });

  it('un token configurado demasiado corto no sirve ni siquiera si coincide', async () => {
    vi.stubEnv('METEOR_MCP_TOKEN', 'corto');
    expect((await listar('corto')).status).toBe(401);
  });

  it('con el token, lista las herramientas', async () => {
    const token = 't'.repeat(48);
    vi.stubEnv('METEOR_MCP_TOKEN', token);
    expect((await listar()).status).toBe(401);
    const res = await listar(token);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('identificar_usuario');
  });
});
