"""이상치 탐지 — Phase 12 hookup에서 실제 로직 채움.

04_feature_spec.md §4.6: 방법(IQR/Z-score 등)·임계값·후속 처리(분리/수정·알림)
정책 미확정. 본 placeholder는 시그니처만 고정하고 통과시킨다.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.adapters.pos.csv_adapter import CommonSale


@dataclass(frozen=True)
class AnomalyFlag:
    row_index: int
    reason: str


class AnomalyDetector:
    def detect(self, sales: list[CommonSale]) -> list[AnomalyFlag]:
        # Phase 12 hookup에서 IQR/Z-score 등 AI 팀 확정 후 채움.
        return []
