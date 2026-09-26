FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/auth/package.json ./apps/auth/

# Source is bind-mounted by docker-compose.dev.yaml; only dependencies are baked in.
FROM base AS dev
RUN pnpm install --frozen-lockfile --filter auth...
COPY tsconfig.base.json ./
WORKDIR /app/apps/auth
EXPOSE 3000
CMD ["pnpm", "start:dev"]

FROM base AS build
RUN pnpm install --frozen-lockfile --filter auth...
COPY tsconfig.base.json ./
COPY apps/auth ./apps/auth
RUN pnpm --filter auth build

FROM base AS runtime
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod --filter auth...
COPY --from=build /app/apps/auth/dist ./apps/auth/dist
WORKDIR /app/apps/auth
EXPOSE 3000
CMD ["node", "dist/main"]
