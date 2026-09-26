FROM node:22-alpine AS deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile --filter frontend...
COPY tsconfig.base.json ./

# Source is bind-mounted by docker-compose.dev.yaml; only dependencies are baked in.
FROM deps AS dev
WORKDIR /app/apps/frontend
EXPOSE 4200
CMD ["pnpm", "exec", "ng", "serve", "--host", "0.0.0.0", "--poll", "1000", "--proxy-config", "proxy.conf.mjs"]

FROM deps AS build
ARG BUILD_CONFIGURATION=production
COPY apps/frontend ./apps/frontend
RUN pnpm --filter frontend build --configuration "$BUILD_CONFIGURATION"

FROM nginx:alpine AS runtime
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
