from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional


class SQLiteStore:
    def __init__(self, db_path: str | Path = "scraper_history.sqlite3") -> None:
        self.db_path = Path(db_path)
        self._lock = threading.Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS scrape_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT NOT NULL,
                    domain TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    result_json TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS domain_rate_limits (
                    domain TEXT PRIMARY KEY,
                    last_request_at INTEGER NOT NULL
                )
                """
            )
            conn.commit()

    def can_request_domain(self, domain: str, now_ts: int, min_interval_seconds: int = 10) -> bool:
        with self._lock:
            with self._connect() as conn:
                row = conn.execute(
                    "SELECT last_request_at FROM domain_rate_limits WHERE domain = ?",
                    (domain,),
                ).fetchone()
                if row is not None and now_ts - int(row["last_request_at"]) < min_interval_seconds:
                    return False
                conn.execute(
                    """
                    INSERT INTO domain_rate_limits(domain, last_request_at)
                    VALUES(?, ?)
                    ON CONFLICT(domain) DO UPDATE SET last_request_at = excluded.last_request_at
                    """,
                    (domain, now_ts),
                )
                conn.commit()
                return True

    def save_history(self, url: str, domain: str, result: Dict[str, Any]) -> None:
        with self._lock:
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO scrape_history(url, domain, created_at, result_json)
                    VALUES(?, ?, ?, ?)
                    """,
                    (url, domain, result["scraped_at"], json.dumps(result, ensure_ascii=False)),
                )
                conn.commit()

    def get_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            with self._connect() as conn:
                rows = conn.execute(
                    """
                    SELECT url, domain, created_at, result_json
                    FROM scrape_history
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()
        out: List[Dict[str, Any]] = []
        for row in rows:
            try:
                payload = json.loads(row["result_json"])
            except Exception:
                payload = {"success": False, "error": "invalid_json"}
            out.append(
                {
                    "url": row["url"],
                    "domain": row["domain"],
                    "created_at": row["created_at"],
                    "result": payload,
                }
            )
        return out
