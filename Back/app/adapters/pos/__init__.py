"""POS 어댑터 패키지 — 01_basic_design.md §3.4.2.

CSVAdapter만 구현. TossPlace/Kiwoom/OKPOS 어댑터는 회사별 API 조사 후 구현
(docs/research/backend/13_pos_adapter.md).
"""
from app.adapters.pos.csv_adapter import CSVAdapter, CommonSale, SkipReason

__all__ = ["CSVAdapter", "CommonSale", "SkipReason"]
