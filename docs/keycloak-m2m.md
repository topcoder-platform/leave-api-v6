# Keycloak M2M migration branch

This code is isolated on `keycloak_m2M`. Do not deploy this branch until the
workload and its callers are ready. Existing DEV services continue using Auth0.
The core dependency is pinned to a reviewed Keycloak prerelease commit, including
transitive wrapper uses through the pnpm override. No npm latest dependency is used.
`pnpm-lock.yaml` resolves a single 4.0.0-keycloak.2 (core commit `112d54a`).

## Provider switch: `USE_KEYCLOAK`

`USE_KEYCLOAK=true` makes this service get its M2M tokens (Identity role lookups and
Bus events, both through `M2mService`) from Keycloak, using `KEYCLOAK_TOKEN_URL`,
`KEYCLOAK_AUDIENCE`, `KEYCLOAK_CLIENT_ID` and `KEYCLOAK_CLIENT_SECRET` (optional
`KEYCLOAK_SCOPE` narrows the client's defaults). `KEYCLOAK_ISSUER` is also required.
Unset or `false` restores the Auth0 behaviour from before the migration: `M2M_AUTH_URL`
(default `http://localhost:4000/oauth/token`), `M2M_AUTH_AUDIENCE` (default
`https://m2m.topcoder-dev.com/`), optional `M2M_AUTH_PROXY_SERVER_URL` (requests go
straight to `M2M_AUTH_URL` when it is empty), `M2M_AUTH_CLIENT_ID` and
`M2M_AUTH_CLIENT_SECRET`.

`tc-core-library-js` reads the flag (`auth.useKeycloak`), so the service and the core
always agree. Any value other than `true`/`false` fails at startup. In DEV the flag is
`/config/common/global-appvar/USE_KEYCLOAK`; the CircleCI deploy loads that path, so no
deployment file change is needed.

Incoming machine tokens: leave routes continue to reject machines in both modes. The
shared validator still classifies them: with `true`, Keycloak tokens, plus Auth0 tokens
while `LEGACY_M2M_ISSUERS`/`LEGACY_M2M_AUDIENCE` are set; with `false`, Auth0 tokens
through `LEGACY_M2M_*`, plus Keycloak tokens while `KEYCLOAK_ISSUER` and
`KEYCLOAK_AUDIENCE` are set.

**Rollback:** set `USE_KEYCLOAK=false` and force a new deployment so tasks re-read SSM.
No code or dependency change is needed. Keep the Auth0 settings above in SSM until
Keycloak has been accepted.

The DEV issuer is `https://keycloak.topcoder-dev.com/realms/topcoder-m2m-dev`,
audience `https://api.topcoder-dev.com`, and managed endpoint
`https://keycloak.topcoder-dev.com/m2m/token`. The managed endpoint passed DEV deployment acceptance on 21 October 2026.

Member sessions remain Auth0. Keep `VALID_ISSUERS` and `AUTH_SECRET` where legacy
member HMAC tokens are supported. Set `AUTH_USER_AUDIENCES` to a JSON array, or
explicitly retain existing user-token audience behavior with
`ALLOW_LEGACY_USER_AUDIENCE=true`. Never apply that exception to M2M tokens.
`LEGACY_M2M_ISSUERS` and `LEGACY_M2M_AUDIENCE` let Auth0 machine tokens pass the same
normalizer (see the provider switch above).

`tc-core-library-js` owns signature, issuer, audience, lifetime, and machine/user
classification. Service adapters must use its verified `kind`, `isMachine`, and
`scopes` rather than decode/reclassify claims. Scope guards delegate exact matching
to the library with explicit all/any policy. Existing business roles and documented
scope aliases remain endpoint policy; adding OAuth scopes to a user token never
grants machine access. No permissive fallback or synthetic token path is available.

Before rollout run this project's `nvm use`, `pnpm lint`, `pnpm build`, and targeted
authentication tests. Validate real authorized/unauthorized routes with both a
Keycloak service token and a member token, including wrong audiences and insufficient
scopes. Switch only after every downstream receiver accepts the issuer. The core never
retries a failed Keycloak request against Auth0; rolling back is the explicit
`USE_KEYCLOAK=false` change above.


Run `pnpm test:keycloak` after building to exercise the compiled HTTP adapter with
synthetic signed member tokens, forged machine claims, and invalid signatures.

Validation on 21 October 2026: Lint/build and three compiled authentication checks pass. The pre-existing Jest script finds no tests; use pnpm test:keycloak for the added checks. Leave routes continue to reject inbound machines; outbound role lookups use Keycloak.
With the `USE_KEYCLOAK` switch, `pnpm test` runs `src/integrations/m2m.service.spec.ts`,
which covers both providers (including the Auth0 endpoint and credentials).
