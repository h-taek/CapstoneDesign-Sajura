# Caddy 이미지 — 09_service_design.md §11.1 (자체 빌드, FE dist COPY 자리는 후속 phase에서)
FROM caddy:2-alpine

COPY docker/caddy/Caddyfile /etc/caddy/Caddyfile
# Phase 2 시점에는 빈 디렉터리 — FE 빌드 산출물 COPY는 배포 단계 몫 (Phase 13, 현재 범위 밖)
RUN mkdir -p /srv && echo "sajura caddy ok" > /srv/index.html

EXPOSE 80 443
