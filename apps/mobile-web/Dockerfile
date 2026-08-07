FROM node:22.20.0-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /workspace

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/mobile-web/package.json apps/mobile-web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile --filter @arcmind/mobile-web...

COPY docs/contracts/openapi/phase-1.yaml docs/contracts/openapi/phase-1.yaml
COPY packages/contracts packages/contracts
COPY apps/mobile-web apps/mobile-web
RUN pnpm contracts:generate && pnpm --filter @arcmind/mobile-web build

FROM caddy:2.11.4-alpine
COPY apps/mobile-web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /workspace/apps/mobile-web/dist /srv
EXPOSE 8080
