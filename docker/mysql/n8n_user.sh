#!/bin/bash
# n8n 예측 워크플로우 전용 DB 계정 — 02_implementation_design.md §4.5 n8n_user 권한.
# 새 볼륨은 docker-entrypoint-initdb.d에서 자동 실행된다. 이미 만든 볼륨에는 한 번 직접 실행한다:
#   docker compose exec mysql bash /docker-entrypoint-initdb.d/n8n_user.sh
set -euo pipefail

if [ -z "${N8N_DB_USER:-}" ] || [ -z "${N8N_DB_PASSWORD:-}" ]; then
  echo "N8N_DB_USER / N8N_DB_PASSWORD 미설정 — n8n 계정을 만들지 않는다"
  exit 0
fi

DB="${MYSQL_DATABASE}"
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<-EOSQL
    CREATE USER IF NOT EXISTS '${N8N_DB_USER}'@'%' IDENTIFIED BY '${N8N_DB_PASSWORD}';
    ALTER USER '${N8N_DB_USER}'@'%' IDENTIFIED BY '${N8N_DB_PASSWORD}';
    GRANT SELECT ON \`${DB}\`.stores TO '${N8N_DB_USER}'@'%';
    GRANT SELECT ON \`${DB}\`.menus TO '${N8N_DB_USER}'@'%';
    GRANT SELECT ON \`${DB}\`.sale_records TO '${N8N_DB_USER}'@'%';
    GRANT SELECT, INSERT, UPDATE ON \`${DB}\`.forecast_results TO '${N8N_DB_USER}'@'%';
    GRANT SELECT, INSERT, DELETE ON \`${DB}\`.forecast_menu_items TO '${N8N_DB_USER}'@'%';
    GRANT SELECT, INSERT, UPDATE ON \`${DB}\`.pipeline_jobs TO '${N8N_DB_USER}'@'%';
    GRANT SELECT, INSERT, UPDATE ON \`${DB}\`.weather_observations TO '${N8N_DB_USER}'@'%';
    FLUSH PRIVILEGES;
EOSQL
echo "n8n DB 계정 준비 완료: ${N8N_DB_USER}"
