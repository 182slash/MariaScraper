from __future__ import annotations

import time
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from db import SQLiteStore
from models import ScrapeRequest, utc_now_iso
from scraper import scrape_url


router = APIRouter()
store = SQLiteStore()


def _domain(url: str) -> str:
    return urlparse(url).netloc.lower()


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/history")
async def history():
    return {"success": True, "items": store.get_history(limit=50)}


@router.delete("/history/{domain}")
async def delete_domain_history(domain: str):
    """
    Manually clear stored data for a domain so the next scrape
    starts completely fresh (useful during development/testing).
    """
    deleted = store.delete_domain(domain)
    return {"success": True, "deleted": deleted, "domain": domain}


@router.post("/scrape")
async def scrape(payload: ScrapeRequest, request: Request):
    url = payload.url.strip()
    domain = _domain(url)
    if not domain:
        raise HTTPException(status_code=400, detail="Invalid URL domain")

    now_ts = int(time.time())

    # FIX: rate limit raised to 30 s (was 10 s).
    # 10 s was too short — rapid re-analysis of the same domain within the
    # scrape's own MIN_SCRAPE_SECONDS window would get 429'd, leaving the
    # frontend with no fresh result.
    if not store.can_request_domain(domain, now_ts, min_interval_seconds=30):
        raise HTTPException(
            status_code=429,
            detail=(
                f"Rate limit: please wait 30 seconds before re-analysing {domain}. "
                "This prevents serving a stale cached result."
            ),
        )

    try:
        result = await scrape_url(url)
        # FIX: save_history now uses INSERT OR REPLACE (upsert) so the DB
        # always holds exactly one row per domain — the freshest result.
        store.save_history(url, domain, result)
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "url": url,
                "error": str(exc),
                "scraped_at": utc_now_iso(),
            },
        )