# syntax=docker/dockerfile:1
# Imagem da API (serve também o frontend-dist). Na raiz do repo: docker build -t aeroscan-api .

FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
# Só manifests: as camadas de install só são refeitas quando as dependências mudam
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

FROM base AS deps
# O mongod do mongodb-memory-server só serve para os testes
ENV MONGOMS_DISABLE_POSTINSTALL=1
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile --filter @aeroscan/api...

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile --prod --filter @aeroscan/api...

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @aeroscan/shared build && pnpm --filter @aeroscan/api build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Mesmo layout do repo: links do pnpm continuam válidos e a API acha ../../frontend-dist
COPY --from=prod-deps --chown=node:node /repo ./
COPY --from=build --chown=node:node /repo/packages/shared/dist packages/shared/dist
COPY --from=build --chown=node:node /repo/apps/api/dist apps/api/dist
COPY --chown=node:node frontend-dist frontend-dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" > /dev/null || exit 1
CMD ["node", "apps/api/dist/main.js"]
