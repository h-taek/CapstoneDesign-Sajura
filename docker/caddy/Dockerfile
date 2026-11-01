# Caddy 이미지 — 03_be.md §15.1. FE를 빌드해 /srv에 넣는다(리버스 프록시 + PWA 정적 파일 한 컨테이너).
# Build context: repo root (compose: context=.)

FROM node:22-alpine AS fe

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app
COPY Front/package.json Front/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY Front/ .
# Vite는 VITE_* 환경 변수를 빌드 결과에 넣는다 (04_fe.md §10.2)
ARG VITE_API_BASE_URL=/api
ARG VITE_VAPID_PUBLIC_KEY=
ARG VITE_APP_VERSION=0.1.0
ARG VITE_EXTENSION_ID=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY \
    VITE_APP_VERSION=$VITE_APP_VERSION \
    VITE_EXTENSION_ID=$VITE_EXTENSION_ID
RUN pnpm build


FROM caddy:2-alpine

COPY docker/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=fe /app/dist /srv

EXPOSE 80 443
