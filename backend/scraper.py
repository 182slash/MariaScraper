from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

try:
    from playwright.async_api import async_playwright
except Exception:  # pragma: no cover - optional in environments without Playwright runtime
    async_playwright = None  # type: ignore

from .models import field_object, utc_now_iso
from .predictor import (
    default_city_split,
    infer_clinic_type,
    predict_numeric,
    service_mix_prediction,
)


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

SKIN_KEYWORDS = [
    "skin", "skincare", "aesthetic", "beauty", "derma", "dermatology",
    "acne", "facial", "botox", "filler", "threadlift", "laser", "hair removal",
]
DENTAL_KEYWORDS = [
    "dental", "dentist", "dentistry", "gigi", "orthodont", "braces", "veneer",
    "implant", "implan", "scaling", "endodont", "periodont", "prosthodont", "pedodont",
]


def make_base_schema() -> Dict[str, Any]:
    return {
        "financials": {
            "revenue": None,
            "number_of_outlets": None,
            "revenue_per_outlet": None,
            "revenue_per_city": {
                "dki_jakarta": None,
                "surabaya": None,
                "banten": None,
            },
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
        },
    }


def _domain(url: str) -> str:
    return urlparse(url).netloc.lower()


def _clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _currency_to_idr(text: str) -> Optional[float]:
    if not text:
        return None
    s = text.lower().replace(",", "").replace(" ", "")
    m = re.search(r"(rp|idr)\s*([0-9]+(?:\.[0-9]+)?)\s*(miliar|million|jt|juta|rb|ribu|k|b|bn|m)?", s)
    if not m:
        m = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(miliar|million|jt|juta|rb|ribu|k|b|bn|m)\b", s)
        if not m:
            return None
        num = float(m.group(1))
        unit = m.group(2)
    else:
        num = float(m.group(2))
        unit = m.group(3)
    mult = 1.0
    if unit in {"miliar", "b", "bn"}:
        mult = 1_000_000_000.0
    elif unit in {"million", "m"}:
        mult = 1_000_000.0
    elif unit in {"jt", "juta", "k"}:
        mult = 1_000_000.0 if unit in {"jt", "juta"} else 1_000.0
    elif unit in {"rb", "ribu"}:
        mult = 1_000.0
    return num * mult


def _percent_from_text(text: str) -> Optional[float]:
    if not text:
        return None
    m = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*%", text)
    if m:
        return float(m.group(1))
    return None


def _int_from_text(text: str) -> Optional[int]:
    if not text:
        return None
    s = text.lower().replace(",", "")
    m = re.search(r"([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]+)", s)
    if not m:
        return None
    num = m.group(1).replace(".", "")
    try:
        return int(num)
    except ValueError:
        return None


def _find_context_value(text: str, aliases: List[str], value_type: str) -> Optional[Any]:
    for alias in aliases:
        pattern = rf"({re.escape(alias)}[^.\n:{{}}]{{0,140}})"
        for m in re.finditer(pattern, text, flags=re.I):
            chunk = m.group(1)
            if value_type == "currency":
                val = _currency_to_idr(chunk)
                if val is not None:
                    return val
            elif value_type == "percent":
                val = _percent_from_text(chunk)
                if val is not None:
                    return val
            else:
                val = _int_from_text(chunk)
                if val is not None:
                    return val
    return None


def _jsonld_objects(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(script.get_text(strip=True))
        except Exception:
            continue
        if isinstance(data, dict):
            out.append(data)
        elif isinstance(data, list):
            out.extend([x for x in data if isinstance(x, dict)])
    return out


def _extract_meta(soup: BeautifulSoup) -> Dict[str, str]:
    data = {}
    for tag in soup.find_all("meta"):
        key = tag.get("property") or tag.get("name")
        content = tag.get("content")
        if key and content:
            data[key.lower()] = content.strip()
    return data


def _page_title(soup: BeautifulSoup) -> str:
    if soup.title and soup.title.get_text(strip=True):
        return _clean_text(soup.title.get_text(" ", strip=True))
    return ""


async def fetch_html(url: str, timeout_s: int = 30) -> Tuple[str, str, bool]:
    """
    Returns (html, final_url, used_playwright)
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }

    if async_playwright is not None:
        browser = None
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-dev-shm-usage"],
                )
                page = await browser.new_page(
                    user_agent=USER_AGENT,
                    locale="en-US",
                    extra_http_headers=headers,
                    viewport={"width": 1366, "height": 900},
                )
                await page.goto(url, wait_until="networkidle", timeout=timeout_s * 1000)
                html = await page.content()
                final_url = page.url
                await browser.close()
                return html, final_url, True
        except Exception:
            try:
                if browser is not None:
                    await browser.close()
            except Exception:
                pass

    try:
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=timeout_s) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.text, str(resp.url), False
    except Exception:
        # Return an empty document so the caller can still produce partial
        # results through inference and cached predictions.
        return "", url, False


def extract_fields_from_text(text: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    text_clean = _clean_text(text)
    aliases = {
        "revenue": ["revenue", "pendapatan", "omzet", "sales", "turnover"],
        "number_of_outlets": ["outlet", "cabang", "branch", "clinic", "klinik"],
        "number_of_doctors": ["doctor", "dokter", "physician", "medical team"],
        "number_of_dentists": ["dentist", "dokter gigi", "drg"],
        "number_of_therapists": ["therapist", "terapis", "aesthetic therapist", "beauty therapist"],
        "number_of_treatment_rooms": ["treatment room", "room", "ruang perawatan", "ruangan"],
        "number_of_dental_chairs": ["dental chair", "chair", "kursi dental", "unit chair"],
        "total_patients": ["patients", "pasien", "patient"],
        "new_patients_per_month": ["new patients", "pasien baru"],
        "patient_retention_rate": ["retention", "repeat"],
        "visit_frequency_per_patient_per_year": ["visit frequency", "visits per patient", "kunjungan per pasien"],
        "nps_score": ["nps", "net promoter score"],
        "average_waiting_time": ["waiting time", "waktu tunggu"],
        "doctor_utilization": ["utilization", "occupancy"],
        "patient_per_doctor_per_day": ["patients per doctor per day", "pasien per dokter per hari"],
        "dentist_utilization": ["dentist utilization", "utilization"],
        "chair_utilization": ["chair utilization"],
        "visits_per_chair_per_day": ["visits per chair per day"],
        "patient_per_dentist_per_day": ["patients per dentist per day"],
        "average_treatment_duration": ["average treatment duration", "durasi tindakan"],
        "appointment_slot_utilization": ["appointment slot utilization"],
        "customer_acquisition_cost_cac": ["cac", "customer acquisition cost", "biaya akuisisi"],
        "customer_lifetime_value_ltv": ["ltv", "lifetime value"],
        "ebitda_margin": ["ebitda margin", "ebitda"],
        "gross_margin": ["gross margin"],
        "average_transaction_value": ["average transaction value", "atv", "nilai transaksi"],
        "membership_package_penetration": ["membership", "package penetration", "subscription"],
        "marketing_spend": ["marketing spend", "marketing expense", "biaya pemasaran"],
        "investment_per_clinic": ["investment", "capex", "fit out"],
    }

    currency_fields = {
        "revenue",
        "revenue_per_outlet",
        "revenue_per_city",
        "revenue_per_patient",
        "revenue_per_visit",
        "revenue_per_doctor_dentist_therapist",
        "revenue_per_treatment_room",
        "revenue_per_dental_chair",
        "customer_acquisition_cost_cac",
        "customer_lifetime_value_ltv",
        "average_transaction_value",
        "investment_per_clinic",
    }
    percent_fields = {
        "doctor_utilization",
        "dentist_utilization",
        "chair_utilization",
        "patient_retention_rate",
        "nps_score",
        "appointment_slot_utilization",
        "membership_package_penetration",
        "marketing_spend",
    }
    int_fields = {
        "number_of_outlets",
        "number_of_doctors",
        "number_of_dentists",
        "number_of_therapists",
        "number_of_treatment_rooms",
        "number_of_dental_chairs",
        "patient_per_doctor_per_day",
        "patient_per_dentist_per_day",
        "visits_per_chair_per_day",
        "new_patients_per_month",
        "total_patients",
        "average_waiting_time",
        "visit_frequency_per_patient_per_year",
        "average_treatment_duration",
        "operating_days_per_year",
        "opening_hours_per_day",
    }

    # Generic field extraction using context windows.
    for field, field_aliases in aliases.items():
        val = None
        if field in currency_fields:
            val = _find_context_value(text_clean, field_aliases, "currency")
        elif field in percent_fields:
            val = _find_context_value(text_clean, field_aliases, "percent")
        elif field in int_fields:
            val = _find_context_value(text_clean, field_aliases, "int")
        if val is not None:
            out[field] = val

    # Direct revenue mentions in JSON/structured text may appear as "IDR 12.3B"
    if "revenue" not in out:
        rev = _currency_to_idr(text_clean)
        if rev and rev > 100000:
            out["revenue"] = rev

    # Some likely ratios from phrasing.
    for key in ["marketing_spend", "membership_package_penetration"]:
        if key not in out:
            p = _percent_from_text(text_clean)
            if p is not None and "membership" in text_clean.lower():
                out[key] = p

    return out


def _extract_service_mix_from_text(text: str, clinic_type: str) -> Dict[str, Any]:
    t = text.lower()
    out: Dict[str, Any] = {}

    if clinic_type in {"skin", "both"}:
        keywords = {
            "skin_health_pct": ["skin", "acne", "facial", "glow", "derma"],
            "injectables_antiaging_pct": ["botox", "filler", "threadlift", "injectable"],
            "body_aesthetics_pct": ["slimming", "body", "whitening"],
            "hair_solutions_pct": ["hair", "hair treatment"],
            "non_doctor_treatments_pct": ["therapist", "non-doctor", "non doctor"],
            "other_services_skin_pct": ["service", "treatment"],
        }
        for field, kws in keywords.items():
            if any(k in t for k in kws):
                out[field] = None  # indicate observed, but not quantified
    if clinic_type in {"dental", "both"}:
        keywords = {
            "scaling_pct": ["scaling"],
            "fillings_pct": ["filling"],
            "braces_pct": ["braces", "orthodont"],
            "veneers_pct": ["veneer"],
            "endodontics_pct": ["endodont"],
            "periodontics_pct": ["periodont"],
            "prosthodontics_pct": ["prosthodont"],
            "pedodontics_pct": ["pedodont"],
            "other_services_dental_pct": ["dental"],
        }
        for field, kws in keywords.items():
            if any(k in t for k in kws):
                out[field] = None
    return out


def _detect_city_presence(text: str) -> Dict[str, float]:
    t = text.lower()
    weights = {}
    # Simple fallback; if one city mentioned, favor it heavily.
    if "jakarta" in t:
        weights["dki_jakarta"] = 70.0
    if "surabaya" in t:
        weights["surabaya"] = 70.0
    if "banten" in t or "tangerang" in t or "bsd" in t:
        weights["banten"] = 70.0
    if not weights:
        return default_city_split()
    remaining = 100.0 - sum(weights.values())
    missing = [k for k in ["dki_jakarta", "surabaya", "banten"] if k not in weights]
    if missing:
        share = remaining / len(missing)
        for k in missing:
            weights[k] = round(share, 2)
    return weights


def _count_scraped_fields(schema: Dict[str, Any]) -> int:
    count = 0
    for cat_key, cat_val in schema.items():
        if cat_key == "metadata":
            continue
        if isinstance(cat_val, dict):
            for v in cat_val.values():
                if isinstance(v, dict):
                    count += _count_scraped_fields(v) if any(isinstance(x, dict) for x in v.values()) else 1
                else:
                    count += 1
    return count


def _all_leaf_paths(schema: Dict[str, Any], prefix: str = "") -> List[str]:
    paths = []
    for k, v in schema.items():
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict) and v and all(isinstance(x, dict) for x in v.values()) is False and any(isinstance(x, dict) for x in v.values()):
            paths.extend(_all_leaf_paths(v, path))
        elif isinstance(v, dict):
            # For category dicts where values are None
            for kk in v:
                if isinstance(v[kk], dict):
                    paths.extend(_all_leaf_paths(v[kk], f"{path}.{kk}"))
                else:
                    paths.append(f"{path}.{kk}")
        else:
            paths.append(path)
    return paths


def _leaf_count(schema: Dict[str, Any]) -> int:
    return len(_all_leaf_paths(schema))


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


async def scrape_url(url: str) -> Dict[str, Any]:
    html, final_url, used_playwright = await fetch_html(url)
    soup = BeautifulSoup(html, "lxml")
    text = _clean_text(soup.get_text(" ", strip=True))
    page_title = _page_title(soup)
    meta = _extract_meta(soup)
    jsonlds = _jsonld_objects(soup)

    schema = make_base_schema()
    schema["metadata"]["url"] = url
    schema["metadata"]["page_title"] = page_title
    schema["metadata"]["scraped_at"] = utc_now_iso()

    # Clinic type from combined signals.
    clinic_type = infer_clinic_type(f"{page_title} {text}", url=url)
    schema["metadata"]["clinic_type"] = clinic_type

    scraped_fields: Dict[str, float] = {}
    predictions_log: List[Dict[str, Any]] = []

    # 1) Scrape from text/meta/jsonld.
    observed = {}
    observed.update(extract_fields_from_text(text))
    observed.update(extract_fields_from_text(" ".join(meta.values())))

    for obj in jsonlds:
        observed.update(extract_fields_from_text(json.dumps(obj, ensure_ascii=False)))

    # 2) Specific number extraction from page title/meta snippets.
    # Outlet/room/chair etc. may appear in structured content.
    if "number_of_outlets" not in observed:
        for key in ["outlet", "cabang", "branch"]:
            m = re.search(rf"([0-9]+)\s+{key}s?\b", text, flags=re.I)
            if m:
                observed["number_of_outlets"] = int(m.group(1))
                break
    if "number_of_dental_chairs" not in observed and clinic_type in {"dental", "both"}:
        m = re.search(r"([0-9]+)\s+(dental chairs?|chairs?)\b", text, flags=re.I)
        if m:
            observed["number_of_dental_chairs"] = int(m.group(1))

    # 3) Populate scraped values.
    path_alias_map = {
        "financials.revenue": "revenue",
        "financials.number_of_outlets": "number_of_outlets",
        "financials.revenue_per_outlet": "revenue_per_outlet",
        "financials.revenue_per_patient": "revenue_per_patient",
        "financials.revenue_per_visit": "revenue_per_visit",
        "financials.revenue_per_doctor_dentist_therapist": "revenue_per_doctor_dentist_therapist",
        "financials.revenue_per_treatment_room": "revenue_per_treatment_room",
        "financials.revenue_per_dental_chair": "revenue_per_dental_chair",
        "financials.customer_acquisition_cost_cac": "customer_acquisition_cost_cac",
        "financials.customer_lifetime_value_ltv": "customer_lifetime_value_ltv",
        "financials.ebitda_margin": "ebitda_margin",
        "financials.gross_margin": "gross_margin",
        "financials.average_transaction_value": "average_transaction_value",
        "financials.membership_package_penetration": "membership_package_penetration",
        "financials.marketing_spend": "marketing_spend",
        "financials.investment_per_clinic": "investment_per_clinic",

        "operational.number_of_doctors": "number_of_doctors",
        "operational.number_of_dentists": "number_of_dentists",
        "operational.number_of_therapists": "number_of_therapists",
        "operational.doctor_utilization": "doctor_utilization",
        "operational.patient_per_doctor_per_day": "patient_per_doctor_per_day",
        "operational.number_of_treatment_rooms": "number_of_treatment_rooms",
        "operational.opening_hours_per_day": "opening_hours_per_day",
        "operational.operating_days_per_year": "operating_days_per_year",

        "patient_metrics.total_patients": "total_patients",
        "patient_metrics.new_patients_per_month": "new_patients_per_month",
        "patient_metrics.patient_retention_rate": "patient_retention_rate",
        "patient_metrics.visit_frequency_per_patient_per_year": "visit_frequency_per_patient_per_year",
        "patient_metrics.nps_score": "nps_score",
        "patient_metrics.average_waiting_time": "average_waiting_time",

        "dental_specific.dentist_utilization": "dentist_utilization",
        "dental_specific.chair_utilization": "chair_utilization",
        "dental_specific.visits_per_chair_per_day": "visits_per_chair_per_day",
        "dental_specific.patient_per_dentist_per_day": "patient_per_dentist_per_day",
        "dental_specific.average_treatment_duration": "average_treatment_duration",
        "dental_specific.appointment_slot_utilization": "appointment_slot_utilization",
        "dental_specific.number_of_dental_chairs": "number_of_dental_chairs",
    }

    for path, key in path_alias_map.items():
        if key in observed and observed[key] is not None:
            val = observed[key]
            if isinstance(val, float):
                val = round(val, 2)
            _set_by_path(schema, path, field_object(val, "scraped", 0.90))
            scraped_fields[path] = 0.90

    # 4) Revenue per city if any city signals
    city_split = _detect_city_presence(f"{text} {page_title}")
    if any(v is not None for v in schema["financials"]["revenue_per_city"].values()):
        pass
    else:
        # leave for prediction stage
        schema["financials"]["revenue_per_city"] = {
            "dki_jakarta": None,
            "surabaya": None,
            "banten": None,
        }

    # 5) Patient mix: scrape direct mentions, otherwise leave.
    mix_text = text.lower()
    repeat = None
    if "repeat" in mix_text or "returning" in mix_text or "revisit" in mix_text:
        repeat = 60.0 if "high" in mix_text else 50.0
    if repeat is not None:
        schema["patient_mix"]["new_vs_repeat_patient_mix"] = field_object(repeat, "scraped", 0.42)
        scraped_fields["patient_mix.new_vs_repeat_patient_mix"] = 0.42

    if "appointment" in mix_text and "walk-in" in mix_text or "walk in" in mix_text:
        schema["patient_mix"]["walkin_vs_appointment_mix"] = field_object(65.0, "scraped", 0.40)
        scraped_fields["patient_mix.walkin_vs_appointment_mix"] = 0.40

    if "corporate" in mix_text or "insurance" in mix_text or "bpjs" in mix_text:
        schema["patient_mix"]["corporate_vs_retail_patient_mix"] = field_object(25.0, "scraped", 0.40)
        scraped_fields["patient_mix.corporate_vs_retail_patient_mix"] = 0.40

    # 6) Service mix observed terms.
    observed_mix = _extract_service_mix_from_text(f"{text} {json.dumps(meta)}", clinic_type)
    for group, fields in [("service_mix_skin", observed_mix), ("service_mix_dental", observed_mix)]:
        for k in fields:
            if k in schema[group]:
                schema[group][k] = field_object(None, "scraped", 0.35)

    # Prediction / derivation engine for missing fields.
    known_flat: Dict[str, Any] = {}
    # Populate known values from scraped fields (raw values)
    def collect_known():
        for cat, data in schema.items():
            if cat == "metadata":
                continue
            if isinstance(data, dict):
                for k, v in data.items():
                    if isinstance(v, dict) and "value" in v:
                        known_flat[k] = v["value"]
                    elif isinstance(v, dict):
                        # nested city fields
                        for kk, vv in v.items():
                            if isinstance(vv, dict) and "value" in vv:
                                known_flat[f"{k}.{kk}"] = vv["value"]
    collect_known()

    # Predict core leaf fields where missing.
    def fill_numeric(path: str, key: str, unit: Optional[str] = None):
        current = _get_by_path(schema, path)
        if isinstance(current, dict) and current.get("source") == "scraped":
            return
        value, confidence, method = predict_numeric(
            field=key,
            clinic_type=clinic_type,
            known=known_flat,
            method_log=predictions_log,
        )
        if confidence > 0:
            _set_by_path(schema, path, field_object(value, "predicted", confidence, unit=unit))
            known_flat[key] = value
            predictions_log.append({"field": path, "method": method, "confidence": round(confidence, 3)})

    currency_paths = [
        ("financials.revenue", "revenue"),
        ("financials.number_of_outlets", "number_of_outlets"),
        ("financials.revenue_per_outlet", "revenue_per_outlet"),
        ("financials.revenue_per_patient", "revenue_per_patient"),
        ("financials.revenue_per_visit", "revenue_per_visit"),
        ("financials.revenue_per_doctor_dentist_therapist", "revenue_per_doctor_dentist_therapist"),
        ("financials.revenue_per_treatment_room", "revenue_per_treatment_room"),
        ("financials.revenue_per_dental_chair", "revenue_per_dental_chair"),
        ("financials.customer_acquisition_cost_cac", "customer_acquisition_cost_cac"),
        ("financials.customer_lifetime_value_ltv", "customer_lifetime_value_ltv"),
        ("financials.average_transaction_value", "average_transaction_value"),
        ("financials.investment_per_clinic", "investment_per_clinic"),
    ]
    percent_paths = [
        ("financials.ebitda_margin", "ebitda_margin"),
        ("financials.gross_margin", "gross_margin"),
        ("financials.membership_package_penetration", "membership_package_penetration"),
        ("financials.marketing_spend", "marketing_spend"),
        ("operational.doctor_utilization", "doctor_utilization"),
        ("patient_metrics.patient_retention_rate", "patient_retention_rate"),
        ("dental_specific.dentist_utilization", "dentist_utilization"),
        ("dental_specific.chair_utilization", "chair_utilization"),
        ("dental_specific.appointment_slot_utilization", "appointment_slot_utilization"),
    ]
    count_paths = [
        ("operational.patient_per_doctor_per_day", "patient_per_doctor_per_day"),
        ("operational.opening_hours_per_day", "opening_hours_per_day"),
        ("operational.operating_days_per_year", "operating_days_per_year"),
        ("patient_metrics.visit_frequency_per_patient_per_year", "visit_frequency_per_patient_per_year"),
        ("patient_metrics.nps_score", "nps_score"),
        ("patient_metrics.average_waiting_time", "average_waiting_time"),
        ("dental_specific.visits_per_chair_per_day", "visits_per_chair_per_day"),
        ("dental_specific.patient_per_dentist_per_day", "patient_per_dentist_per_day"),
        ("dental_specific.average_treatment_duration", "average_treatment_duration"),
    ]
    int_paths = [
        ("operational.number_of_doctors", "number_of_doctors"),
        ("operational.number_of_dentists", "number_of_dentists"),
        ("operational.number_of_therapists", "number_of_therapists"),
        ("operational.number_of_treatment_rooms", "number_of_treatment_rooms"),
        ("dental_specific.number_of_dental_chairs", "number_of_dental_chairs"),
        ("patient_metrics.total_patients", "total_patients"),
        ("patient_metrics.new_patients_per_month", "new_patients_per_month"),
    ]

    for path, key in int_paths:
        fill_numeric(path, key)
    for path, key in currency_paths:
        fill_numeric(path, key, unit="IDR")
    for path, key in percent_paths:
        fill_numeric(path, key, unit="%")
    for path, key in count_paths:
        unit = "hours" if key == "opening_hours_per_day" else "days" if key == "operating_days_per_year" else "score" if key == "nps_score" else "minutes" if key in {"average_waiting_time", "average_treatment_duration"} else "count"
        fill_numeric(path, key, unit=unit)

    # Special values not directly derived above.
    if schema["financials"]["revenue_per_city"]["dki_jakarta"] is None:
        if known_flat.get("revenue"):
            split = city_split
            rev = float(known_flat["revenue"])
            for city, pct in split.items():
                schema["financials"]["revenue_per_city"][city] = field_object(round(rev * pct / 100), "predicted", 0.52, unit="IDR")
                predictions_log.append({"field": f"financials.revenue_per_city.{city}", "method": f"city-share baseline ({pct:.0f}% of revenue)", "confidence": 0.52})
        else:
            split = city_split
            for city, pct in split.items():
                schema["financials"]["revenue_per_city"][city] = field_object(None, "predicted", 0.20, unit="IDR")
                predictions_log.append({"field": f"financials.revenue_per_city.{city}", "method": f"city-share baseline ({pct:.0f}% of revenue) but revenue missing", "confidence": 0.20})

    # Service mix predictions.
    service_mix = service_mix_prediction(clinic_type)
    if clinic_type in {"skin", "both"}:
        for k, v in service_mix.items():
            if k in schema["service_mix_skin"]:
                schema["service_mix_skin"][k] = field_object(v, "predicted", 0.56)
                predictions_log.append({"field": f"service_mix_skin.{k}", "method": f"{clinic_type} service mix baseline", "confidence": 0.56})
    if clinic_type in {"dental", "both"}:
        for k, v in service_mix.items():
            if k in schema["service_mix_dental"]:
                schema["service_mix_dental"][k] = field_object(v, "predicted", 0.56)
                predictions_log.append({"field": f"service_mix_dental.{k}", "method": f"{clinic_type} service mix baseline", "confidence": 0.56})
    if clinic_type == "unknown":
        # provide a combined baseline split with lower confidence
        skin = {k: v for k, v in service_mix.items() if k in schema["service_mix_skin"]}
        dental = {k: v for k, v in service_mix.items() if k in schema["service_mix_dental"]}
        for k, v in skin.items():
            schema["service_mix_skin"][k] = field_object(v, "predicted", 0.33)
            predictions_log.append({"field": f"service_mix_skin.{k}", "method": "generic mixed-clinic baseline", "confidence": 0.33})
        for k, v in dental.items():
            schema["service_mix_dental"][k] = field_object(v, "predicted", 0.33)
            predictions_log.append({"field": f"service_mix_dental.{k}", "method": "generic mixed-clinic baseline", "confidence": 0.33})

    # Fill patient mix if absent.
    if schema["patient_mix"]["new_vs_repeat_patient_mix"] is None:
        repeat = 38.0 if clinic_type == "skin" else 46.0 if clinic_type == "dental" else 40.0
        schema["patient_mix"]["new_vs_repeat_patient_mix"] = field_object(repeat, "predicted", 0.42)
        predictions_log.append({"field": "patient_mix.new_vs_repeat_patient_mix", "method": "industry repeat patient baseline", "confidence": 0.42})
    if schema["patient_mix"]["walkin_vs_appointment_mix"] is None:
        appt = 70.0 if clinic_type in {"skin", "dental", "both"} else 60.0
        schema["patient_mix"]["walkin_vs_appointment_mix"] = field_object(appt, "predicted", 0.40)
        predictions_log.append({"field": "patient_mix.walkin_vs_appointment_mix", "method": "appointment share baseline", "confidence": 0.40})
    if schema["patient_mix"]["corporate_vs_retail_patient_mix"] is None:
        retail = 90.0
        schema["patient_mix"]["corporate_vs_retail_patient_mix"] = field_object(retail, "predicted", 0.35)
        predictions_log.append({"field": "patient_mix.corporate_vs_retail_patient_mix", "method": "retail-heavy clinic baseline", "confidence": 0.35})

    # Fill metadata clinic type if still unknown.
    schema["metadata"]["clinic_type"] = clinic_type
    schema["metadata"]["page_title"] = page_title
    schema["metadata"]["url"] = final_url or url

    # Confidence summary.
    total_leaf = 0
    scraped_count = 0
    predicted_count = 0
    conf_sum = 0.0

    def walk(obj: Any):
        nonlocal total_leaf, scraped_count, predicted_count, conf_sum
        if isinstance(obj, dict) and "value" in obj and "source" in obj:
            total_leaf += 1
            conf_sum += float(obj.get("confidence", 0.0))
            if obj.get("source") == "scraped":
                scraped_count += 1
            elif obj.get("source") == "predicted":
                predicted_count += 1
        elif isinstance(obj, dict):
            for v in obj.values():
                walk(v)

    walk(schema["financials"])
    walk(schema["operational"])
    walk(schema["patient_metrics"])
    walk(schema["dental_specific"])
    walk(schema["patient_mix"])
    walk(schema["service_mix_skin"])
    walk(schema["service_mix_dental"])
    # metadata excluded from counts.
    overall_confidence = round(conf_sum / max(total_leaf, 1), 3)
    schema["metadata"]["overall_confidence"] = overall_confidence

    result = {
        "success": True,
        "url": url,
        "clinic_type": clinic_type,
        "scraped_at": schema["metadata"]["scraped_at"],
        "data": schema,
        "predictions_log": predictions_log,
        "scrape_summary": {
            "total_fields": total_leaf,
            "scraped_fields": scraped_count,
            "predicted_fields": predicted_count,
            "overall_confidence": overall_confidence,
            "used_playwright": used_playwright,
        },
    }
    return result
