from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pydantic import BaseModel, HttpUrl, Field, field_validator


class ScrapeRequest(BaseModel):
    url: str = Field(..., description="Target URL to scrape")

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("url must start with http:// or https://")
        return v


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def field_object(value: Any, source: str, confidence: float, unit: Optional[str] = None) -> Dict[str, Any]:
    obj = {"value": value, "source": source, "confidence": round(float(confidence), 3)}
    if unit is not None:
        obj["unit"] = unit
    return obj


class ValueEnvelope(Dict[str, Any]):
    pass
