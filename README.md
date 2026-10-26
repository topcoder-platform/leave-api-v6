## Description

Simple service used for the leave-tracker.topcoder.com app that staff and contractors use to set their leave dates during the year.

## Development runtime

Use Node.js 26.5.0 and pnpm 11.15.1. Run `nvm use` in this project before running pnpm commands.

## Deployment

* Set the DATABASE_URL and run the app using `pnpm start:dev`

## Scheduled Jobs

* Monthly reminder email: runs at 00:00 UTC on the last day of each month.
* Daily Slack summary: runs at 00:00 UTC every weekday (Mon-Fri).

## Configuration

Required:
* `DATABASE_URL`
* `BUS_API_URL` (or `BUSAPI_URL`) for the Topcoder Bus API endpoint.
* `IDENTITY_API_URL` (base URL for Identity API, e.g. `https://api.topcoder-dev.com/v6`).
* `SENDGRID_LEAVE_REMINDER_TEMPLATE_ID` (Sendgrid template for monthly reminders).
* `M2M_AUTH_URL`, `M2M_AUTH_AUDIENCE`, `M2M_AUTH_CLIENT_ID`, `M2M_AUTH_CLIENT_SECRET` (M2M credentials with `read:roles` scope).

Optional:
* `M2M_AUTH_PROXY_SERVER_URL`
* `IDENTITY_ROLE_MEMBER_PAGE_SIZE` (default 200)
* `LEAVE_REMINDER_MONTH_OFFSET` (default 1 to target next month)
* `LEAVE_REMINDER_TO_EMAIL` (default `no-reply@topcoder.com`; used as visible `To` while staff recipients are sent via BCC)
* `SLACK_BOT_KEY`, `SLACK_CHANNEL_ID` (Slack notifications)
* `ENV_NAME` (Slack prefix label; prefix suppressed when `ENV_NAME` is `PROD`/`PRODUCTION`, or when `NODE_ENV` is production and `ENV_NAME` is unset)

## Shared authentication and bus client (v6 refresh)

This branch uses `tc-core-library-js` **4.0.0-rc.1**. Use its named
`createJwtVerifier` / `createJwtAuthenticator`, `createM2MClient`, and
`createBusApiClient` exports for shared authentication and bus API publishing.
Service-specific roles, scopes, sessions and ownership checks remain in this service.
The former bus wrapper dependency and local JWT cryptography must not be reintroduced.

RSA verification requires an exact configured issuer and audience (`JWT_AUDIENCE`
for client tokens, `AUTH0_AUDIENCE` for machine/API tokens, or this service's explicit
issuer-policy settings). HMAC secrets must be at least 32 bytes; no default secret
is supplied. Expiry is enforced. Machine identity comes from the shared verifier,
not the presence of scopes. Supply real development credentials through the service's
existing environment configuration before deployment.

Bus publishers use `createBusApiClient(config).postEvent(event)` with the existing
event envelope and optional key. Configure `BUSAPI_URL` for v6 and the existing
OAuth credentials/token provider. The client uses bounded HTTPS requests and does
not retry POSTs automatically. Application retry/outbox behavior remains local.

See the [core migration guide](https://github.com/topcoder-platform/tc-core-library-js/blob/v4.0.0-rc.1/MIGRATION.md)
for the API mapping, compatibility requirements, and rollout scope.
