# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=26.5.1
ARG PNPM_VERSION=11.15.1

FROM node:${NODE_VERSION}-alpine AS build

ARG PNPM_VERSION

RUN apk upgrade --no-cache

WORKDIR /usr/src/app
COPY . .
RUN npm install --global pnpm@${PNPM_VERSION}
RUN pnpm install --frozen-lockfile
RUN pnpm run lint
RUN pnpm run build
RUN pnpm prune --prod --ignore-scripts

FROM alpine:3.24 AS production

ARG NODE_VERSION

# Alpine replaces older package revisions; accept updates within the build's Node major.
RUN apk upgrade --no-cache \
    && apk add --no-cache "nodejs-current~${NODE_VERSION%%.*}" \
    && addgroup --system --gid 10001 app \
    && adduser --system --uid 10001 --ingroup app --home /usr/src/app app

WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=build --chown=app:app /usr/src/app/dist ./dist
COPY --from=build --chown=app:app /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=app:app /usr/src/app/package.json ./package.json

EXPOSE 3000
USER app
CMD ["node", "dist/main.js"]
