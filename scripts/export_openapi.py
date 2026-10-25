"""BE OpenAPI 명세를 Front/openapi.json으로 내보낸다 — 04_fe.md §7.1.

서버를 띄우지 않고 FastAPI 앱에서 바로 뽑는다. 이어서 Front에서 `pnpm gen:api`로
src/api/types.gen.ts를 만든다.

사용: Back 가상환경에서 `python scripts/export_openapi.py` (저장소 루트 기준)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 명세 생성에는 DB 접속이 필요 없다. 필수 설정만 채워 import가 통과하게 한다
for key in ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"):
    os.environ.setdefault(key, "unused")
sys.path.insert(0, str(ROOT / "Back"))

from app.main import app  # noqa: E402

out = ROOT / "Front" / "openapi.json"
out.write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"wrote {out.relative_to(ROOT)}")
