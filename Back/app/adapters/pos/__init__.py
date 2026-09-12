"""POS 어댑터 패키지 — 04_feature_spec.md §4.2.

MVP: CSVAdapter만 구현. TossPlace/Kiwoom/OKPOS 어댑터는 [2단계].
"""
from app.adapters.pos.csv_adapter import CSVAdapter, CommonSale, SkipReason

__all__ = ["CSVAdapter", "CommonSale", "SkipReason"]
