from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


# ── Service mix baselines ─────────────────────────────────────────────────────

SKIN_SERVICE_MIX = {
    "skin_health_pct": 28,
    "injectables_antiaging_pct": 27,
    "body_aesthetics_pct": 18,
    "hair_solutions_pct": 8,
    "non_doctor_treatments_pct": 13,
    "other_services_skin_pct": 6,
}

DENTAL_SERVICE_MIX = {
    "scaling_pct": 12,
    "fillings_pct": 16,
    "braces_pct": 18,
    "veneers_pct": 10,
    "endodontics_pct": 10,
    "periodontics_pct": 8,
    "prosthodontics_pct": 9,
    "pedodontics_pct": 7,
    "other_services_dental_pct": 10,
}

# Penalty applied to confidence when a derived field relies on another
# predicted (not scraped) value.
_PREDICTION_HOP_PENALTY = 0.12

# Module-level set; MUST be reset at the start of each scrape_url call.
_predicted_keys: set[str] = set()


def reset_prediction_registry() -> None:
    """
    MUST be called at the start of every scrape_url() invocation.
    Without this, predicted keys from run N bleed into run N+1,
    corrupting hop-penalty calculations across separate scrapes.
    """
    _predicted_keys.clear()


def mark_predicted(key: str) -> None:
    _predicted_keys.add(key)


def _is_predicted(key: str) -> bool:
    return key in _predicted_keys


def _hop_penalty(*dep_keys: str) -> float:
    return _PREDICTION_HOP_PENALTY * sum(1 for k in dep_keys if _is_predicted(k))


# ── Utility ───────────────────────────────────────────────────────────────────

def _scale_mix(mix: Dict[str, float], target: float = 100.0) -> Dict[str, float]:
    total = float(sum(mix.values()))
    if total == 0:
        return mix
    factor = target / total
    return {k: round(v * factor, 2) for k, v in mix.items()}


def infer_clinic_type(text: str, url: str = "") -> str:
    t = f"{text} {url}".lower()
    skin_hits = [
        "skincare", "skin", "aesthetic", "estetik", "beauty", "derma",
        "dermatology", "acne", "facial", "botox", "filler", "threadlift",
        "glow", "laser", "hair removal",
    ]
    dental_hits = [
        "dental", "dentist", "dentistry", "gigi", "orthodont", "braces",
        "veneer", "implan", "implant", "scaling", "endodont", "periodont",
        "prosthodont", "pedodont",
    ]
    skin   = any(h in t for h in skin_hits)
    dental = any(h in t for h in dental_hits)
    if skin and dental:
        return "both"
    if skin:
        return "skin"
    if dental:
        return "dental"
    return "unknown"


def default_city_split() -> Dict[str, float]:
    return {"dki_jakarta": 55.0, "surabaya": 25.0, "banten": 20.0}


# ── Core predictor ────────────────────────────────────────────────────────────

def predict_numeric(
    *,
    field: str,
    clinic_type: str,
    known: Dict[str, Any],
    method_log: List[Dict[str, Any]],
    scrape_ratio: float = 0.0,
) -> Tuple[float | int, float, str]:
    """
    Returns (value, confidence, method).
    """
    revenue    = known.get("revenue")
    outlets    = known.get("number_of_outlets")
    patients   = known.get("total_patients")
    visits_y   = known.get("visit_frequency_per_patient_per_year")
    doctors    = known.get("number_of_doctors")
    dentists   = known.get("number_of_dentists")
    therapists = known.get("number_of_therapists")
    rooms      = known.get("number_of_treatment_rooms")
    chairs     = known.get("number_of_dental_chairs")
    atv        = known.get("average_transaction_value")

    _sr_bonus = scrape_ratio * 0.08

    # ── Derived financial fields ──────────────────────────────────────────────
    if field == "revenue_per_outlet" and revenue and outlets:
        conf = 0.95 - _hop_penalty("revenue", "number_of_outlets") + _sr_bonus
        return round(revenue / max(outlets, 1)), min(conf, 0.95), "revenue ÷ outlets"

    if field == "revenue_per_patient" and revenue and patients:
        conf = 0.92 - _hop_penalty("revenue", "total_patients") + _sr_bonus
        return round(revenue / max(patients, 1)), min(conf, 0.92), "revenue ÷ patients"

    if field == "revenue_per_visit" and revenue and patients and visits_y:
        visits = max(patients * visits_y, 1)
        conf = 0.84 - _hop_penalty("revenue", "total_patients", "visit_frequency_per_patient_per_year") + _sr_bonus
        return round(revenue / visits), min(conf, 0.84), "revenue ÷ estimated annual visits"

    if field == "revenue_per_doctor_dentist_therapist":
        staff = sum(
            x for x in [doctors, dentists, therapists]
            if isinstance(x, (int, float)) and x > 0
        )
        if revenue and staff:
            conf = 0.88 - _hop_penalty("revenue", "number_of_doctors", "number_of_dentists", "number_of_therapists") + _sr_bonus
            return round(revenue / staff), min(conf, 0.88), "revenue ÷ clinical staff"

    if field == "revenue_per_treatment_room" and revenue and rooms:
        conf = 0.90 - _hop_penalty("revenue", "number_of_treatment_rooms") + _sr_bonus
        return round(revenue / max(rooms, 1)), min(conf, 0.90), "revenue ÷ treatment rooms"

    if field == "revenue_per_dental_chair" and revenue and chairs:
        conf = 0.90 - _hop_penalty("revenue", "number_of_dental_chairs") + _sr_bonus
        return round(revenue / max(chairs, 1)), min(conf, 0.90), "revenue ÷ dental chairs"

    # ── Margins ───────────────────────────────────────────────────────────────
    if field == "gross_margin":
        base, method = {
            "skin":   (58.0, "skin clinic gross margin baseline"),
            "dental": (52.0, "dental clinic gross margin baseline"),
            "both":   (55.0, "blended clinic gross margin baseline"),
        }.get(clinic_type, (50.0, "generic clinic gross margin baseline"))
        conf = {"skin": 0.72, "dental": 0.72, "both": 0.68}.get(clinic_type, 0.55) + _sr_bonus
        return base, min(conf, 0.80), method

    if field == "ebitda_margin":
        base, method = {
            "skin":   (20.0, "skin clinic EBITDA baseline"),
            "dental": (18.0, "dental clinic EBITDA baseline"),
            "both":   (19.0, "blended EBITDA baseline"),
        }.get(clinic_type, (17.0, "generic EBITDA baseline"))
        conf = {"skin": 0.70, "dental": 0.70, "both": 0.66}.get(clinic_type, 0.52) + _sr_bonus
        return base, min(conf, 0.78), method

    if field == "marketing_spend":
        base, method = {
            "skin":   (12.0, "skin clinic marketing ratio baseline"),
            "dental": (9.0,  "dental clinic marketing ratio baseline"),
        }.get(clinic_type, (10.0, "generic marketing ratio baseline"))
        conf = {"skin": 0.64, "dental": 0.62}.get(clinic_type, 0.50) + _sr_bonus
        return base, min(conf, 0.72), method

    # ── CAC / LTV ─────────────────────────────────────────────────────────────
    if field == "customer_acquisition_cost_cac":
        base, method = {
            "skin":   (350_000, "skin clinic CAC baseline"),
            "dental": (220_000, "dental clinic CAC baseline"),
        }.get(clinic_type, (250_000, "generic CAC baseline"))
        conf = {"skin": 0.60, "dental": 0.60}.get(clinic_type, 0.48) + _sr_bonus
        return base, min(conf, 0.68), method

    if field == "customer_lifetime_value_ltv":
        if revenue and patients:
            visits = visits_y or 2.5
            avg = revenue / max(patients * visits, 1)
            conf = 0.71 - _hop_penalty("revenue", "total_patients", "visit_frequency_per_patient_per_year") + _sr_bonus
            return round(avg * visits * 3.5), min(conf, 0.71), "avg revenue per patient × retention horizon"
        base, method = {
            "skin":   (2_400_000, "skin clinic LTV baseline"),
            "dental": (1_800_000, "dental clinic LTV baseline"),
        }.get(clinic_type, (1_500_000, "generic LTV baseline"))
        conf = {"skin": 0.58, "dental": 0.58}.get(clinic_type, 0.46) + _sr_bonus
        return base, min(conf, 0.66), method

    if field == "investment_per_clinic":
        base, method = {
            "skin":   (2_800_000_000, "skin clinic fit-out baseline"),
            "dental": (2_400_000_000, "dental clinic equipment baseline"),
        }.get(clinic_type, (2_000_000_000, "generic clinic investment baseline"))
        conf = {"skin": 0.62, "dental": 0.62}.get(clinic_type, 0.45) + _sr_bonus
        return base, min(conf, 0.70), method

    # ── Operational ───────────────────────────────────────────────────────────
    if field == "opening_hours_per_day":
        return 10, 0.85 + _sr_bonus, "common clinic operating hours assumption"

    if field == "operating_days_per_year":
        return 360, 0.84 + _sr_bonus, "near-year-round clinic operating assumption"

    if field == "doctor_utilization":
        base, method = {
            "skin":   (72.0, "skin clinic utilization baseline"),
            "dental": (68.0, "dental clinic utilization baseline"),
        }.get(clinic_type, (65.0, "generic utilization baseline"))
        conf = {"skin": 0.59, "dental": 0.59}.get(clinic_type, 0.48) + _sr_bonus
        return base, min(conf, 0.67), method

    if field == "patient_per_doctor_per_day":
        base, method = {
            "skin":   (18, "skin clinic throughput baseline"),
            "dental": (12, "dental clinic throughput baseline"),
        }.get(clinic_type, (15, "generic throughput baseline"))
        conf = {"skin": 0.60, "dental": 0.60}.get(clinic_type, 0.47) + _sr_bonus
        return base, min(conf, 0.68), method

    if field == "dentist_utilization":
        return 70.0, 0.58 + _sr_bonus, "dental utilization baseline"

    if field == "chair_utilization":
        return 68.0, 0.57 + _sr_bonus, "dental chair utilization baseline"

    if field == "visits_per_chair_per_day":
        return 11, 0.57 + _sr_bonus, "dental chair throughput baseline"

    if field == "patient_per_dentist_per_day":
        return 11, 0.57 + _sr_bonus, "dental dentist throughput baseline"

    if field == "average_treatment_duration":
        if clinic_type == "dental":
            return 45, 0.56 + _sr_bonus, "dental treatment duration baseline"
        return 35, 0.48 + _sr_bonus, "generic treatment duration baseline"

    if field == "appointment_slot_utilization":
        return 82.0, 0.55 + _sr_bonus, "appointment slot utilization baseline"

    # ── Patient metrics ───────────────────────────────────────────────────────
    if field == "patient_retention_rate":
        base, method = {
            "skin":   (38.0, "skin retention baseline"),
            "dental": (46.0, "dental retention baseline"),
        }.get(clinic_type, (40.0, "generic retention baseline"))
        conf = {"skin": 0.56, "dental": 0.56}.get(clinic_type, 0.45) + _sr_bonus
        return base, min(conf, 0.64), method

    if field == "visit_frequency_per_patient_per_year":
        base, method = {
            "skin":   (3.0, "skin visit frequency baseline"),
            "dental": (2.4, "dental visit frequency baseline"),
        }.get(clinic_type, (2.5, "generic visit frequency baseline"))
        conf = {"skin": 0.56, "dental": 0.56}.get(clinic_type, 0.45) + _sr_bonus
        return base, min(conf, 0.64), method

    if field == "nps_score":
        return 65, 0.40 + _sr_bonus, "industry-normal NPS baseline"

    if field == "average_waiting_time":
        return 18, 0.54 + _sr_bonus, "clinic queue baseline"

    if field == "new_patients_per_month":
        if patients:
            conf = 0.45 - _hop_penalty("total_patients") + _sr_bonus
            return max(int(round(patients * 0.06 / 12)), 1), max(conf, 0.25), "6% annual growth proxy"
        return 120, 0.40 + _sr_bonus, "market growth baseline"

    if field == "total_patients":
        if revenue:
            used_atv = atv or (450_000 if clinic_type == "skin" else 300_000)
            est = max(int(round(revenue / max(used_atv, 1))), 1)
            conf = 0.52 - _hop_penalty("revenue", "average_transaction_value") + _sr_bonus
            return est, max(conf, 0.25), "revenue ÷ estimated average transaction value"
        return 5_000, 0.35 + _sr_bonus, "generic annual patient volume baseline"

    # ── Count fields ──────────────────────────────────────────────────────────
    if field == "number_of_outlets":
        return 1, 0.55 + _sr_bonus, "single-site default"
    if field == "number_of_doctors":
        return 3, 0.42 + _sr_bonus, "small clinic doctor baseline"
    if field == "number_of_dentists":
        return 3, 0.42 + _sr_bonus, "small dental baseline"
    if field == "number_of_therapists":
        return 4, 0.42 + _sr_bonus, "small clinic therapist baseline"
    if field == "number_of_treatment_rooms":
        return 4, 0.50 + _sr_bonus, "small clinic room baseline"
    if field == "number_of_dental_chairs":
        return 3, 0.48 + _sr_bonus, "small dental chair baseline"

    return 0, 0.0, "unhandled"


# ── Service mix ───────────────────────────────────────────────────────────────

def service_mix_prediction(clinic_type: str) -> Dict[str, float]:
    if clinic_type == "skin":
        return _scale_mix(SKIN_SERVICE_MIX)
    if clinic_type == "dental":
        return _scale_mix(DENTAL_SERVICE_MIX)
    if clinic_type == "both":
        mix: Dict[str, float] = {}
        for k, v in SKIN_SERVICE_MIX.items():
            mix[k] = mix.get(k, 0.0) + v * 0.5
        for k, v in DENTAL_SERVICE_MIX.items():
            mix[k] = mix.get(k, 0.0) + v * 0.5
        return _scale_mix(mix)
    return _scale_mix({**SKIN_SERVICE_MIX, **DENTAL_SERVICE_MIX})