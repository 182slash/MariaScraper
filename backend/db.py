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
            # FIX: domain is now UNIQUE — one row per domain, always latest result.
            # The old schema had no UNIQUE constraint so rows piled up forever.
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS scrape_history (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    url         TEXT    NOT NULL,
                    domain      TEXT    NOT NULL UNIQUE,
                    created_at  TEXT    NOT NULL,
                    result_json TEXT    NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS domain_rate_limits (
                    domain          TEXT    PRIMARY KEY,
                    last_request_at INTEGER NOT NULL
                )
                """
            )
            conn.commit()

        # Migration: if the table already exists WITHOUT the UNIQUE constraint
        # (old installs), rebuild it so the upsert below works correctly.
        self._migrate_if_needed()

    def _migrate_if_needed(self) -> None:
        """
        Detect old schema (no UNIQUE on domain) and rebuild the table.
        Safe to run every start-up — a no-op if already migrated.
        """
        with self._lock:
            with self._connect() as conn:
                # Check whether a UNIQUE index on domain already exists.
                rows = conn.execute(
                    "PRAGMA index_list(scrape_history)"
                ).fetchall()
                has_unique = any(
                    row["unique"] == 1 for row in rows
                    if "domain" in (conn.execute(
                        f"PRAGMA index_info({row['name']})"
                    ).fetchone() or {}).get("name", "")
                )

                # Simpler check: try inserting a duplicate and catch the error.
                # Instead, just inspect the CREATE TABLE statement.
                ddl = conn.execute(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name='scrape_history'"
                ).fetchone()
                if ddl and "UNIQUE" not in ddl["sql"].upper():
                    # Rebuild: keep only the latest row per domain.
                    conn.executescript("""
                        BEGIN;
                        CREATE TABLE IF NOT EXISTS scrape_history_new (
                            id          INTEGER PRIMARY KEY AUTOINCREMENT,
                            url         TEXT    NOT NULL,
                            domain      TEXT    NOT NULL UNIQUE,
                            created_at  TEXT    NOT NULL,
                            result_json TEXT    NOT NULL
                        );
                        INSERT OR REPLACE INTO scrape_history_new
                            (url, domain, created_at, result_json)
                        SELECT url, domain, created_at, result_json
                        FROM scrape_history
                        WHERE id IN (
                            SELECT MAX(id) FROM scrape_history GROUP BY domain
                        );
                        DROP TABLE scrape_history;
                        ALTER TABLE scrape_history_new RENAME TO scrape_history;
                        COMMIT;
                    """)

    # ── Public API ────────────────────────────────────────────────────────────

    def can_request_domain(
        self, domain: str, now_ts: int, min_interval_seconds: int = 30
    ) -> bool:
        """
        Rate-limit guard.  Default raised to 30 s so that rapid re-analyses of
        the same domain don't silently return a cached HTTP-429 response.
        Returns True if the request is allowed, and updates the timestamp.
        """
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
        """
        FIX: Use INSERT OR REPLACE so the same domain always has exactly ONE row
        containing the most recent scrape result.  Old data is gone — no stale
        numbers can leak from a previous run.
        """
        scraped_at = result.get("scraped_at") or result.get("data", {}).get(
            "metadata", {}
        ).get("scraped_at", "")
        with self._lock:
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO scrape_history(url, domain, created_at, result_json)
                    VALUES(?, ?, ?, ?)
                    ON CONFLICT(domain) DO UPDATE SET
                        url         = excluded.url,
                        created_at  = excluded.created_at,
                        result_json = excluded.result_json
                    """,
                    (url, domain, scraped_at, json.dumps(result, ensure_ascii=False)),
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

    def delete_domain(self, domain: str) -> bool:
        """Remove all stored data for a domain (useful for manual resets)."""
        with self._lock:
            with self._connect() as conn:
                cur = conn.execute(
                    "DELETE FROM scrape_history WHERE domain = ?", (domain,)
                )
                conn.commit()
                return cur.rowcount > 0