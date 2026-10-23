import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { auth } from 'tc-core-library-js';

/**
 * Provides M2M tokens for outbound service calls (Identity role lookups and Bus
 * events) from the provider selected by `USE_KEYCLOAK`, using the shared core cache.
 *
 * With `USE_KEYCLOAK=true` the core uses `KEYCLOAK_TOKEN_URL`, `KEYCLOAK_AUDIENCE`,
 * `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET` and optional `KEYCLOAK_SCOPE`, and
 * ignores the Auth0 options. Unset or `false` uses the pre-migration `M2M_AUTH_*`
 * settings from {@link M2mService.auth0Options}.
 */
@Injectable()
export class M2mService {
  private readonly client: ReturnType<typeof auth.m2m>;

  /**
   * Creates the token provider for the active M2M provider.
   * @param configService Nest configuration holding the `M2M_AUTH_*` settings.
   * @throws TypeError for invalid Keycloak settings or a `USE_KEYCLOAK` value other than `true`/`false`.
   */
  constructor(configService: ConfigService) {
    this.client = auth.m2m(M2mService.auth0Options(configService));
  }

  /**
   * Maps the pre-migration Auth0 settings to the core's Auth0 option names:
   * `M2M_AUTH_URL` (default `http://localhost:4000/oauth/token`), `M2M_AUTH_AUDIENCE`
   * (default `https://m2m.topcoder-dev.com/`), optional `M2M_AUTH_PROXY_SERVER_URL`
   * (requests go to `M2M_AUTH_URL` when it is empty), `M2M_AUTH_CLIENT_ID` and
   * `M2M_AUTH_CLIENT_SECRET`. The core uses them only when `USE_KEYCLOAK` is not true.
   * @param configService Nest configuration to read.
   * @returns Options for `auth.m2m`; missing credentials stay undefined so a token
   * request rejects instead of the service failing to start. Does not throw.
   */
  static auth0Options(
    configService: ConfigService,
  ): Record<string, string | undefined> {
    return {
      AUTH0_URL: configService.get<string>(
        'M2M_AUTH_URL',
        'http://localhost:4000/oauth/token',
      ),
      AUTH0_AUDIENCE: configService.get<string>(
        'M2M_AUTH_AUDIENCE',
        'https://m2m.topcoder-dev.com/',
      ),
      AUTH0_PROXY_SERVER_URL:
        configService.get<string>('M2M_AUTH_PROXY_SERVER_URL') || undefined,
      AUTH0_CLIENT_ID: configService.get<string>('M2M_AUTH_CLIENT_ID'),
      AUTH0_CLIENT_SECRET: configService.get<string>('M2M_AUTH_CLIENT_SECRET'),
    };
  }

  /**
   * Obtains a token from the active provider: `KEYCLOAK_CLIENT_ID`/`SECRET` (and
   * optional `KEYCLOAK_SCOPE`) when `USE_KEYCLOAK=true`, otherwise
   * `M2M_AUTH_CLIENT_ID`/`M2M_AUTH_CLIENT_SECRET` against Auth0.
   * Takes no parameters; used by downstream integration clients.
   * @returns An access token (Keycloak tokens are verified and unexpired).
   * @throws Error for missing configuration or failed issuance/validation; a Keycloak
   * failure never falls back to Auth0.
   */
  getM2MToken(): Promise<string> {
    return this.client.getMachineToken();
  }
}
