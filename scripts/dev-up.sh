#!/usr/bin/env bash
# 통합 dev 환경 부트스트랩 — docker stack 6컨테이너 + Alembic + FE dev 서버를 한 번에.
# 사용: ./scripts/dev-up.sh [--rebuild] [--no-fe] [--down] [--logs] [--status]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LOG_DIR="$ROOT/docker/log"
FE_LOG="$LOG_DIR/dev-fe.log"
mkdir -p "$LOG_DIR"
FE_PID="$ROOT/.dev-fe.pid"
FE_PORT="${FE_PORT:-5173}"
BE_PORT="${BE_PORT:-8000}"
# Default: Vite dev proxy(/api → BE)를 거치도록 상대경로 — Safari ITP의
# cross-site cookie 차단을 피하기 위함. 직결이 필요하면 환경변수로 override.
API_BASE_URL="${API_BASE_URL:-/api}"

REBUILD=0
WITH_FE=1
ACTION=up
for arg in "$@"; do
  case "$arg" in
    --rebuild)  REBUILD=1 ;;
    --no-fe)    WITH_FE=0 ;;
    --down)     ACTION=down ;;
    --logs)     ACTION=logs ;;
    --status)   ACTION=status ;;
    -h|--help)
      cat <<EOF
사용: $0 [옵션]
  (옵션 없음) docker stack + FE dev 서버를 한 번에 기동 (기본 동작)
  --rebuild   docker compose --build로 이미지 재빌드
  --no-fe     FE dev 서버는 띄우지 않음 (BE 스택만)
  --down      전체 종료 (docker stack + FE)
  --logs      FE dev 서버 로그 tail
  --status    현재 상태 확인 (docker compose ps + FE PID)
  -h, --help  도움말

환경변수:
  FE_PORT          FE 포트 (기본 5173)
  BE_PORT          BE 포트 (기본 8000)
  API_BASE_URL     FE에 전달되는 VITE_API_BASE_URL (기본 http://localhost:8000/api)
EOF
      exit 0 ;;
    *) echo "알 수 없는 옵션: $arg"; exit 2 ;;
  esac
done

log() { printf '\033[1;36m[dev-up]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[dev-up]\033[0m %s\n' "$*" >&2; }

stop_fe() {
  if [[ -f "$FE_PID" ]]; then
    local pid
    pid=$(cat "$FE_PID" 2>/dev/null || true)
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      log "FE dev 서버 종료 (pid=$pid)"
      kill "$pid" 2>/dev/null || true
      # vite는 child node 프로세스도 띄우므로 process group 종료
      pkill -P "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$FE_PID"
  fi
}

case "$ACTION" in
  down)
    stop_fe
    log "docker compose down"
    docker compose down
    log "전체 종료 완료"
    exit 0 ;;
  logs)
    if [[ ! -f "$FE_LOG" ]]; then
      err "FE 로그 파일이 없습니다 ($FE_LOG)"; exit 1
    fi
    exec tail -f "$FE_LOG" ;;
  status)
    echo "── docker compose ──"
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" || true
    echo
    echo "── FE dev ──"
    if [[ -f "$FE_PID" ]] && kill -0 "$(cat "$FE_PID")" 2>/dev/null; then
      printf "running (pid=%s) → http://localhost:%s\n" "$(cat "$FE_PID")" "$FE_PORT"
    else
      echo "stopped"
    fi
    exit 0 ;;
esac

# ── up 흐름 ──
if [[ ! -f .env ]]; then
  err ".env 가 없습니다. .env.example 복사 후 채우세요."; exit 1
fi
if ! docker info >/dev/null 2>&1; then
  err "docker 데몬이 실행 중이 아닙니다."; exit 1
fi

# 1) docker stack
COMPOSE_ARGS=(up -d)
[[ "$REBUILD" == 1 ]] && COMPOSE_ARGS+=(--build)
log "docker compose ${COMPOSE_ARGS[*]}"
docker compose "${COMPOSE_ARGS[@]}"

# 2) 헬스 대기
log "헬스체크 대기 중 (최대 180s)…"
DEADLINE=$(( $(date +%s) + 180 ))
while docker compose ps --format "{{.Status}}" | grep -q "health: starting"; do
  if (( $(date +%s) > DEADLINE )); then
    err "헬스체크 타임아웃."; docker compose ps; exit 1
  fi
  sleep 3
done
if docker compose ps --format "{{.Name}}\t{{.Status}}" | grep -E "unhealthy" >&2; then
  err "unhealthy 컨테이너 존재"; exit 1
fi
log "✓ 컨테이너 healthy"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# 3) Alembic
log "alembic upgrade head"
docker compose exec -T be alembic upgrade head | tail -3

# 4) FE
if [[ "$WITH_FE" == 1 ]]; then
  if [[ -f "$FE_PID" ]] && kill -0 "$(cat "$FE_PID")" 2>/dev/null; then
    log "FE 이미 실행 중 (pid=$(cat "$FE_PID")) → 재시작"
    stop_fe
  fi
  if [[ ! -d Front/node_modules ]]; then
    log "Front/node_modules 없음 → pnpm install"
    (cd Front && pnpm install)
  fi
  log "FE dev 서버 시작 (백그라운드, 로그: docker/log/dev-fe.log)"
  (
    cd Front
    nohup env VITE_API_BASE_URL="$API_BASE_URL" pnpm dev --port "$FE_PORT" \
      > "$FE_LOG" 2>&1 &
    echo $! > "$FE_PID"
  )
  # FE up 대기
  log "FE 준비 대기…"
  for _ in $(seq 1 30); do
    if curl -fs -o /dev/null "http://localhost:$FE_PORT/"; then
      log "✓ FE up (pid=$(cat "$FE_PID"))"
      break
    fi
    sleep 1
  done
fi

printf '\n\033[1;32m✓ 모든 서버 준비 완료\033[0m\n'
cat <<EOF
  · FE       : http://localhost:${FE_PORT}/        (login → /login)
  · 관리자   : http://localhost:${FE_PORT}/admin/verifications   (role=ADMIN 필요, 네비 링크 없음)
  · BE 직접  : http://localhost:${BE_PORT}/health
  · BE Caddy : http://localhost/api/*
  · n8n      : http://localhost:5678
  · MySQL    : localhost:3306 (app_user / sajura_dev_pw)

명령:
  · 상태 확인 : ./scripts/dev-up.sh --status
  · FE 로그   : ./scripts/dev-up.sh --logs
  · BE 로그   : docker compose logs -f be
  · BE 테스트 : docker compose exec be pytest -q
  · 전체 종료 : ./scripts/dev-up.sh --down
EOF
