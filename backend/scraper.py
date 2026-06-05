from __future__ import annotations

import asyncio
import json
import re
import time
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

try:
    from playwright.async_api import async_playwright
except Exception:
    async_playwright = None  # type: ignore

from models import field_object, utc_now_iso
from predictor import (
    default_city_split,
    infer_clinic_type,
    predict_numeric,
    reset_prediction_registry,
    mark_predicted,
    service_mix_prediction,
)


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

SUBPAGE_PATTERNS = [
    "about", "about-us", "tentang", "tentang-kami", "team", "tim", "dokter",
    "doctor", "dentist", "therapist", "terapis", "our-team", "tim-dokter",
    "location", "locations", "lokasi", "cabang", "outlet", "find-us",
    "clinic", "klinik", "our-clinic", "where-to-find",
    "service", "services", "layanan", "treatment", "treatments", "perawatan",
    "harga", "price", "pricing", "tarif", "paket", "package", "promo",
    "patient", "pasien", "review", "testimonial", "testimoni", "hasil",
    "investor", "press", "media", "news", "berita", "annual-report",
    "profil", "profile", "contact", "kontak", "gallery", "galeri",
    "fasilitas", "facility", "facilities", "specialist",
]

MIN_SCRAPE_SECONDS = 14

# ── Sanity bounds for scraped staff/count fields ──────────────────────────────
_FIELD_SANITY: Dict[str, Tuple[int, int]] = {
    "number_of_doctors":                        (1,   500),
    "number_of_dentists":                       (1,   200),
    "number_of_therapists":                     (1,   500),
    "number_of_treatment_rooms":                (1,   100),
    "number_of_dental_chairs":                  (1,   100),
    "number_of_outlets":                        (1,   500),
    "total_patients":                           (10, 5_000_000),
    "new_patients_per_month":                   (1,  100_000),
    "visit_frequency_per_patient_per_year":     (1,   52),
    "average_waiting_time":                     (1,   180),
    "patient_per_doctor_per_day":               (1,   80),
    "patient_per_dentist_per_day":              (1,   60),
    "visits_per_chair_per_day":                 (1,   40),
    "average_treatment_duration":               (5,  240),
    "operating_days_per_year":                  (50,  366),
    "opening_hours_per_day":                    (1,   24),
}


def _sanity_check(field: str, value: Any) -> bool:
    if field not in _FIELD_SANITY:
        return True
    if not isinstance(value, (int, float)):
        return True
    lo, hi = _FIELD_SANITY[field]
    return lo <= value <= hi


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def _base_headers() -> Dict[str, str]:
    return {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }


async def fetch_html_playwright(url: str, timeout_s: int = 30) -> Tuple[str, str]:
    browser = None
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            ctx = await browser.new_context(
                user_agent=USER_AGENT,
                locale="en-US",
                extra_http_headers=_base_headers(),
                viewport={"width": 1366, "height": 900},
            )
            page = await ctx.new_page()
            await page.goto(url, wait_until="networkidle", timeout=timeout_s * 1000)
            await page.evaluate("""async () => {
                await new Promise(resolve => {
                    const distance = 400;
                    const delay    = 120;
                    let   scrolled = 0;
                    const timer = setInterval(() => {
                        window.scrollBy(0, distance);
                        scrolled += distance;
                        if (scrolled >= document.body.scrollHeight) {
                            clearInterval(timer);
                            window.scrollTo(0, 0);
                            resolve();
                        }
                    }, delay);
                });
            }""")
            await page.wait_for_timeout(2_000)
            html = await page.content()
            final_url = page.url
            return html, final_url
        finally:
            if browser:
                try:
                    await browser.close()
                except Exception:
                    pass


async def fetch_html_httpx(url: str, timeout_s: int = 20) -> Tuple[str, str]:
    async with httpx.AsyncClient(
        headers=_base_headers(), follow_redirects=True, timeout=timeout_s
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text, str(resp.url)


async def fetch_html(url: str, timeout_s: int = 30) -> Tuple[str, str, bool]:
    if async_playwright is not None:
        try:
            html, final_url = await fetch_html_playwright(url, timeout_s)
            return html, final_url, True
        except Exception:
            pass
    try:
        html, final_url = await fetch_html_httpx(url, timeout_s)
        return html, final_url, False
    except Exception:
        return "", url, False


# ── HTML cleaning — strips noise before text extraction ───────────────────────

_NOISE_TAGS = [
    "script", "style", "noscript", "svg", "canvas",
    "iframe", "object", "embed", "video", "audio",
    "nav", "footer", "header",          # layout chrome rarely has useful numbers
]

# We keep footer/header for root page (may have outlet count, copyright aside)
_NOISE_TAGS_SUBPAGE = [
    "script", "style", "noscript", "svg", "canvas",
    "iframe", "object", "embed", "video", "audio",
]


def _clean_soup(soup: BeautifulSoup, aggressive: bool = False) -> BeautifulSoup:
    """
    Remove tags that contribute noise (JS bundles, CSS, media) but never
    useful clinic metrics.  aggressive=True also strips nav/footer/header.
    """
    tags = _NOISE_TAGS if aggressive else _NOISE_TAGS_SUBPAGE
    for tag in soup(tags):
        tag.decompose()
    return soup


# ── Sub-page crawler ──────────────────────────────────────────────────────────

def _is_subpage_candidate(href: str, base_netloc: str) -> bool:
    parsed = urlparse(href)
    if parsed.netloc and parsed.netloc.lower() != base_netloc:
        return False
    path = parsed.path.rstrip("/").lower()
    if not path or path == "/":
        return False
    if re.search(r"\.(pdf|jpg|jpeg|png|gif|svg|css|js|xml|zip|docx?)$", path):
        return False
    segments = re.split(r"[/-]", path)
    return any(pat in segments or pat in path for pat in SUBPAGE_PATTERNS)


def _discover_subpage_links(soup: BeautifulSoup, base_url: str) -> List[str]:
    base_netloc = urlparse(base_url).netloc.lower()
    seen_paths: Set[str] = set()
    candidates: List[str] = []
    for tag in soup.find_all("a", href=True):
        href = tag["href"].strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(base_url, href)
        path = urlparse(absolute).path.rstrip("/").lower() or "/"
        if path in seen_paths:
            continue
        if _is_subpage_candidate(absolute, base_netloc):
            seen_paths.add(path)
            candidates.append(absolute)
        if len(candidates) >= 12:
            break
    return candidates


async def _fetch_subpage_text(url: str) -> str:
    try:
        html, _ = await fetch_html_httpx(url, timeout_s=12)
        soup = BeautifulSoup(html, "lxml")
        # Remove all script/style/noise tags so JS bundles and React JSON
        # payloads (which embed years, IDs, timestamps) never reach the
        # text extractor.  This is the primary fix for "© 2026" → 2026 doctors.
        _clean_soup(soup, aggressive=False)
        return _clean_text(soup.get_text(" ", strip=True))
    except Exception:
        return ""


async def crawl_subpages(root_soup: BeautifulSoup, root_url: str) -> Tuple[str, List[str]]:
    candidates = _discover_subpage_links(root_soup, root_url)
    if not candidates:
        return "", []
    tasks = [_fetch_subpage_text(u) for u in candidates]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    parts = [r for r in results if isinstance(r, str) and r]
    return " ".join(parts), candidates


# ── Text helpers ──────────────────────────────────────────────────────────────

def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _domain(url: str) -> str:
    return urlparse(url).netloc.lower()


def _page_title(soup: BeautifulSoup) -> str:
    if soup.title and soup.title.get_text(strip=True):
        return _clean_text(soup.title.get_text(" ", strip=True))
    return ""


def _extract_meta(soup: BeautifulSoup) -> Dict[str, str]:
    data: Dict[str, str] = {}
    for tag in soup.find_all("meta"):
        key = tag.get("property") or tag.get("name")
        content = tag.get("content")
        if key and content:
            data[key.lower()] = content.strip()
    return data


def _jsonld_objects(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """
    Extract JSON-LD structured data. This is the GOOD structured data
    (schema.org) — we extract it BEFORE stripping scripts so we don't lose it.
    Only application/ld+json blocks are parsed; all other script content
    is discarded by _clean_soup().
    """
    out: List[Dict[str, Any]] = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(script.get_text(strip=True))
        except Exception:
            continue
        if isinstance(data, dict):
            out.append(data)
        elif isinstance(data, list):
            out.extend(x for x in data if isinstance(x, dict))
    return out


def _extract_jsonld_fields(jsonlds: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Pull structured values from JSON-LD objects (schema.org MedicalClinic,
    Physician, LocalBusiness, etc.).  Returns a flat dict of field → value.
    """
    out: Dict[str, Any] = {}
    for obj in jsonlds:
        rtype = obj.get("@type", "")

        # numberOfEmployees → doctor/staff count
        if "numberOfEmployees" in obj:
            emp = obj["numberOfEmployees"]
            if isinstance(emp, dict):
                emp = emp.get("value", emp.get("minValue"))
            if isinstance(emp, (int, float)) and _sanity_check("number_of_doctors", emp):
                out.setdefault("number_of_doctors", int(emp))

        # aggregateRating → NPS proxy
        if "aggregateRating" in obj:
            rating = obj["aggregateRating"]
            if isinstance(rating, dict):
                rv = rating.get("ratingValue")
                if rv and _sanity_check("nps_score", float(rv) * 10):
                    out.setdefault("nps_score", round(float(rv) * 10, 1))

        # openingHours / openingHoursSpecification
        if "openingHoursSpecification" in obj:
            specs = obj["openingHoursSpecification"]
            if isinstance(specs, list) and specs:
                days = len(set(
                    d for spec in specs
                    for d in (spec.get("dayOfWeek") or [])
                    if isinstance(d, str)
                ))
                if days > 0:
                    out.setdefault("operating_days_per_year", days * 52)

        # priceRange → rough ATV signal
        if "priceRange" in obj and isinstance(obj["priceRange"], str):
            atv = _currency_to_idr(obj["priceRange"])
            if atv and atv > 10_000:
                out.setdefault("average_transaction_value", atv)

        # branchOf / containsPlace → outlet count
        if obj.get("@type") in ("MedicalClinic", "Dentist", "LocalBusiness"):
            branches = obj.get("branchOf") or obj.get("containsPlace") or []
            if isinstance(branches, list) and len(branches) > 1:
                out.setdefault("number_of_outlets", len(branches))

    return out


def _extract_data_attributes(soup: BeautifulSoup) -> Dict[str, Any]:
    """
    Many CMS platforms store counts in data-* attributes, e.g.:
      <div data-doctors="12">  or  <span data-count="5" data-type="branch">
    This pass catches those before stripping.
    """
    out: Dict[str, Any] = {}
    field_map = {
        ("doctor", "dokter", "physician"):         "number_of_doctors",
        ("dentist", "gigi"):                        "number_of_dentists",
        ("therapist", "terapis"):                  "number_of_therapists",
        ("branch", "cabang", "outlet", "location", "lokasi"): "number_of_outlets",
        ("room", "ruang"):                          "number_of_treatment_rooms",
        ("chair", "kursi"):                         "number_of_dental_chairs",
        ("patient", "pasien"):                      "total_patients",
    }
    for tag in soup.find_all(True):
        for attr, val in tag.attrs.items():
            if not attr.startswith("data-"):
                continue
            attr_lower = attr.lower()
            if not isinstance(val, str):
                continue
            try:
                num = int(val.replace(",", "").replace(".", ""))
            except (ValueError, TypeError):
                continue
            for keywords, field in field_map.items():
                if any(kw in attr_lower for kw in keywords):
                    if _sanity_check(field, num):
                        out.setdefault(field, num)
    return out


def _extract_tables(soup: BeautifulSoup) -> str:
    parts: List[str] = []
    for table in soup.find_all("table"):
        rows: List[str] = []
        for tr in table.find_all("tr"):
            cells = [_clean_text(td.get_text(" ", strip=True)) for td in tr.find_all(["td", "th"])]
            if cells:
                rows.append(" :: ".join(cells))
        if rows:
            parts.append(" | ".join(rows))
    for dl in soup.find_all("dl"):
        dts = [_clean_text(dt.get_text(" ", strip=True)) for dt in dl.find_all("dt")]
        dds = [_clean_text(dd.get_text(" ", strip=True)) for dd in dl.find_all("dd")]
        for dt, dd in zip(dts, dds):
            parts.append(f"{dt} :: {dd}")
    return " ".join(parts)


# ── Value parsers ─────────────────────────────────────────────────────────────

def _currency_to_idr(text: str) -> Optional[float]:
    if not text:
        return None
    s = text.lower().replace(",", "").replace(" ", "")
    m = re.search(
        r"(rp|idr)\s*([0-9]+(?:\.[0-9]+)?)\s*(miliar|million|jt|juta|rb|ribu|k|b|bn|m)?", s
    )
    if not m:
        m = re.search(
            r"([0-9]+(?:\.[0-9]+)?)\s*(miliar|million|jt|juta|rb|ribu|k|b|bn|m)\b", s
        )
        if not m:
            return None
        num, unit = float(m.group(1)), m.group(2)
    else:
        num, unit = float(m.group(2)), m.group(3)
    mult = 1.0
    if unit in {"miliar", "b", "bn"}:
        mult = 1_000_000_000.0
    elif unit in {"million", "m"}:
        mult = 1_000_000.0
    elif unit in {"jt", "juta"}:
        mult = 1_000_000.0
    elif unit in {"rb", "ribu", "k"}:
        mult = 1_000.0
    return num * mult


def _percent_from_text(text: str) -> Optional[float]:
    if not text:
        return None
    m = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*%", text)
    return float(m.group(1)) if m else None


def _int_from_text(text: str) -> Optional[int]:
    if not text:
        return None
    s = text.lower().replace(",", "")
    # Match numbers with Indonesian thousand separators (dots) or plain integers
    m = re.search(r"([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]+)", s)
    if not m:
        return None
    try:
        return int(m.group(1).replace(".", ""))
    except ValueError:
        return None


# ── Indonesian number words → digits ─────────────────────────────────────────

_ID_NUMBER_WORDS: Dict[str, int] = {
    "satu": 1, "dua": 2, "tiga": 3, "empat": 4, "lima": 5,
    "enam": 6, "tujuh": 7, "delapan": 8, "sembilan": 9, "sepuluh": 10,
    "sebelas": 11, "dua belas": 12, "tiga belas": 13, "empat belas": 14,
    "lima belas": 15, "enam belas": 16, "tujuh belas": 17,
    "delapan belas": 18, "sembilan belas": 19, "dua puluh": 20,
    "tiga puluh": 30, "empat puluh": 40, "lima puluh": 50,
    "seratus": 100, "dua ratus": 200,
    # English
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
}

# Sorted longest-first so "dua belas" matches before "dua"
_ID_NUMBER_WORDS_SORTED = sorted(_ID_NUMBER_WORDS.keys(), key=len, reverse=True)


def _word_to_int(text: str) -> Optional[int]:
    """Convert Indonesian/English number words to int, e.g. 'lima dokter' → 5."""
    t = text.lower()
    for word in _ID_NUMBER_WORDS_SORTED:
        if word in t:
            return _ID_NUMBER_WORDS[word]
    return None


# ── Year / copyright stripping ────────────────────────────────────────────────

# Strips: © 2026, Copyright 2026, (c) 2026, Hak Cipta 2026,
#         since 2019, est. 2015, founded 2010,
#         bare years 1900–2099 with word boundaries
_YEAR_RE = re.compile(
    r"(?:©|copyright|hak\s+cipta|\(c\)|since|est\.?|founded|berdiri|tahun"
    r"|established)\s*(?:in\s+)?((?:19|20)\d{2})"
    r"|\b(19|20)\d{2}\b",
    flags=re.I,
)


def _strip_years(text: str) -> str:
    """
    Remove calendar years and year-adjacent phrases so they are never
    mistaken for staff counts, outlet counts, or patient volumes.
    Covers copyright notices, founding years, 'since YYYY', etc.
    """
    return _YEAR_RE.sub("", text)


def _find_context_value(
    text: str, aliases: List[str], value_type: str
) -> Optional[Any]:
    for alias in aliases:
        pattern = rf"({re.escape(alias)}[^.\n:{{}}]{{0,180}})"
        for m in re.finditer(pattern, text, flags=re.I):
            chunk = m.group(1)
            if value_type == "currency":
                val = _currency_to_idr(chunk)
            elif value_type == "percent":
                val = _percent_from_text(chunk)
            else:
                # Strip years before integer extraction
                stripped = _strip_years(chunk)
                val = _int_from_text(stripped)
                # Fallback: try Indonesian/English number words
                if val is None:
                    val = _word_to_int(stripped)
            if val is not None:
                return val
    return None


# ── Field extraction ──────────────────────────────────────────────────────────

_ALIASES: Dict[str, List[str]] = {
    "revenue": ["revenue", "pendapatan", "omzet", "sales", "turnover"],
    "number_of_outlets": [
        "outlet", "cabang", "branch", "clinic", "klinik", "lokasi", "location",
        "gerai", "pusat", "center",
    ],
    "number_of_doctors": [
        "doctor", "dokter", "physician", "medical team", "tim dokter",
        "specialist", "spesialis", "dr.", "tenaga medis",
    ],
    "number_of_dentists": [
        "dentist", "dokter gigi", "drg", "dokter gigi kami", "dental team",
    ],
    "number_of_therapists": [
        "therapist", "terapis", "aesthetic therapist", "beauty therapist",
        "skin therapist",
    ],
    "number_of_treatment_rooms": [
        "treatment room", "ruang perawatan", "ruangan tindakan", "kamar",
    ],
    "number_of_dental_chairs": [
        "dental chair", "chair", "kursi dental", "unit dental", "dental unit",
    ],
    "total_patients": [
        "patients", "pasien", "patient", "total pasien", "pelanggan",
        "customers served",
    ],
    "new_patients_per_month": [
        "new patients", "pasien baru", "new patient per month", "pasien baru per bulan",
    ],
    "patient_retention_rate": [
        "retention", "repeat", "returning patient", "pasien setia",
        "pasien kembali", "loyal",
    ],
    "visit_frequency_per_patient_per_year": [
        "visit frequency", "kunjungan per pasien", "visits per patient",
        "frekuensi kunjungan",
    ],
    "nps_score": ["nps", "net promoter score", "satisfaction score", "skor kepuasan"],
    "average_waiting_time": [
        "waiting time", "waktu tunggu", "antrian", "queue time", "lama menunggu",
    ],
    "doctor_utilization": ["utilization", "occupancy", "utilisasi", "utilisasi dokter"],
    "patient_per_doctor_per_day": [
        "patients per doctor per day", "pasien per dokter", "pasien per hari",
    ],
    "dentist_utilization": ["dentist utilization", "utilisasi dokter gigi"],
    "chair_utilization": ["chair utilization", "utilisasi kursi"],
    "visits_per_chair_per_day": ["visits per chair per day", "kunjungan per kursi"],
    "patient_per_dentist_per_day": ["patients per dentist per day"],
    "average_treatment_duration": [
        "treatment duration", "durasi tindakan", "lama perawatan", "waktu perawatan",
    ],
    "appointment_slot_utilization": ["appointment slot utilization"],
    "customer_acquisition_cost_cac": [
        "cac", "customer acquisition cost", "biaya akuisisi", "cost per acquisition",
    ],
    "customer_lifetime_value_ltv": [
        "ltv", "lifetime value", "nilai seumur hidup", "customer value",
    ],
    "ebitda_margin": ["ebitda margin", "ebitda"],
    "gross_margin": ["gross margin", "margin kotor", "gross profit margin"],
    "average_transaction_value": [
        "average transaction value", "atv", "nilai transaksi rata", "rata-rata transaksi",
        "average spending", "average spend",
    ],
    "membership_package_penetration": [
        "membership", "package penetration", "paket member", "program member",
    ],
    "marketing_spend": [
        "marketing spend", "marketing expense", "biaya pemasaran", "biaya iklan",
        "advertising spend",
    ],
    "investment_per_clinic": [
        "investment", "capex", "fit out", "investasi klinik", "modal klinik",
    ],
}

_CURRENCY_FIELDS = {
    "revenue", "revenue_per_outlet", "revenue_per_city",
    "revenue_per_patient", "revenue_per_visit",
    "revenue_per_doctor_dentist_therapist", "revenue_per_treatment_room",
    "revenue_per_dental_chair", "customer_acquisition_cost_cac",
    "customer_lifetime_value_ltv", "average_transaction_value",
    "investment_per_clinic",
}
_PERCENT_FIELDS = {
    "doctor_utilization", "dentist_utilization", "chair_utilization",
    "patient_retention_rate", "nps_score", "appointment_slot_utilization",
    "membership_package_penetration", "marketing_spend",
}
_INT_FIELDS = {
    "number_of_outlets", "number_of_doctors", "number_of_dentists",
    "number_of_therapists", "number_of_treatment_rooms", "number_of_dental_chairs",
    "patient_per_doctor_per_day", "patient_per_dentist_per_day",
    "visits_per_chair_per_day", "new_patients_per_month", "total_patients",
    "average_waiting_time", "visit_frequency_per_patient_per_year",
    "average_treatment_duration", "operating_days_per_year", "opening_hours_per_day",
}


def extract_fields_from_text(text: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    text_clean = _clean_text(text)

    for field, aliases in _ALIASES.items():
        if field in _CURRENCY_FIELDS:
            val = _find_context_value(text_clean, aliases, "currency")
        elif field in _PERCENT_FIELDS:
            val = _find_context_value(text_clean, aliases, "percent")
        else:
            val = _find_context_value(text_clean, aliases, "int")

        if val is not None:
            if _sanity_check(field, val):
                out[field] = val

    if "revenue" not in out:
        rev = _currency_to_idr(text_clean)
        if rev and rev > 100_000:
            out["revenue"] = rev

    return out


# ── Inline stat patterns ──────────────────────────────────────────────────────

# Matches patterns like "12 dokter", "5 cabang", "Lima dokter", "3 branches"
_INLINE_STAT_PATTERNS: List[Tuple[str, str]] = [
    # (regex_pattern, field_name)
    (r"([0-9]+)\s+(?:orang\s+)?(?:doctor|dokter|physician)s?\b",   "number_of_doctors"),
    (r"([0-9]+)\s+(?:orang\s+)?(?:dentist|dokter\s+gigi|drg)s?\b", "number_of_dentists"),
    (r"([0-9]+)\s+(?:orang\s+)?(?:therapist|terapis)s?\b",         "number_of_therapists"),
    (r"([0-9]+)\s+(?:dental\s+)?chairs?\b",                         "number_of_dental_chairs"),
    (r"([0-9]+)\s+(?:dental\s+units?|unit\s+dental)\b",             "number_of_dental_chairs"),
    (r"([0-9]+)\s+(?:treatment\s+rooms?|ruang\s+perawatan)\b",      "number_of_treatment_rooms"),
    (r"([0-9]+)\s+(?:outlet|cabang|branch|lokasi|location)s?\b",    "number_of_outlets"),
    (r"([0-9]+)\+?\s+(?:klinik|clinic)s?\b",                        "number_of_outlets"),
    (r"([0-9]+)\+?\s+(?:patients?|pasien)\b",                       "total_patients"),
    (r"([0-9]{1,3}(?:[.,][0-9]{3})+)\+?\s+(?:patients?|pasien)\b", "total_patients"),
]


def _extract_inline_stats(text: str) -> Dict[str, Any]:
    """
    Targeted regex patterns for the most commonly displayed clinic stats.
    Applied on year-stripped text to avoid false positives.
    """
    out: Dict[str, Any] = {}
    clean = _strip_years(_clean_text(text))

    for pattern, field in _INLINE_STAT_PATTERNS:
        if field in out:
            continue
        m = re.search(pattern, clean, flags=re.I)
        if m:
            raw = m.group(1).replace(",", "").replace(".", "")
            try:
                val = int(raw)
            except ValueError:
                continue
            if _sanity_check(field, val):
                out[field] = val

    return out


def _extract_service_mix_terms(text: str, clinic_type: str) -> Dict[str, Any]:
    t = text.lower()
    out: Dict[str, Any] = {}
    if clinic_type in {"skin", "both"}:
        for field, kws in {
            "skin_health_pct": ["skin", "acne", "facial", "glow", "derma"],
            "injectables_antiaging_pct": ["botox", "filler", "threadlift", "injectable"],
            "body_aesthetics_pct": ["slimming", "body", "whitening"],
            "hair_solutions_pct": ["hair treatment", "hair loss", "rambut"],
            "non_doctor_treatments_pct": ["therapist", "non-doctor", "non doctor"],
        }.items():
            if any(k in t for k in kws):
                out[field] = None
    if clinic_type in {"dental", "both"}:
        for field, kws in {
            "scaling_pct": ["scaling"],
            "fillings_pct": ["filling", "tambal"],
            "braces_pct": ["braces", "orthodont", "behel"],
            "veneers_pct": ["veneer"],
            "endodontics_pct": ["endodont", "saluran akar"],
            "periodontics_pct": ["periodont", "gusi"],
            "prosthodontics_pct": ["prosthodont", "gigi tiruan"],
            "pedodontics_pct": ["pedodont", "gigi anak"],
        }.items():
            if any(k in t for k in kws):
                out[field] = None
    return out


def _detect_city_presence(text: str) -> Dict[str, float]:
    t = text.lower()
    weights: Dict[str, float] = {}
    if "jakarta" in t:
        weights["dki_jakarta"] = 70.0
    if "surabaya" in t:
        weights["surabaya"] = 70.0
    if any(w in t for w in ("banten", "tangerang", "bsd", "serpong")):
        weights["banten"] = 70.0
    if not weights:
        return default_city_split()
    remaining = 100.0 - sum(weights.values())
    missing = [k for k in ("dki_jakarta", "surabaya", "banten") if k not in weights]
    if missing:
        share = max(remaining, 0.0) / len(missing)
        for k in missing:
            weights[k] = round(share, 2)
    return weights


# ── Schema helpers ────────────────────────────────────────────────────────────

def make_base_schema() -> Dict[str, Any]:
    return {
        "financials": {
            "revenue": None,
            "number_of_outlets": None,
            "revenue_per_outlet": None,
            "revenue_per_city": {"dki_jakarta": None, "surabaya": None, "banten": None},
            "revenue_per_patient": None,
            "revenue_per_visit": None,
            "revenue_per_doctor_dentist_therapist": None,
            "revenue_per_treatment_room": None,
            "revenue_per_dental_chair": None,
            "customer_acquisition_cost_cac": None,
            "customer_lifetime_value_ltv": None,
            "ebitda_margin": None,
            "gross_margin": None,
            "average_transaction_value": None,
            "membership_package_penetration": None,
            "marketing_spend": None,
            "investment_per_clinic": None,
        },
        "operational": {
            "number_of_doctors": None,
            "number_of_dentists": None,
            "number_of_therapists": None,
            "doctor_utilization": None,
            "patient_per_doctor_per_day": None,
            "number_of_treatment_rooms": None,
            "opening_hours_per_day": None,
            "operating_days_per_year": None,
        },
        "patient_metrics": {
            "total_patients": None,
            "new_patients_per_month": None,
            "patient_retention_rate": None,
            "visit_frequency_per_patient_per_year": None,
            "nps_score": None,
            "average_waiting_time": None,
        },
        "dental_specific": {
            "dentist_utilization": None,
            "chair_utilization": None,
            "visits_per_chair_per_day": None,
            "patient_per_dentist_per_day": None,
            "average_treatment_duration": None,
            "appointment_slot_utilization": None,
            "number_of_dental_chairs": None,
        },
        "patient_mix": {
            "new_vs_repeat_patient_mix": None,
            "walkin_vs_appointment_mix": None,
            "corporate_vs_retail_patient_mix": None,
        },
        "service_mix_skin": {
            "skin_health_pct": None,
            "injectables_antiaging_pct": None,
            "body_aesthetics_pct": None,
            "hair_solutions_pct": None,
            "non_doctor_treatments_pct": None,
            "other_services_skin_pct": None,
        },
        "service_mix_dental": {
            "scaling_pct": None,
            "fillings_pct": None,
            "braces_pct": None,
            "veneers_pct": None,
            "endodontics_pct": None,
            "periodontics_pct": None,
            "prosthodontics_pct": None,
            "pedodontics_pct": None,
            "other_services_dental_pct": None,
        },
        "metadata": {
            "clinic_type": "unknown",
            "scraped_at": utc_now_iso(),
            "url": "",
            "page_title": "",
            "overall_confidence": 0.0,
            "pages_crawled": 0,
            "subpages_found": [],
        },
    }


def _set_by_path(schema: Dict[str, Any], path: str, value: Any) -> None:
    keys = path.split(".")
    cur = schema
    for k in keys[:-1]:
        cur = cur[k]
    cur[keys[-1]] = value


def _get_by_path(schema: Dict[str, Any], path: str) -> Any:
    cur = schema
    for k in path.split("."):
        cur = cur[k]
    return cur


_PATH_ALIAS_MAP: Dict[str, str] = {
    "financials.revenue":                                           "revenue",
    "financials.number_of_outlets":                                 "number_of_outlets",
    "financials.revenue_per_outlet":                                "revenue_per_outlet",
    "financials.revenue_per_patient":                               "revenue_per_patient",
    "financials.revenue_per_visit":                                 "revenue_per_visit",
    "financials.revenue_per_doctor_dentist_therapist":              "revenue_per_doctor_dentist_therapist",
    "financials.revenue_per_treatment_room":                        "revenue_per_treatment_room",
    "financials.revenue_per_dental_chair":                          "revenue_per_dental_chair",
    "financials.customer_acquisition_cost_cac":                     "customer_acquisition_cost_cac",
    "financials.customer_lifetime_value_ltv":                       "customer_lifetime_value_ltv",
    "financials.ebitda_margin":                                     "ebitda_margin",
    "financials.gross_margin":                                      "gross_margin",
    "financials.average_transaction_value":                         "average_transaction_value",
    "financials.membership_package_penetration":                    "membership_package_penetration",
    "financials.marketing_spend":                                   "marketing_spend",
    "financials.investment_per_clinic":                             "investment_per_clinic",
    "operational.number_of_doctors":                                "number_of_doctors",
    "operational.number_of_dentists":                               "number_of_dentists",
    "operational.number_of_therapists":                             "number_of_therapists",
    "operational.doctor_utilization":                               "doctor_utilization",
    "operational.patient_per_doctor_per_day":                       "patient_per_doctor_per_day",
    "operational.number_of_treatment_rooms":                        "number_of_treatment_rooms",
    "operational.opening_hours_per_day":                            "opening_hours_per_day",
    "operational.operating_days_per_year":                          "operating_days_per_year",
    "patient_metrics.total_patients":                               "total_patients",
    "patient_metrics.new_patients_per_month":                       "new_patients_per_month",
    "patient_metrics.patient_retention_rate":                       "patient_retention_rate",
    "patient_metrics.visit_frequency_per_patient_per_year":         "visit_frequency_per_patient_per_year",
    "patient_metrics.nps_score":                                    "nps_score",
    "patient_metrics.average_waiting_time":                         "average_waiting_time",
    "dental_specific.dentist_utilization":                          "dentist_utilization",
    "dental_specific.chair_utilization":                            "chair_utilization",
    "dental_specific.visits_per_chair_per_day":                     "visits_per_chair_per_day",
    "dental_specific.patient_per_dentist_per_day":                  "patient_per_dentist_per_day",
    "dental_specific.average_treatment_duration":                   "average_treatment_duration",
    "dental_specific.appointment_slot_utilization":                 "appointment_slot_utilization",
    "dental_specific.number_of_dental_chairs":                      "number_of_dental_chairs",
}


# ── Main entry point ──────────────────────────────────────────────────────────

async def scrape_url(url: str) -> Dict[str, Any]:
    t_start = time.monotonic()

    # Reset prediction registry so no state bleeds between scrape calls
    reset_prediction_registry()

    # ── 1. Fetch root page ────────────────────────────────────────────────────
    html, final_url, used_playwright = await fetch_html(url)
    soup = BeautifulSoup(html, "lxml")

    # Extract structured data BEFORE stripping script tags
    jsonlds    = _jsonld_objects(soup)
    meta       = _extract_meta(soup)
    page_title = _page_title(soup)
    table_text = _extract_tables(soup)

    # Extract data-* attributes before stripping
    data_attr_fields = _extract_data_attributes(soup)

    # NOW strip noise tags from root soup before get_text()
    _clean_soup(soup, aggressive=False)
    root_text = _clean_text(soup.get_text(" ", strip=True))

    # ── 2. Crawl sub-pages ────────────────────────────────────────────────────
    # Re-parse for link discovery (we already stripped soup above)
    soup_for_links = BeautifulSoup(html, "lxml")
    subpage_text, subpage_candidates = await crawl_subpages(soup_for_links, final_url or url)

    full_text = " ".join(filter(None, [
        root_text,
        table_text,
        subpage_text,
        " ".join(meta.values()),
        # JSON-LD text content (safe structured data only)
        " ".join(json.dumps(obj, ensure_ascii=False) for obj in jsonlds),
    ]))

    pages_crawled = 1 + len(subpage_candidates)

    # ── 3. Clinic type ────────────────────────────────────────────────────────
    clinic_type = infer_clinic_type(f"{page_title} {full_text}", url=url)

    # ── 4. Field extraction — layered approach ────────────────────────────────
    # Priority (highest → lowest):
    #   table_text > inline_stats > context_aliases > data_attributes > jsonld
    observed: Dict[str, Any] = {}

    # Layer 1: JSON-LD structured data (schema.org — most reliable when present)
    observed.update(_extract_jsonld_fields(jsonlds))

    # Layer 2: data-* HTML attributes
    observed.update(data_attr_fields)

    # Layer 3: context-window alias regex on full text
    observed.update(extract_fields_from_text(full_text))

    # Layer 4: targeted inline stat patterns (year-stripped)
    observed.update(_extract_inline_stats(full_text))

    # Layer 5: table content wins over everything (most structured)
    observed.update(extract_fields_from_text(table_text))
    observed.update(_extract_inline_stats(table_text))

    # ── 5. Build schema ───────────────────────────────────────────────────────
    schema = make_base_schema()
    schema["metadata"]["url"]            = final_url or url
    schema["metadata"]["page_title"]     = page_title
    schema["metadata"]["scraped_at"]     = utc_now_iso()
    schema["metadata"]["clinic_type"]    = clinic_type
    schema["metadata"]["pages_crawled"]  = pages_crawled
    schema["metadata"]["subpages_found"] = subpage_candidates

    scraped_fields: Dict[str, float] = {}
    predictions_log: List[Dict[str, Any]] = []

    for path, key in _PATH_ALIAS_MAP.items():
        if key in observed and observed[key] is not None:
            val = observed[key]
            if isinstance(val, float):
                val = round(val, 2)
            _set_by_path(schema, path, field_object(val, "scraped", 0.90))
            scraped_fields[path] = 0.90

    # ── 6. Patient mix from text signals ─────────────────────────────────────
    mix_text = full_text.lower()
    if "repeat" in mix_text or "returning" in mix_text or "revisit" in mix_text:
        repeat_val = 60.0 if "high" in mix_text else 50.0
        schema["patient_mix"]["new_vs_repeat_patient_mix"] = field_object(repeat_val, "scraped", 0.48)
        scraped_fields["patient_mix.new_vs_repeat_patient_mix"] = 0.48
    if "appointment" in mix_text and ("walk-in" in mix_text or "walk in" in mix_text):
        schema["patient_mix"]["walkin_vs_appointment_mix"] = field_object(65.0, "scraped", 0.45)
        scraped_fields["patient_mix.walkin_vs_appointment_mix"] = 0.45
    if "corporate" in mix_text or "insurance" in mix_text or "bpjs" in mix_text:
        schema["patient_mix"]["corporate_vs_retail_patient_mix"] = field_object(25.0, "scraped", 0.45)
        scraped_fields["patient_mix.corporate_vs_retail_patient_mix"] = 0.45

    # ── 7. Service mix observed terms ────────────────────────────────────────
    observed_mix = _extract_service_mix_terms(full_text, clinic_type)
    for k in observed_mix:
        if k in schema["service_mix_skin"]:
            schema["service_mix_skin"][k] = field_object(None, "scraped", 0.38)
        if k in schema["service_mix_dental"]:
            schema["service_mix_dental"][k] = field_object(None, "scraped", 0.38)

    # ── 8. Build known_flat for predictor ────────────────────────────────────
    known_flat: Dict[str, Any] = {}

    def collect_known() -> None:
        for cat, data in schema.items():
            if cat == "metadata":
                continue
            if isinstance(data, dict):
                for k, v in data.items():
                    if isinstance(v, dict) and "value" in v:
                        known_flat[k] = v["value"]
                    elif isinstance(v, dict):
                        for kk, vv in v.items():
                            if isinstance(vv, dict) and "value" in vv:
                                known_flat[f"{k}.{kk}"] = vv["value"]

    collect_known()
    scrape_ratio = len(scraped_fields) / max(len(_PATH_ALIAS_MAP), 1)

    # ── 9. Prediction engine ──────────────────────────────────────────────────
    def fill_numeric(path: str, key: str, unit: Optional[str] = None) -> None:
        current = _get_by_path(schema, path)
        if isinstance(current, dict) and current.get("source") == "scraped":
            return
        value, confidence, method = predict_numeric(
            field=key,
            clinic_type=clinic_type,
            known=known_flat,
            method_log=predictions_log,
            scrape_ratio=scrape_ratio,
        )
        if confidence > 0:
            _set_by_path(schema, path, field_object(value, "predicted", confidence, unit=unit))
            known_flat[key] = value
            mark_predicted(key)
            predictions_log.append({
                "field": path,
                "method": method,
                "confidence": round(confidence, 3),
            })

    for path, key in [
        ("operational.number_of_doctors",              "number_of_doctors"),
        ("operational.number_of_dentists",             "number_of_dentists"),
        ("operational.number_of_therapists",           "number_of_therapists"),
        ("operational.number_of_treatment_rooms",      "number_of_treatment_rooms"),
        ("dental_specific.number_of_dental_chairs",    "number_of_dental_chairs"),
        ("patient_metrics.total_patients",             "total_patients"),
        ("patient_metrics.new_patients_per_month",     "new_patients_per_month"),
    ]:
        fill_numeric(path, key)

    for path, key in [
        ("financials.revenue",                                      "revenue"),
        ("financials.number_of_outlets",                            "number_of_outlets"),
        ("financials.revenue_per_outlet",                           "revenue_per_outlet"),
        ("financials.revenue_per_patient",                          "revenue_per_patient"),
        ("financials.revenue_per_visit",                            "revenue_per_visit"),
        ("financials.revenue_per_doctor_dentist_therapist",         "revenue_per_doctor_dentist_therapist"),
        ("financials.revenue_per_treatment_room",                   "revenue_per_treatment_room"),
        ("financials.revenue_per_dental_chair",                     "revenue_per_dental_chair"),
        ("financials.customer_acquisition_cost_cac",                "customer_acquisition_cost_cac"),
        ("financials.customer_lifetime_value_ltv",                  "customer_lifetime_value_ltv"),
        ("financials.average_transaction_value",                    "average_transaction_value"),
        ("financials.investment_per_clinic",                        "investment_per_clinic"),
    ]:
        fill_numeric(path, key, unit="IDR")

    for path, key in [
        ("financials.ebitda_margin",                                "ebitda_margin"),
        ("financials.gross_margin",                                 "gross_margin"),
        ("financials.membership_package_penetration",               "membership_package_penetration"),
        ("financials.marketing_spend",                              "marketing_spend"),
        ("operational.doctor_utilization",                          "doctor_utilization"),
        ("patient_metrics.patient_retention_rate",                  "patient_retention_rate"),
        ("dental_specific.dentist_utilization",                     "dentist_utilization"),
        ("dental_specific.chair_utilization",                       "chair_utilization"),
        ("dental_specific.appointment_slot_utilization",            "appointment_slot_utilization"),
    ]:
        fill_numeric(path, key, unit="%")

    unit_map = {
        "opening_hours_per_day": "hours",
        "operating_days_per_year": "days",
        "nps_score": "score",
        "average_waiting_time": "minutes",
        "average_treatment_duration": "minutes",
    }
    for path, key in [
        ("operational.patient_per_doctor_per_day",                  "patient_per_doctor_per_day"),
        ("operational.opening_hours_per_day",                       "opening_hours_per_day"),
        ("operational.operating_days_per_year",                     "operating_days_per_year"),
        ("patient_metrics.visit_frequency_per_patient_per_year",    "visit_frequency_per_patient_per_year"),
        ("patient_metrics.nps_score",                               "nps_score"),
        ("patient_metrics.average_waiting_time",                    "average_waiting_time"),
        ("dental_specific.visits_per_chair_per_day",                "visits_per_chair_per_day"),
        ("dental_specific.patient_per_dentist_per_day",             "patient_per_dentist_per_day"),
        ("dental_specific.average_treatment_duration",              "average_treatment_duration"),
    ]:
        fill_numeric(path, key, unit=unit_map.get(key, "count"))

    # ── 10. Revenue per city ──────────────────────────────────────────────────
    city_split = _detect_city_presence(full_text)
    if schema["financials"]["revenue_per_city"]["dki_jakarta"] is None:
        raw_rev = known_flat.get("revenue")
        if raw_rev:
            for city, pct in city_split.items():
                schema["financials"]["revenue_per_city"][city] = field_object(
                    round(float(raw_rev) * pct / 100), "predicted", 0.52, unit="IDR"
                )
                predictions_log.append({
                    "field": f"financials.revenue_per_city.{city}",
                    "method": f"city-share baseline ({pct:.0f}% of revenue)",
                    "confidence": 0.52,
                })
        else:
            for city, pct in city_split.items():
                schema["financials"]["revenue_per_city"][city] = field_object(
                    None, "predicted", 0.20, unit="IDR"
                )
                predictions_log.append({
                    "field": f"financials.revenue_per_city.{city}",
                    "method": f"city-share baseline ({pct:.0f}%) — revenue unknown",
                    "confidence": 0.20,
                })

    # ── 11. Service mix predictions ───────────────────────────────────────────
    service_mix = service_mix_prediction(clinic_type)
    svc_conf = 0.56 if clinic_type != "unknown" else 0.33
    if clinic_type in {"skin", "both", "unknown"}:
        for k, v in service_mix.items():
            if k in schema["service_mix_skin"] and schema["service_mix_skin"][k] is None:
                schema["service_mix_skin"][k] = field_object(v, "predicted", svc_conf)
                predictions_log.append({
                    "field": f"service_mix_skin.{k}",
                    "method": f"{clinic_type} service mix baseline",
                    "confidence": svc_conf,
                })
    if clinic_type in {"dental", "both", "unknown"}:
        for k, v in service_mix.items():
            if k in schema["service_mix_dental"] and schema["service_mix_dental"][k] is None:
                schema["service_mix_dental"][k] = field_object(v, "predicted", svc_conf)
                predictions_log.append({
                    "field": f"service_mix_dental.{k}",
                    "method": f"{clinic_type} service mix baseline",
                    "confidence": svc_conf,
                })

    # ── 12. Patient mix fallbacks ─────────────────────────────────────────────
    if schema["patient_mix"]["new_vs_repeat_patient_mix"] is None:
        repeat = 38.0 if clinic_type == "skin" else 46.0 if clinic_type == "dental" else 40.0
        schema["patient_mix"]["new_vs_repeat_patient_mix"] = field_object(repeat, "predicted", 0.42)
        predictions_log.append({
            "field": "patient_mix.new_vs_repeat_patient_mix",
            "method": "industry repeat patient baseline",
            "confidence": 0.42,
        })
    if schema["patient_mix"]["walkin_vs_appointment_mix"] is None:
        appt = 70.0 if clinic_type in {"skin", "dental", "both"} else 60.0
        schema["patient_mix"]["walkin_vs_appointment_mix"] = field_object(appt, "predicted", 0.40)
        predictions_log.append({
            "field": "patient_mix.walkin_vs_appointment_mix",
            "method": "appointment share baseline",
            "confidence": 0.40,
        })
    if schema["patient_mix"]["corporate_vs_retail_patient_mix"] is None:
        schema["patient_mix"]["corporate_vs_retail_patient_mix"] = field_object(90.0, "predicted", 0.35)
        predictions_log.append({
            "field": "patient_mix.corporate_vs_retail_patient_mix",
            "method": "retail-heavy clinic baseline",
            "confidence": 0.35,
        })

    # ── 13. Confidence summary ────────────────────────────────────────────────
    total_leaf = scraped_count = predicted_count = 0
    conf_sum = 0.0

    def walk(obj: Any) -> None:
        nonlocal total_leaf, scraped_count, predicted_count, conf_sum
        if isinstance(obj, dict) and "value" in obj and "source" in obj:
            total_leaf += 1
            conf_sum += float(obj.get("confidence", 0.0))
            if obj["source"] == "scraped":
                scraped_count += 1
            elif obj["source"] == "predicted":
                predicted_count += 1
        elif isinstance(obj, dict):
            for v in obj.values():
                walk(v)

    for section in ("financials", "operational", "patient_metrics",
                    "dental_specific", "patient_mix",
                    "service_mix_skin", "service_mix_dental"):
        walk(schema[section])

    if total_leaf > 0:
        raw_mean = conf_sum / total_leaf
        overall_confidence = round(min(raw_mean + scrape_ratio * 0.10, 0.97), 3)
    else:
        overall_confidence = 0.0

    schema["metadata"]["overall_confidence"] = overall_confidence

    # ── 14. Enforce minimum analysis time ────────────────────────────────────
    elapsed = time.monotonic() - t_start
    if elapsed < MIN_SCRAPE_SECONDS:
        await asyncio.sleep(MIN_SCRAPE_SECONDS - elapsed)

    return {
        "success": True,
        "url": url,
        "clinic_type": clinic_type,
        "scraped_at": schema["metadata"]["scraped_at"],
        "data": schema,
        "predictions_log": predictions_log,
        "scrape_summary": {
            "total_fields":       total_leaf,
            "scraped_fields":     scraped_count,
            "predicted_fields":   predicted_count,
            "overall_confidence": overall_confidence,
            "used_playwright":    used_playwright,
            "pages_crawled":      pages_crawled,
            "subpages_found":     subpage_candidates,
            "elapsed_seconds":    round(time.monotonic() - t_start, 1),
        },
    }