## Description

Simple service used for the leave-tracker.topcoder.com app that staff and contractors use to set their leave dates during the year.

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
* `SLACK_BOT_KEY`, `SLACK_CHANNEL_ID` (Slack notifications)
* `ENV_NAME` (Slack prefix label; prefix suppressed when `ENV_NAME` is `PROD`/`PRODUCTION`, or when `NODE_ENV` is production and `ENV_NAME` is unset)
