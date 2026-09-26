FROM node:22-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile --filter frontend...
COPY tsconfig.base.json ./
COPY apps/frontend ./apps/frontend
RUN pnpm --filter frontend build

FROM nginx:alpine AS runtime
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
