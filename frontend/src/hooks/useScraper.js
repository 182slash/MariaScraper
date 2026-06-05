import { useState, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL

const STATUS_MESSAGES = [
  'Connecting to website...',
  'Extracting financial data...',
  'Analyzing patient metrics...',
  'Running prediction engine...',
  'Building your dashboard...',
]

const transformApiResponse = (raw) => {
  const d = raw.data
  const f = d.financials
  const op = d.operational
  const pm = d.patient_metrics
  const ds = d.dental_specific
  const mix = d.patient_mix
  const meta = d.metadata

  const outlets = f.number_of_outlets?.value || 1
  const byCity = {
    'DKI Jakarta': Math.round((f.revenue_per_city?.dki_jakarta?.value || 0) || outlets * 0.52),
    'Surabaya':    Math.round((f.revenue_per_city?.surabaya?.value    || 0) || outlets * 0.30),
    'Banten':      Math.round((f.revenue_per_city?.banten?.value      || 0) || outlets * 0.18),
  }

  const skinRaw = d.service_mix_skin || {}
  const dentalRaw = d.service_mix_dental || {}

  const skinData = [
    { name: 'Skin Health',              value: skinRaw.skin_health_pct?.value          || 0, source: skinRaw.skin_health_pct?.source          || 'predicted', confidence: skinRaw.skin_health_pct?.confidence          || 0.33 },
    { name: 'Injectables & Anti-Aging', value: skinRaw.injectables_antiaging_pct?.value || 0, source: skinRaw.injectables_antiaging_pct?.source || 'predicted', confidence: skinRaw.injectables_antiaging_pct?.confidence || 0.33 },
    { name: 'Body Aesthetics',          value: skinRaw.body_aesthetics_pct?.value       || 0, source: skinRaw.body_aesthetics_pct?.source       || 'predicted', confidence: skinRaw.body_aesthetics_pct?.confidence       || 0.33 },
    { name: 'Hair Solutions',           value: skinRaw.hair_solutions_pct?.value        || 0, source: skinRaw.hair_solutions_pct?.source        || 'predicted', confidence: skinRaw.hair_solutions_pct?.confidence        || 0.33 },
    { name: 'Non-Doctor Treatments',    value: skinRaw.non_doctor_treatments_pct?.value || 0, source: skinRaw.non_doctor_treatments_pct?.source || 'predicted', confidence: skinRaw.non_doctor_treatments_pct?.confidence || 0.33 },
    { name: 'Others',                   value: skinRaw.other_services_skin_pct?.value   || 0, source: skinRaw.other_services_skin_pct?.source   || 'predicted', confidence: skinRaw.other_services_skin_pct?.confidence   || 0.33 },
  ]

  const dentalData = [
    { name: 'Scaling',        value: dentalRaw.scaling_pct?.value        || 0, source: dentalRaw.scaling_pct?.source        || 'predicted', confidence: dentalRaw.scaling_pct?.confidence        || 0.33 },
    { name: 'Fillings',       value: dentalRaw.fillings_pct?.value       || 0, source: dentalRaw.fillings_pct?.source       || 'predicted', confidence: dentalRaw.fillings_pct?.confidence       || 0.33 },
    { name: 'Braces',         value: dentalRaw.braces_pct?.value         || 0, source: dentalRaw.braces_pct?.source         || 'predicted', confidence: dentalRaw.braces_pct?.confidence         || 0.33 },
    { name: 'Veneers',        value: dentalRaw.veneers_pct?.value        || 0, source: dentalRaw.veneers_pct?.source        || 'predicted', confidence: dentalRaw.veneers_pct?.confidence        || 0.33 },
    { name: 'Endodontics',    value: dentalRaw.endodontics_pct?.value    || 0, source: dentalRaw.endodontics_pct?.source    || 'predicted', confidence: dentalRaw.endodontics_pct?.confidence    || 0.33 },
    { name: 'Periodontics',   value: dentalRaw.periodontics_pct?.value   || 0, source: dentalRaw.periodontics_pct?.source   || 'predicted', confidence: dentalRaw.periodontics_pct?.confidence   || 0.33 },
    { name: 'Prosthodontics', value: dentalRaw.prosthodontics_pct?.value || 0, source: dentalRaw.prosthodontics_pct?.source || 'predicted', confidence: dentalRaw.prosthodontics_pct?.confidence || 0.33 },
    { name: 'Pedodontics',    value: dentalRaw.pedodontics_pct?.value    || 0, source: dentalRaw.pedodontics_pct?.source    || 'predicted', confidence: dentalRaw.pedodontics_pct?.confidence    || 0.33 },
    { name: 'Others',         value: dentalRaw.other_services_dental_pct?.value || 0, source: dentalRaw.other_services_dental_pct?.source || 'predicted', confidence: dentalRaw.other_services_dental_pct?.confidence || 0.33 },
  ]

  const predictions = (raw.predictions_log || []).map(p => ({
    field:      p.field,
    method:     p.method,
    confidence: p.confidence,
    value:      p.value || 'N/A',
  }))

  const ss = raw.scrape_summary || {}

  return {
    url:                raw.url,
    clinic_type:        raw.clinic_type || meta?.clinic_type || 'unknown',
    timestamp:          raw.scraped_at,
    overall_confidence: meta?.overall_confidence ?? 0.43,
    favicon:            `https://www.google.com/s2/favicons?domain=${encodeURIComponent(raw.url)}&sz=64`,

    financial: {
      revenue_latest:        f.revenue          ?? { value: null, unit: 'IDR', source: 'scraped',   confidence: 0 },
      ebitda_margin:         f.ebitda_margin     ?? { value: null, unit: '%',   source: 'predicted', confidence: 0 },
      gross_margin:          f.gross_margin      ?? { value: null, unit: '%',   source: 'predicted', confidence: 0 },
      avg_transaction_value: f.average_transaction_value ?? { value: null, unit: 'IDR', source: 'predicted', confidence: 0 },
      cac:                   f.customer_acquisition_cost_cac ?? { value: null, unit: 'IDR', source: 'predicted', confidence: 0 },
      ltv:                   f.customer_lifetime_value_ltv   ?? { value: null, unit: 'IDR', source: 'predicted', confidence: 0 },
      marketing_spend_pct:   f.marketing_spend   ?? { value: null, unit: '%',   source: 'predicted', confidence: 0 },
      investment_per_clinic: f.investment_per_clinic ?? { value: null, unit: 'IDR', source: 'predicted', confidence: 0 },
    },

    revenue_trends: {
      years:                [2020, 2021, 2022, 2023, 2024, 2025],
      revenue:              [null, null, null, null, null, f.revenue?.value ?? null],
      revenue_per_outlet:   [null, null, null, null, null, f.revenue_per_outlet?.value ?? null],
      revenue_per_patient:  [null, null, null, null, null, f.revenue_per_patient?.value ?? null],
      revenue_per_visit:    [null, null, null, null, null, f.revenue_per_visit?.value ?? null],
    },

    outlets: {
      total:                 outlets,
      by_city:               byCity,
      investment_per_clinic: f.investment_per_clinic ?? { value: null, unit: 'IDR', source: 'predicted', confidence: 0 },
    },

    operational: {
      doctors:                        op.number_of_doctors?.value    ?? 0,
      dentists:                       op.number_of_dentists?.value   ?? 0,
      therapists:                     op.number_of_therapists?.value ?? 0,
      doctor_utilization:             op.doctor_utilization          ?? { value: null, unit: '%', source: 'predicted', confidence: 0 },
      patients_per_doctor_per_day:    op.patient_per_doctor_per_day  ?? { value: null, unit: '',  source: 'predicted', confidence: 0 },
      treatment_rooms:                op.number_of_treatment_rooms?.value ?? 0,
      opening_hours:                  op.opening_hours_per_day?.value ? `09:00 - ${9 + op.opening_hours_per_day.value}:00` : 'N/A',
      operating_days_per_year:        op.operating_days_per_year?.value ?? 0,
    },

    patient_metrics: {
      total_patients:           pm.total_patients              ?? { value: null, source: 'predicted', confidence: 0 },
      new_patients_per_month:   pm.new_patients_per_month      ?? { value: null, source: 'predicted', confidence: 0 },
      retention_rate:           pm.patient_retention_rate      ?? { value: null, unit: '%', source: 'predicted', confidence: 0 },
      visit_frequency_per_year: pm.visit_frequency_per_patient_per_year ?? { value: null, source: 'predicted', confidence: 0 },
      nps_score:                pm.nps_score                   ?? { value: null, source: 'predicted', confidence: 0 },
      avg_waiting_time:         pm.average_waiting_time        ?? { value: null, unit: 'min', source: 'predicted', confidence: 0 },
    },

    patient_mix: {
      new_vs_repeat:          [mix.new_vs_repeat_patient_mix?.value ?? 35,    100 - (mix.new_vs_repeat_patient_mix?.value ?? 35)],
      walkin_vs_appointment:  [mix.walkin_vs_appointment_mix?.value ?? 25,    100 - (mix.walkin_vs_appointment_mix?.value ?? 25)],
      corporate_vs_retail:    [mix.corporate_vs_retail_patient_mix?.value ?? 30, 100 - (mix.corporate_vs_retail_patient_mix?.value ?? 30)],
    },

    service_mix: { skin: skinData, dental: dentalData },

    dental_specific: {
      dentist_utilization:           ds.dentist_utilization          ?? { value: null, unit: '%', source: 'predicted', confidence: 0 },
      chair_utilization:             ds.chair_utilization            ?? { value: null, unit: '%', source: 'predicted', confidence: 0 },
      visits_per_chair_per_day:      ds.visits_per_chair_per_day     ?? { value: null, unit: '',  source: 'predicted', confidence: 0 },
      patients_per_dentist_per_day:  ds.patient_per_dentist_per_day  ?? { value: null, unit: '',  source: 'predicted', confidence: 0 },
      avg_treatment_duration:        ds.average_treatment_duration   ?? { value: null, unit: 'min', source: 'predicted', confidence: 0 },
      appointment_slot_utilization:  ds.appointment_slot_utilization ?? { value: null, unit: '%', source: 'predicted', confidence: 0 },
    },

    membership_marketing: {
      membership_penetration: f.membership_package_penetration ?? { value: 0, unit: '%', source: 'predicted', confidence: 0 },
      marketing_spend_pct:    f.marketing_spend ?? { value: 0, unit: '%', source: 'predicted', confidence: 0 },
      industry_benchmark:     12.0,
    },

    predictions_log: predictions,

    scrape_summary: {
      total_scraped:   ss.scraped_fields   ?? 0,
      total_predicted: ss.predicted_fields ?? 0,
    },
  }
}

const getMockData = (url) => ({
  url,
  clinic_type: 'both',
  timestamp: new Date().toISOString(),
  overall_confidence: 0.82,
  favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=64`,
  financial: {
    revenue_latest:        { value: 45.2,  unit: 'B IDR', source: 'scraped',   confidence: 0.9  },
    ebitda_margin:         { value: 28.5,  unit: '%',     source: 'predicted', confidence: 0.65 },
    gross_margin:          { value: 72.3,  unit: '%',     source: 'scraped',   confidence: 0.88 },
    avg_transaction_value: { value: 1.2,   unit: 'M IDR', source: 'predicted', confidence: 0.6  },
    cac:                   { value: 850,   unit: 'K IDR', source: 'predicted', confidence: 0.55 },
    ltv:                   { value: 12.5,  unit: 'M IDR', source: 'predicted', confidence: 0.58 },
    marketing_spend_pct:   { value: 8.4,   unit: '%',     source: 'scraped',   confidence: 0.85 },
    investment_per_clinic: { value: 3.2,   unit: 'B IDR', source: 'scraped',   confidence: 0.92 },
  },
  revenue_trends: {
    years: [2020, 2021, 2022, 2023, 2024, 2025],
    revenue: [28.5, 32.1, 35.8, 40.2, 42.8, 45.2],
    revenue_per_outlet: [1.2, 1.35, 1.4, 1.55, 1.6, 1.68],
    revenue_per_patient: [0.85, 0.92, 0.98, 1.05, 1.12, 1.18],
    revenue_per_visit: [0.65, 0.72, 0.78, 0.85, 0.9, 0.95],
  },
  outlets: {
    total: 27,
    by_city: { 'DKI Jakarta': 14, 'Surabaya': 8, 'Banten': 5 },
    investment_per_clinic: { value: 3.2, unit: 'B IDR', source: 'scraped', confidence: 0.92 },
  },
  operational: {
    doctors: 45, dentists: 32, therapists: 18,
    doctor_utilization: { value: 78.5, unit: '%', source: 'predicted', confidence: 0.62 },
    patients_per_doctor_per_day: { value: 12.4, unit: '', source: 'predicted', confidence: 0.58 },
    treatment_rooms: 89,
    opening_hours: '09:00 - 21:00',
    operating_days_per_year: 312,
  },
  patient_metrics: {
    total_patients:           { value: 125000, unit: '',    source: 'scraped',   confidence: 0.87 },
    new_patients_per_month:   { value: 2100,   unit: '',    source: 'predicted', confidence: 0.6  },
    retention_rate:           { value: 68.5,   unit: '%',   source: 'predicted', confidence: 0.55 },
    visit_frequency_per_year: { value: 3.2,    unit: '',    source: 'predicted', confidence: 0.52 },
    nps_score:                { value: 42,     unit: '',    source: 'predicted', confidence: 0.48 },
    avg_waiting_time:         { value: 18,     unit: 'min', source: 'predicted', confidence: 0.5  },
  },
  patient_mix: {
    new_vs_repeat:         [35, 65],
    walkin_vs_appointment: [25, 75],
    corporate_vs_retail:   [30, 70],
  },
  service_mix: {
    skin: [
      { name: 'Skin Health',              value: 28, source: 'scraped',   confidence: 0.8  },
      { name: 'Injectables & Anti-Aging', value: 22, source: 'scraped',   confidence: 0.75 },
      { name: 'Body Aesthetics',          value: 18, source: 'predicted', confidence: 0.6  },
      { name: 'Hair Solutions',           value: 15, source: 'predicted', confidence: 0.55 },
      { name: 'Non-Doctor Treatments',    value: 12, source: 'predicted', confidence: 0.5  },
      { name: 'Others',                   value: 5,  source: 'predicted', confidence: 0.45 },
    ],
    dental: [
      { name: 'Scaling',        value: 20, source: 'scraped',   confidence: 0.82 },
      { name: 'Fillings',       value: 18, source: 'scraped',   confidence: 0.8  },
      { name: 'Braces',         value: 15, source: 'predicted', confidence: 0.6  },
      { name: 'Veneers',        value: 12, source: 'predicted', confidence: 0.58 },
      { name: 'Endodontics',    value: 10, source: 'predicted', confidence: 0.55 },
      { name: 'Periodontics',   value: 8,  source: 'predicted', confidence: 0.5  },
      { name: 'Prosthodontics', value: 7,  source: 'predicted', confidence: 0.48 },
      { name: 'Pedodontics',    value: 6,  source: 'predicted', confidence: 0.47 },
      { name: 'Others',         value: 4,  source: 'predicted', confidence: 0.45 },
    ],
  },
  dental_specific: {
    dentist_utilization:          { value: 82.3, unit: '%',   source: 'predicted', confidence: 0.6  },
    chair_utilization:            { value: 75.8, unit: '%',   source: 'predicted', confidence: 0.58 },
    visits_per_chair_per_day:     { value: 6.4,  unit: '',    source: 'predicted', confidence: 0.55 },
    patients_per_dentist_per_day: { value: 8.2,  unit: '',    source: 'predicted', confidence: 0.52 },
    avg_treatment_duration:       { value: 45,   unit: 'min', source: 'predicted', confidence: 0.5  },
    appointment_slot_utilization: { value: 71.5, unit: '%',   source: 'predicted', confidence: 0.54 },
  },
  membership_marketing: {
    membership_penetration: { value: 24.5, unit: '%', source: 'predicted', confidence: 0.5  },
    marketing_spend_pct:    { value: 8.4,  unit: '%', source: 'scraped',   confidence: 0.85 },
    industry_benchmark: 12.0,
  },
  predictions_log: [
    { field: 'EBITDA Margin',             method: 'Regression on comparable clinics',        confidence: 0.65, value: '28.5%'    },
    { field: 'Average Transaction Value', method: 'Industry median adjusted by location',    confidence: 0.6,  value: '1.2M IDR' },
    { field: 'CAC',                       method: 'Marketing spend / new patient estimate',  confidence: 0.55, value: '850K IDR' },
    { field: 'LTV',                       method: 'ATV x visit frequency x retention years', confidence: 0.58, value: '12.5M IDR'},
    { field: 'Doctor Utilization',        method: 'Operational capacity model',              confidence: 0.62, value: '78.5%'    },
    { field: 'Retention Rate',            method: 'Cohort analysis simulation',              confidence: 0.55, value: '68.5%'    },
    { field: 'NPS Score',                 method: 'Sentiment proxy from reviews',            confidence: 0.48, value: '42'       },
  ],
  scrape_summary: { total_scraped: 12, total_predicted: 18 },
})

export function useScraper() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')

  const scrape = useCallback(async (url) => {
    setLoading(true); setError(null); setProgress(0)
    try {
      const isDemo = !API_URL || API_URL.includes('your-app')
      if (isDemo) {
        for (let i = 0; i < STATUS_MESSAGES.length; i++) {
          setStatusMessage(STATUS_MESSAGES[i])
          setProgress(((i + 1) / STATUS_MESSAGES.length) * 100)
          await new Promise(r => setTimeout(r, 700))
        }
        const data = getMockData(url)
        setLoading(false); setProgress(100)
        return data
      }

      for (let i = 0; i < STATUS_MESSAGES.length; i++) {
        setStatusMessage(STATUS_MESSAGES[i])
        setProgress(((i + 1) / STATUS_MESSAGES.length) * 60)
        await new Promise(r => setTimeout(r, 300))
      }

      const res = await fetch(`${API_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const raw = await res.json()
      const data = transformApiResponse(raw)
      setProgress(100); setLoading(false)
      return data
    } catch (err) {
      setError(err.message || 'Failed to scrape website. Please try again.')
      setLoading(false); setProgress(0)
      throw err
    }
  }, [])

  return { scrape, loading, error, progress, statusMessage }
}