import { useState, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL

const STATUS_MESSAGES = [
  'Connecting to website...',
  'Extracting financial data...',
  'Analyzing patient metrics...',
  'Running prediction engine...',
  'Building your dashboard...',
]

const getMockData = (url) => ({
  url,
  clinic_type: 'both',
  timestamp: new Date().toISOString(),
  overall_confidence: 0.82,
  favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=64`,
  financial: {
    revenue_latest: { value: 45.2, unit: 'B IDR', source: 'scraped', confidence: 0.9 },
    ebitda_margin: { value: 28.5, unit: '%', source: 'predicted', confidence: 0.65 },
    gross_margin: { value: 72.3, unit: '%', source: 'scraped', confidence: 0.88 },
    avg_transaction_value: { value: 1.2, unit: 'M IDR', source: 'predicted', confidence: 0.6 },
    cac: { value: 850, unit: 'K IDR', source: 'predicted', confidence: 0.55 },
    ltv: { value: 12.5, unit: 'M IDR', source: 'predicted', confidence: 0.58 },
    marketing_spend_pct: { value: 8.4, unit: '%', source: 'scraped', confidence: 0.85 },
    investment_per_clinic: { value: 3.2, unit: 'B IDR', source: 'scraped', confidence: 0.92 },
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
    total_patients: { value: 125000, unit: '', source: 'scraped', confidence: 0.87 },
    new_patients_per_month: { value: 2100, unit: '', source: 'predicted', confidence: 0.6 },
    retention_rate: { value: 68.5, unit: '%', source: 'predicted', confidence: 0.55 },
    visit_frequency_per_year: { value: 3.2, unit: '', source: 'predicted', confidence: 0.52 },
    nps_score: { value: 42, unit: '', source: 'predicted', confidence: 0.48 },
    avg_waiting_time: { value: 18, unit: 'min', source: 'predicted', confidence: 0.5 },
  },
  patient_mix: {
    new_vs_repeat: [35, 65],
    walkin_vs_appointment: [25, 75],
    corporate_vs_retail: [30, 70],
  },
  service_mix: {
    skin: [
      { name: 'Skin Health', value: 28, source: 'scraped', confidence: 0.8 },
      { name: 'Injectables & Anti-Aging', value: 22, source: 'scraped', confidence: 0.75 },
      { name: 'Body Aesthetics', value: 18, source: 'predicted', confidence: 0.6 },
      { name: 'Hair Solutions', value: 15, source: 'predicted', confidence: 0.55 },
      { name: 'Non-Doctor Treatments', value: 12, source: 'predicted', confidence: 0.5 },
      { name: 'Others', value: 5, source: 'predicted', confidence: 0.45 },
    ],
    dental: [
      { name: 'Scaling', value: 20, source: 'scraped', confidence: 0.82 },
      { name: 'Fillings', value: 18, source: 'scraped', confidence: 0.8 },
      { name: 'Braces', value: 15, source: 'predicted', confidence: 0.6 },
      { name: 'Veneers', value: 12, source: 'predicted', confidence: 0.58 },
      { name: 'Endodontics', value: 10, source: 'predicted', confidence: 0.55 },
      { name: 'Periodontics', value: 8, source: 'predicted', confidence: 0.5 },
      { name: 'Prosthodontics', value: 7, source: 'predicted', confidence: 0.48 },
      { name: 'Pedodontics', value: 6, source: 'predicted', confidence: 0.47 },
      { name: 'Others', value: 4, source: 'predicted', confidence: 0.45 },
    ],
  },
  dental_specific: {
    dentist_utilization: { value: 82.3, unit: '%', source: 'predicted', confidence: 0.6 },
    chair_utilization: { value: 75.8, unit: '%', source: 'predicted', confidence: 0.58 },
    visits_per_chair_per_day: { value: 6.4, unit: '', source: 'predicted', confidence: 0.55 },
    patients_per_dentist_per_day: { value: 8.2, unit: '', source: 'predicted', confidence: 0.52 },
    avg_treatment_duration: { value: 45, unit: 'min', source: 'predicted', confidence: 0.5 },
    appointment_slot_utilization: { value: 71.5, unit: '%', source: 'predicted', confidence: 0.54 },
  },
  membership_marketing: {
    membership_penetration: { value: 24.5, unit: '%', source: 'predicted', confidence: 0.5 },
    marketing_spend_pct: { value: 8.4, unit: '%', source: 'scraped', confidence: 0.85 },
    industry_benchmark: 12.0,
  },
  predictions_log: [
    { field: 'EBITDA Margin', method: 'Regression on comparable clinics', confidence: 0.65, value: '28.5%' },
    { field: 'Average Transaction Value', method: 'Industry median adjusted by location', confidence: 0.6, value: '1.2M IDR' },
    { field: 'CAC', method: 'Marketing spend / new patient estimate', confidence: 0.55, value: '850K IDR' },
    { field: 'LTV', method: 'ATV x visit frequency x retention years', confidence: 0.58, value: '12.5M IDR' },
    { field: 'Doctor Utilization', method: 'Operational capacity model', confidence: 0.62, value: '78.5%' },
    { field: 'Retention Rate', method: 'Cohort analysis simulation', confidence: 0.55, value: '68.5%' },
    { field: 'NPS Score', method: 'Sentiment proxy from reviews', confidence: 0.48, value: '42' },
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
      const data = await res.json()
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