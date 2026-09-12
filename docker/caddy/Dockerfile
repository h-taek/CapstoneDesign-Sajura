# Caddy 이미지 — 09_service_design.md §11.1 (자체 빌드, FE dist COPY 자리는 후속 phase에서)
FROM caddy:2-alpine

COPY docker/caddy/Caddyfile /etc/caddy/Caddyfile
# Phase 2 시점에는 빈 디렉터리 — FE 빌드 산출물은 phase_13_release에서 COPY
RUN mkdir -p /srv && echo "sajura caddy ok" > /srv/index.html

EXPOSE 80 443
