from __future__ import annotations

import time
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from .db import SQLiteStore
from .models import ScrapeRequest, utc_now_iso
from .scraper import scrape_url


router = APIRouter()
store = SQLiteStore()


def _domain(url: str) -> str:
    return urlparse(url).netloc.lower()


@router.get("/api/health")
async def health():
    return {"status": "ok"}


@router.get("/api/history")
async def history():
    return {"success": True, "items": store.get_history(limit=50)}


@router.post("/api/scrape")
async def scrape(payload: ScrapeRequest, request: Request):
    url = payload.url.strip()
    domain = _domain(url)
    if not domain:
        raise HTTPException(status_code=400, detail="Invalid URL domain")

    now_ts = int(time.time())
    if not store.can_request_domain(domain, now_ts, min_interval_seconds=10):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded for domain {domain}. Allow 1 request per 10 seconds.",
        )

    try:
        result = await scrape_url(url)
        # Preserve URL and timestamp fields on top-level response.
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
