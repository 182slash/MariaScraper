from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple


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


def _sum_pct(values: Dict[str, float]) -> float:
    return float(sum(values.values()))


def scale_mix(mix: Dict[str, float], target: float = 100.0) -> Dict[str, float]:
    total = _sum_pct(mix)
    if total == 0:
        return mix
    factor = target / total
    return {k: round(v * factor, 2) for k, v in mix.items()}


def infer_clinic_type(text: str, url: str = "") -> str:
    t = f"{text} {url}".lower()
    skin_hits = [
        "skincare", "skin", "aesthetic", "estetik", "beauty", "derma", "dermatology",
        "acne", "facial", "botox", "filler", "threadlift", "glow", "laser", "hair removal"
    ]
    dental_hits = [
        "dental", "dentist", "dentistry", "gigi", "orthodont", "braces", "veneer",
        "implan", "implant", "scaling", "endodont", "periodont", "prosthodont", "pedodont"
    ]
    skin = any(h in t for h in skin_hits)
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


def predict_numeric(
    *,
    field: str,
    clinic_type: str,
    known: Dict[str, Any],
    method_log: List[Dict[str, Any]],
) -> Tuple[float | int, float, str]:
    """
    Returns (value, confidence, method)
    """
    revenue = known.get("revenue")
    outlets = known.get("number_of_outlets")
    patients = known.get("total_patients")
    visits_per_year = known.get("visit_frequency_per_patient_per_year")
    doctors = known.get("number_of_doctors")
    dentists = known.get("number_of_dentists")
    therapists = known.get("number_of_therapists")
    rooms = known.get("number_of_treatment_rooms")
    chairs = known.get("number_of_dental_chairs")

    # Core financials
    if field == "revenue_per_outlet" and revenue and outlets:
        return round(revenue / max(outlets, 1)), 0.95, "revenue ÷ outlets"
    if field == "revenue_per_patient" and revenue and patients:
        return round(revenue / max(patients, 1)), 0.92, "revenue ÷ patients"
    if field == "revenue_per_visit" and revenue and patients and visits_per_year:
        visits = max(patients * visits_per_year, 1)
        return round(revenue / visits), 0.84, "revenue ÷ estimated annual visits"
    if field == "revenue_per_doctor_dentist_therapist":
        staff = sum(x for x in [doctors, dentists, therapists] if isinstance(x, (int, float)) and x > 0)
        if revenue and staff:
            return round(revenue / staff), 0.88, "revenue ÷ clinical staff count"
    if field == "revenue_per_treatment_room" and revenue and rooms:
        return round(revenue / max(rooms, 1)), 0.90, "revenue ÷ treatment rooms"
    if field == "revenue_per_dental_chair" and revenue and chairs:
        return round(revenue / max(chairs, 1)), 0.90, "revenue ÷ dental chairs"

    # Margins / marketing / CAC / LTV
    if field == "gross_margin":
        if clinic_type == "skin":
            return 58.0, 0.72, "skin clinic gross margin baseline"
        if clinic_type == "dental":
            return 52.0, 0.72, "dental clinic gross margin baseline"
        if clinic_type == "both":
            return 55.0, 0.68, "blended clinic gross margin baseline"
        return 50.0, 0.55, "generic clinic gross margin baseline"
    if field == "ebitda_margin":
        if clinic_type == "skin":
            return 20.0, 0.70, "skin clinic EBITDA baseline"
        if clinic_type == "dental":
            return 18.0, 0.70, "dental clinic EBITDA baseline"
        if clinic_type == "both":
            return 19.0, 0.66, "blended EBITDA baseline"
        return 17.0, 0.52, "generic EBITDA baseline"
    if field == "marketing_spend":
        if clinic_type == "skin":
            return 12.0, 0.64, "skin clinic marketing ratio baseline"
        if clinic_type == "dental":
            return 9.0, 0.62, "dental clinic marketing ratio baseline"
        return 10.0, 0.50, "generic marketing ratio baseline"
    if field == "customer_acquisition_cost_cac":
        if clinic_type == "skin":
            return 350000, 0.60, "skin clinic CAC baseline"
        if clinic_type == "dental":
            return 220000, 0.60, "dental clinic CAC baseline"
        return 250000, 0.48, "generic CAC baseline"
    if field == "customer_lifetime_value_ltv":
        if revenue and patients:
            visits = visits_per_year or 2.5
            avg = revenue / max(patients * visits, 1)
            return round(avg * visits * 3.5), 0.71, "average revenue per patient × retention horizon"
        if clinic_type == "skin":
            return 2400000, 0.58, "skin clinic LTV baseline"
        if clinic_type == "dental":
            return 1800000, 0.58, "dental clinic LTV baseline"
        return 1500000, 0.46, "generic LTV baseline"
    if field == "investment_per_clinic":
        if clinic_type == "skin":
            return 2800000000, 0.62, "skin clinic fit-out baseline"
        if clinic_type == "dental":
            return 2400000000, 0.62, "dental clinic equipment baseline"
        return 2000000000, 0.45, "generic clinic investment baseline"

    # Operational
    if field == "opening_hours_per_day":
        return 10, 0.85, "common clinic operating hours assumption"
    if field == "operating_days_per_year":
        return 360, 0.84, "near-year-round clinic operating assumption"
    if field == "doctor_utilization":
        if clinic_type == "skin":
            return 72.0, 0.59, "skin clinic utilization baseline"
        if clinic_type == "dental":
            return 68.0, 0.59, "dental clinic utilization baseline"
        return 65.0, 0.48, "generic utilization baseline"
    if field == "patient_per_doctor_per_day":
        if clinic_type == "skin":
            return 18, 0.60, "skin clinic throughput baseline"
        if clinic_type == "dental":
            return 12, 0.60, "dental clinic throughput baseline"
        return 15, 0.47, "generic throughput baseline"
    if field == "dentist_utilization":
        return 70.0, 0.58, "dental utilization baseline"
    if field == "chair_utilization":
        return 68.0, 0.57, "dental chair utilization baseline"
    if field == "visits_per_chair_per_day":
        return 11, 0.57, "dental chair throughput baseline"
    if field == "patient_per_dentist_per_day":
        return 11, 0.57, "dental dentist throughput baseline"
    if field == "average_treatment_duration":
        if clinic_type == "dental":
            return 45, 0.56, "dental treatment duration baseline"
        return 35, 0.48, "generic treatment duration baseline"
    if field == "appointment_slot_utilization":
        return 82.0, 0.55, "appointment slot utilization baseline"

    # Patient metrics
    if field == "patient_retention_rate":
        if clinic_type == "skin":
            return 38.0, 0.56, "skin retention baseline"
        if clinic_type == "dental":
            return 46.0, 0.56, "dental retention baseline"
        return 40.0, 0.45, "generic retention baseline"
    if field == "visit_frequency_per_patient_per_year":
        if clinic_type == "skin":
            return 3.0, 0.56, "skin visit frequency baseline"
        if clinic_type == "dental":
            return 2.4, 0.56, "dental visit frequency baseline"
        return 2.5, 0.45, "generic visit frequency baseline"
    if field == "nps_score":
        return 65, 0.40, "industry-normal NPS baseline"
    if field == "average_waiting_time":
        return 18, 0.54, "clinic queue baseline"
    if field == "new_patients_per_month":
        if patients:
            return max(int(round(patients * 0.06 / 12)), 1), 0.45, "6% annual growth proxy"
        return 120, 0.40, "market growth baseline"
    if field == "total_patients":
        if revenue and clinic_type in {"skin", "dental", "both"}:
            atv = known.get("average_transaction_value") or (450000 if clinic_type == "skin" else 300000)
            est = max(int(round(revenue / max(atv, 1))), 1)
            return est, 0.52, "revenue ÷ estimated average transaction value"
        return 5000, 0.35, "generic annual patient volume baseline"

    # Count fields
    if field == "number_of_outlets":
        return 1, 0.55, "single-site default"
    if field == "number_of_doctors":
        return 3, 0.42, "small clinic doctor baseline"
    if field == "number_of_dentists":
        return 3, 0.42, "small dental baseline"
    if field == "number_of_therapists":
        return 4, 0.42, "small clinic therapist baseline"
    if field == "number_of_treatment_rooms":
        return 4, 0.50, "small clinic room baseline"
    if field == "number_of_dental_chairs":
        return 3, 0.48, "small dental chair baseline"

    # Service mix predictions are handled separately.
    return 0, 0.0, "unhandled"


def service_mix_prediction(clinic_type: str) -> Dict[str, float]:
    if clinic_type == "skin":
        return scale_mix(SKIN_SERVICE_MIX)
    if clinic_type == "dental":
        return scale_mix(DENTAL_SERVICE_MIX)
    if clinic_type == "both":
        # Blend, then normalize.
        mix: Dict[str, float] = {}
        for k, v in SKIN_SERVICE_MIX.items():
            mix[k] = mix.get(k, 0.0) + v * 0.5
        for k, v in DENTAL_SERVICE_MIX.items():
            mix[k] = mix.get(k, 0.0) + v * 0.5
        return scale_mix(mix)
    return scale_mix({**SKIN_SERVICE_MIX, **DENTAL_SERVICE_MIX})
