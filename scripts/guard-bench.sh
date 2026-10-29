#!/usr/bin/env bash
# 보안 분류기 시험 전체 — 정상 50 + 상품명 지시문(codex·agy_v1·agy_v2) + 오남용 지시문(codex·agy_v1·agy_v2).
# 모델을 하나씩 올려 건마다 판정·사유·시간을 화면에 찍고, 같은 내용을 로그에 남긴다.
# 사용: ./scripts/guard-bench.sh                 세 모델 모두 (qwen3.6:35b-a3b → prompt-guard → qwen3.8:27b)
#       ./scripts/guard-bench.sh qwen3.8:27b     지정한 모델만
# 결과: 로그 /tmp/guard_bench/run.log, 건별 /tmp/guard_bench/<모델>.jsonl
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
D="$ROOT/scripts/llm_eval/data_guard"
MODELS=("$@")
[[ ${#MODELS[@]} -eq 0 ]] && MODELS=(qwen3.6:35b-a3b prompt-guard qwen3.8:27b)

"$ROOT/scripts/guard-up.sh"
mkdir -p /tmp/guard_bench

cd "$ROOT"
uv run --quiet --no-project --python 3.12 \
  --with torch==2.9.1 --with transformers==4.57.1 \
  --with pydantic==2.10.3 --with pydantic-settings==2.7.0 --with openai==3.40.0 \
  python -u scripts/llm_eval/guard_bench.py "${MODELS[@]}" \
    --name-file "$D/attacks_name_codex.txt" \
    --name-file "$D/attacks_name_agy_v1.txt" \
    --name-file "$D/attacks_name_agy_v2.txt" \
    --misuse-file "$D/attacks_misuse_codex.txt" \
    --misuse-file "$D/attacks_misuse_agy_v1.txt" \
    --misuse-file "$D/attacks_misuse_agy_v2.txt" \
  2>&1 | tee /tmp/guard_bench/run.log
