# FE 이미지 — 10_frontend_design.md §1, plan/02_fe.md M2.F6.
# 멀티스테이지: node 22로 pnpm build → caddy:2-alpine 정적 서빙.
# Build context: repo root (compose: context=.)

FROM node:22-alpine AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY Front/package.json Front/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY Front/ .
RUN pnpm build


FROM caddy:2-alpine AS runtime

COPY docker/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/dist /srv

EXPOSE 80 443
