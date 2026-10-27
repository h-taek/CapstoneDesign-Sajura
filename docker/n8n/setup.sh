#!/bin/sh
# 예측 워크플로우 설치 — 자격 증명(MySQL n8n_user·내부 토큰)과 forecast.json을 n8n에 넣고 켠다.
# 비밀값은 컨테이너 환경값(docker-compose.yml n8n)에서 읽어 n8n 저장소에 암호화되어 들어간다.
#   docker compose exec n8n sh /opt/sajura/setup.sh && docker compose restart n8n
set -eu

: "${N8N_DB_USER:?}" "${N8N_DB_PASSWORD:?}" "${DB_NAME:?}" "${INTERNAL_API_TOKEN:?}"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cat > "$TMP/credentials.json" <<JSON
[
  {"id": "sajuraMysql0001", "name": "사주라 MySQL (n8n_user)", "type": "mySql",
   "data": {"host": "mysql", "port": 3306, "database": "${DB_NAME}",
            "user": "${N8N_DB_USER}", "password": "${N8N_DB_PASSWORD}"}},
  {"id": "sajuraInternal01", "name": "사주라 내부 토큰", "type": "httpHeaderAuth",
   "data": {"name": "X-Internal-Token", "value": "${INTERNAL_API_TOKEN}"}}
]
JSON

n8n import:credentials --input="$TMP/credentials.json"
n8n import:workflow --input=/opt/sajura/forecast.json
n8n publish:workflow --id=sajuraForecast01 2>/dev/null || n8n update:workflow --id=sajuraForecast01 --active=true
echo "예측 워크플로우 설치 완료 — n8n을 재시작해야 스케줄·웹훅이 적용된다"
