#!/usr/bin/env bash
# 보안 분류기(03_be.md §2.4.3, 시연용) 로컬 모델 서버 — 모델을 Back/ollama/에 두고 Ollama를 띄운다.
# 사용: ./scripts/guard-up.sh [--pull] [--down] [--status]
# Ollama 앱이 켜져 있으면 같은 포트(11434)를 쓰므로 앱을 먼저 종료한다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export OLLAMA_MODELS="$ROOT/Back/ollama"
GUARD_LOG="$ROOT/.guard-ollama.log"
GUARD_PID="$ROOT/.guard-ollama.pid"
PORT=11434
# 분류기 모델과 비교 후보 (HANDOFF — 시연 준비 때 비교해 확정)
MODELS=(qwen3.6:35b-a3b qwen3.8:27b)

ACTION=up
for arg in "$@"; do
  case "$arg" in
    --pull)   ACTION=pull ;;
    --down)   ACTION=down ;;
    --status) ACTION=status ;;
    -h|--help)
      cat <<EOF
사용: $0 [옵션]
  (옵션 없음) Back/ollama/를 모델 폴더로 Ollama 서버 기동 (백그라운드, 로그: .guard-ollama.log)
  --pull      서버 기동 후 분류기 모델 받기: ${MODELS[*]}
  --down      서버 종료
  --status    서버 상태와 받은 모델 목록
EOF
      exit 0 ;;
    *) echo "알 수 없는 옵션: $arg"; exit 2 ;;
  esac
done

log() { printf '\033[1;36m[guard-up]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[guard-up]\033[0m %s\n' "$*" >&2; }

running() { [[ -f "$GUARD_PID" ]] && kill -0 "$(cat "$GUARD_PID")" 2>/dev/null; }

case "$ACTION" in
  down)
    if running; then
      log "Ollama 서버 종료 (pid=$(cat "$GUARD_PID"))"
      kill "$(cat "$GUARD_PID")"
    fi
    rm -f "$GUARD_PID"
    exit 0 ;;
  status)
    if running; then
      log "running (pid=$(cat "$GUARD_PID")), 모델 폴더 $OLLAMA_MODELS"
      ollama list
    else
      log "stopped"
    fi
    exit 0 ;;
esac

if ! running; then
  if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
    err "포트 $PORT 를 다른 프로세스가 쓰고 있습니다. Ollama 앱을 종료한 뒤 다시 실행하세요."; exit 1
  fi
  mkdir -p "$OLLAMA_MODELS"
  log "Ollama 서버 시작 — 모델 폴더 $OLLAMA_MODELS"
  nohup ollama serve > "$GUARD_LOG" 2>&1 &
  echo $! > "$GUARD_PID"
  for _ in $(seq 1 20); do
    curl -fs -o /dev/null "http://localhost:$PORT/api/version" && break
    sleep 0.5
  done
fi
log "✓ Ollama up (pid=$(cat "$GUARD_PID")) → http://localhost:$PORT/v1"

if [[ "$ACTION" == pull ]]; then
  for m in "${MODELS[@]}"; do
    log "ollama pull $m"
    ollama pull "$m"
  done
fi
