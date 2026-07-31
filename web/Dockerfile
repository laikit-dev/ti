FROM node:20-alpine AS build

WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=${NPM_REGISTRY}
RUN npm install -g pnpm@9.15.4

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/tsconfig.json web/vite.config.ts web/index.html ./web/
RUN pnpm install --filter ./web... --frozen-lockfile

ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

ARG VITE_CDN_BASE_URL=""
ENV VITE_CDN_BASE_URL=${VITE_CDN_BASE_URL}

COPY web/src ./web/src
RUN pnpm -C web build

FROM nginx:1.27-alpine

COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html

EXPOSE 80
