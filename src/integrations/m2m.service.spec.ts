/* Proves that M2mService follows USE_KEYCLOAK. Synthetic values only; no external calls. */
import { createServer, IncomingMessage, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { auth } from 'tc-core-library-js';
import { M2mService } from './m2m.service';

const saved = { ...process.env };
const keycloakEnv = {
  KEYCLOAK_ISSUER: 'https://keycloak.example.test/realms/test',
  KEYCLOAK_AUDIENCE: 'https://api.example.test',
  KEYCLOAK_TOKEN_URL: 'https://keycloak.example.test/m2m/token',
  KEYCLOAK_CLIENT_ID: 'm2m-leave',
  KEYCLOAK_CLIENT_SECRET: 'keycloak-secret',
};
const auth0Config = {
  M2M_AUTH_URL: 'https://tenant.example/oauth/token',
  M2M_AUTH_AUDIENCE: 'https://m2m.example/',
  M2M_AUTH_CLIENT_ID: 'auth0-leave',
  M2M_AUTH_CLIENT_SECRET: 'auth0-secret',
};

/** Build a ConfigService stand-in that reads the given map, honouring fallbacks. */
function configOf(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as never;
}

/** Set the environment for one case; `undefined` deletes a key. */
function setEnv(env: Record<string, string | undefined>) {
  process.env = { ...saved, ...keycloakEnv } as NodeJS.ProcessEnv;
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe('M2mService provider selection (USE_KEYCLOAK)', () => {
  let server: Server | undefined;

  afterEach(async () => {
    process.env = { ...saved };
    jest.restoreAllMocks();
    if (server) await new Promise((resolve) => server!.close(resolve));
    server = undefined;
  });

  it('maps the pre-migration M2M_AUTH_* settings and defaults', () => {
    expect(
      M2mService.auth0Options(
        configOf({ ...auth0Config, M2M_AUTH_PROXY_SERVER_URL: 'https://proxy.example' }),
      ),
    ).toEqual({
      AUTH0_URL: auth0Config.M2M_AUTH_URL,
      AUTH0_AUDIENCE: auth0Config.M2M_AUTH_AUDIENCE,
      AUTH0_PROXY_SERVER_URL: 'https://proxy.example',
      AUTH0_CLIENT_ID: 'auth0-leave',
      AUTH0_CLIENT_SECRET: 'auth0-secret',
    });
    expect(
      M2mService.auth0Options(configOf({ M2M_AUTH_PROXY_SERVER_URL: '' })),
    ).toEqual({
      AUTH0_URL: 'http://localhost:4000/oauth/token',
      AUTH0_AUDIENCE: 'https://m2m.topcoder-dev.com/',
      AUTH0_PROXY_SERVER_URL: undefined,
      AUTH0_CLIENT_ID: undefined,
      AUTH0_CLIENT_SECRET: undefined,
    });
  });

  it('passes the Auth0 options to auth.m2m and requests the default credentials', async () => {
    setEnv({ USE_KEYCLOAK: 'false' });
    const provider = { getMachineToken: jest.fn().mockResolvedValue('token'), clearCache: jest.fn() };
    const m2m = jest.spyOn(auth, 'm2m').mockReturnValue(provider);
    const service = new M2mService(configOf(auth0Config));
    expect(m2m).toHaveBeenCalledWith(M2mService.auth0Options(configOf(auth0Config)));
    await expect(service.getM2MToken()).resolves.toBe('token');
    expect(provider.getMachineToken).toHaveBeenCalledWith();
  });

  it('requests Auth0 tokens from M2M_AUTH_URL with M2M_AUTH_CLIENT_ID when USE_KEYCLOAK=false', async () => {
    const requests: { url?: string; body: Record<string, string> }[] = [];
    server = createServer((req: IncomingMessage, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        requests.push({ url: req.url, body: JSON.parse(body) });
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ access_token: 'auth0-token' }));
      });
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    // An unrelated AUTH0_PROXY_SERVER_URL in the environment must not be used.
    setEnv({ USE_KEYCLOAK: 'false', AUTH0_PROXY_SERVER_URL: `${base}/env-proxy` });
    const config = { ...auth0Config, M2M_AUTH_URL: `${base}/oauth/token` };

    await expect(new M2mService(configOf(config)).getM2MToken()).resolves.toBe('auth0-token');
    await expect(
      new M2mService(
        configOf({ ...config, M2M_AUTH_PROXY_SERVER_URL: `${base}/proxy` }),
      ).getM2MToken(),
    ).resolves.toBe('auth0-token');
    const body = {
      grant_type: 'client_credentials',
      client_id: 'auth0-leave',
      client_secret: 'auth0-secret',
      auth0_url: `${base}/oauth/token`,
      audience: auth0Config.M2M_AUTH_AUDIENCE,
    };
    expect(requests).toEqual([
      { url: '/oauth/token', body },
      { url: '/proxy', body },
    ]);
  });

  it('defaults to Auth0 when USE_KEYCLOAK is unset', async () => {
    setEnv({ USE_KEYCLOAK: undefined });
    await expect(new M2mService(configOf({})).getM2MToken()).rejects.toThrow(
      'AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET are required',
    );
  });

  it('uses only the Keycloak credentials when USE_KEYCLOAK=true', async () => {
    setEnv({ USE_KEYCLOAK: 'true', KEYCLOAK_CLIENT_ID: undefined });
    await expect(new M2mService(configOf(auth0Config)).getM2MToken()).rejects.toThrow(
      'KEYCLOAK_CLIENT_ID and KEYCLOAK_CLIENT_SECRET are required',
    );
  });

  it('fails fast for a USE_KEYCLOAK value other than true or false', () => {
    setEnv({ USE_KEYCLOAK: 'keycloak' });
    expect(() => new M2mService(configOf(auth0Config))).toThrow(TypeError);
  });
});
