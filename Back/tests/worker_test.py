"""ARQ 배치 등록 — 01_basic_design.md §3.3.6·§5.2.1."""
from __future__ import annotations

from app.worker import WorkerSettings


def test_cron_jobs_run_at_kst_times() -> None:
    jobs = {c.name: (c.hour, c.minute) for c in WorkerSettings.cron_jobs}
    assert jobs == {
        "cron:check_expiry": (1, 30),
        "cron:purge_withdrawn_accounts": (3, 0),
    }
