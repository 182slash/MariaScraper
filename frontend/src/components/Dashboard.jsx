import { useState } from 'react'
import { useTheme } from '../App'
import KPICard from './KPICard'
import ChartSection from './ChartSection'
import ServiceMixChart from './ServiceMixChart'
import PatientMixChart from './PatientMixChart'
import PredictionsLog from './PredictionsLog'
import ConfidenceBadge from './ConfidenceBadge'
import {
  ArrowLeft, Download, Building2, Stethoscope,
  Users, CreditCard, TrendingUp, Activity,
  PieChart, BarChart3, ChevronDown, ChevronUp
} from 'lucide-react'

const CYAN   = '#00D2FF'
const AMBER  = '#FFB800'
const GREEN  = '#00DC82'

function SectionHeader({ icon: Icon, label, color = CYAN }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.01em' }}>
        {label}
      </h2>
      <div className="flex-1 hairline" />
    </div>
  )
}

function StatCard({ label, value, mono = false }) {
  return (
    <div className="glass-card p-5">
      <div className="section-label mb-3">{label}</div>
      <div className={mono ? 'metric-value' : 'text-xl font-semibold'} style={{ color: 'rgba(255,255,255,0.9)' }}>
        {value}
      </div>
    </div>
  )
}

function GaugeChart({ value, max, color }) {
  const pct = Math.min(((value ?? 0) / max) * 100, 100)
  const r = 38
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}80)`, transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-bold text-xl" style={{ color }}>{value ?? '—'}</span>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>/ {max}</span>
      </div>
    </div>
  )
}

function CityBar({ city, count, total }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-4">
      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', width: 100, flexShrink: 0 }}>{city}</span>
      <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="h-full rounded-md flex items-center justify-end px-2.5 transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: 'rgba(0,210,255,0.15)',
            borderRight: `2px solid ${CYAN}`,
            minWidth: count > 0 ? 36 : 0,
          }}>
          <span className="font-mono text-xs font-bold" style={{ color: CYAN }}>{count}</span>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ data, onScrapeNew }) {
  const [showPredictions, setShowPredictions] = useState(false)

  const confScore = Math.round(data.overall_confidence * 100)
  const confColor = confScore >= 70 ? GREEN : confScore >= 40 ? AMBER : '#FF3C64'

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `maria-${Date.now()}.json`
    a.click()
  }

  const totalFields = (data.scrape_summary.total_scraped || 0) + (data.scrape_summary.total_predicted || 0)
  const scrapedPct  = totalFields > 0 ? (data.scrape_summary.total_scraped / totalFields) * 100 : 0

  return (
    <div className="min-h-screen pb-24">

      {/* ── Topbar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(5,8,15,0.85)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 32px',
      }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 h-16">

          <div className="flex items-center gap-4 min-w-0">
            <button onClick={onScrapeNew} className="btn-ghost p-2 rounded-lg" style={{ padding: '7px' }}>
              <ArrowLeft className="w-4 h-4" />
            </button>
            <img
              src={data.favicon}
              alt="" className="w-7 h-7 rounded-md shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              onError={e => e.target.style.display = 'none'}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }} className="truncate">
                  {data.url}
                </span>
                <ConfidenceBadge type={data.clinic_type} />
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>
                {new Date(data.timestamp).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="pill" style={{
              background: `${confColor}12`,
              border: `1px solid ${confColor}30`,
              color: confColor,
              fontFamily: 'Space Mono, monospace',
              fontSize: '12px',
            }}>
              {confScore}% Confidence
            </div>
            <button onClick={handleExport} className="btn-ghost hidden md:inline-flex">
              <Download className="w-3.5 h-3.5" /> Export JSON
            </button>
            <button onClick={onScrapeNew} className="btn-solid">
              New Analysis
            </button>
          </div>
        </div>
      </header>

      {/* ── Legend bar ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-5 animate-fade-in-up">
        <div className="glass-card px-5 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: GREEN, boxShadow: `0 0 5px ${GREEN}` }} />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Scraped Data</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: AMBER, boxShadow: `0 0 5px ${AMBER}` }} />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>MS Predicted</span>
          </div>
          <div className="ml-auto hidden md:block" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)' }}>
            Hover badges for methodology
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8 space-y-10">

        {/* 1 · Financial Overview */}
        <section className="animate-fade-in-up delay-100">
          <SectionHeader icon={CreditCard} label="Financial Overview" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard title="Revenue — Latest Year"    data={data.financial.revenue_latest}        icon={TrendingUp} />
            <KPICard title="EBITDA Margin"            data={data.financial.ebitda_margin}          icon={Activity}   />
            <KPICard title="Gross Margin"             data={data.financial.gross_margin}           icon={PieChart}   />
            <KPICard title="Avg Transaction Value"    data={data.financial.avg_transaction_value}  icon={CreditCard} />
            <KPICard title="CAC"                      data={data.financial.cac}                    icon={Users}      />
            <KPICard title="LTV"                      data={data.financial.ltv}                    icon={TrendingUp} />
            <KPICard title="Marketing Spend"          data={data.financial.marketing_spend_pct}    icon={BarChart3}  />
            <KPICard title="Investment per Clinic"    data={data.financial.investment_per_clinic}  icon={Building2}  />
          </div>
        </section>

        {/* 2 · Revenue Trends */}
        <section className="animate-fade-in-up delay-200">
          <SectionHeader icon={TrendingUp} label="Revenue Trends" />
          <ChartSection data={data.revenue_trends} />
        </section>

        {/* 3 · Outlets */}
        <section className="animate-fade-in-up delay-300">
          <SectionHeader icon={Building2} label="Outlets & Capacity" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="glass-card p-6 flex flex-col items-center justify-center gap-1">
              <div className="section-label">Total Outlets</div>
              <div className="font-mono font-bold" style={{ fontSize: '3rem', color: CYAN, lineHeight: 1 }}>
                {data.outlets.total}
              </div>
            </div>
            <div className="glass-card p-6 lg:col-span-2">
              <div className="section-label mb-5">Distribution by City</div>
              <div className="space-y-3">
                {Object.entries(data.outlets.by_city).map(([city, count]) => (
                  <CityBar key={city} city={city} count={count} total={data.outlets.total} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4 · Operational */}
        <section className="animate-fade-in-up delay-100">
          <SectionHeader icon={Stethoscope} label="Operational Metrics" color="#A78BFF" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label="Doctors"              value={data.operational.doctors} />
            <StatCard label="Dentists"             value={data.operational.dentists} />
            <StatCard label="Therapists"           value={data.operational.therapists} />
            <KPICard  title="Doctor Utilization"   data={data.operational.doctor_utilization} />
            <KPICard  title="Patients / Doctor / Day" data={data.operational.patients_per_doctor_per_day} />
            <StatCard label="Treatment Rooms"      value={data.operational.treatment_rooms} />
            <StatCard label="Opening Hours"        value={data.operational.opening_hours} />
            <StatCard label="Operating Days / Year" value={data.operational.operating_days_per_year} mono />
          </div>
        </section>

        {/* 5 · Patient Metrics */}
        <section className="animate-fade-in-up delay-200">
          <SectionHeader icon={Users} label="Patient Metrics" color={GREEN} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <KPICard title="Total Patients"         data={data.patient_metrics.total_patients} />
            <KPICard title="New Patients / Month"   data={data.patient_metrics.new_patients_per_month} />
            <KPICard title="Visit Frequency / Year" data={data.patient_metrics.visit_frequency_per_year} />
            <KPICard title="Avg Waiting Time"       data={data.patient_metrics.avg_waiting_time} />
            <div className="glass-card p-5 flex flex-col items-center gap-3">
              <div className="section-label">Retention Rate</div>
              <GaugeChart value={data.patient_metrics.retention_rate?.value} max={100} color={AMBER} />
              <ConfidenceBadge source={data.patient_metrics.retention_rate?.source} confidence={data.patient_metrics.retention_rate?.confidence} />
            </div>
            <div className="glass-card p-5 flex flex-col items-center gap-3">
              <div className="section-label">NPS Score</div>
              <GaugeChart value={data.patient_metrics.nps_score?.value} max={100} color={CYAN} />
              <ConfidenceBadge source={data.patient_metrics.nps_score?.source} confidence={data.patient_metrics.nps_score?.confidence} />
            </div>
          </div>
        </section>

        {/* 6 · Patient Mix */}
        <section className="animate-fade-in-up delay-300">
          <SectionHeader icon={PieChart} label="Patient Mix" color="#A78BFF" />
          <PatientMixChart data={data.patient_mix} />
        </section>

        {/* 7 · Service Mix */}
        <section className="animate-fade-in-up delay-100">
          <SectionHeader icon={BarChart3} label="Service Mix" />
          <ServiceMixChart skinData={data.service_mix.skin} dentalData={data.service_mix.dental} clinicType={data.clinic_type} />
        </section>

        {/* 8 · Dental Specific */}
        {(data.clinic_type === 'dental' || data.clinic_type === 'both') && (
          <section className="animate-fade-in-up delay-200">
            <SectionHeader icon={Stethoscope} label="Dental Specific Metrics" color={CYAN} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <KPICard title="Dentist Utilization"          data={data.dental_specific.dentist_utilization} />
              <KPICard title="Chair Utilization"            data={data.dental_specific.chair_utilization} />
              <KPICard title="Visits per Chair / Day"       data={data.dental_specific.visits_per_chair_per_day} />
              <KPICard title="Patients per Dentist / Day"   data={data.dental_specific.patients_per_dentist_per_day} />
              <KPICard title="Avg Treatment Duration"       data={data.dental_specific.avg_treatment_duration} />
              <KPICard title="Appointment Slot Utilization" data={data.dental_specific.appointment_slot_utilization} />
            </div>
          </section>
        )}

        {/* 9 · Membership & Marketing */}
        <section className="animate-fade-in-up delay-300">
          <SectionHeader icon={CreditCard} label="Membership & Marketing" color={AMBER} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="glass-card p-6">
              <div className="section-label mb-3">Membership Penetration</div>
              <div className="metric-value mb-4" style={{ fontSize: '2.5rem', color: CYAN }}>
                {data.membership_marketing.membership_penetration?.value ?? '—'}
                {data.membership_marketing.membership_penetration?.value != null && (
                  <span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>
                    {data.membership_marketing.membership_penetration.unit}
                  </span>
                )}
              </div>
              <ConfidenceBadge
                source={data.membership_marketing.membership_penetration?.source}
                confidence={data.membership_marketing.membership_penetration?.confidence}
              />
            </div>
            <div className="glass-card p-6">
              <div className="section-label mb-5">Marketing Spend vs Benchmark</div>
              <div className="space-y-5">
                {[
                  { label: 'Current', value: data.membership_marketing.marketing_spend_pct?.value, color: CYAN },
                  { label: 'Industry Benchmark', value: data.membership_marketing.industry_benchmark, color: 'rgba(255,255,255,0.2)' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-2">
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                      <span className="font-mono text-xs font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>{value}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(value / 20) * 100}%`, background: color, boxShadow: color !== 'rgba(255,255,255,0.2)' ? `0 0 8px ${color}60` : 'none' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 10 · Predictions Log */}
        <section className="animate-fade-in-up delay-100">
          <button onClick={() => setShowPredictions(!showPredictions)}
            className="w-full glass-card p-4 flex items-center justify-between transition-all duration-200 hover:border-white/12"
            style={{ textAlign: 'left' }}>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${AMBER}12`, border: `1px solid ${AMBER}25` }}>
                <Activity className="w-3.5 h-3.5" style={{ color: AMBER }} />
              </div>
              <span style={{ fontSize: '15px', fontWeight: 600 }}>Predictions Log</span>
              <span className="pill" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
                {data.predictions_log.length}
              </span>
            </div>
            {showPredictions
              ? <ChevronUp className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
              : <ChevronDown className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />}
          </button>
          {showPredictions && <div className="mt-2"><PredictionsLog data={data.predictions_log} /></div>}
        </section>

        {/* 11 · Footer */}
        <footer className="glass-card p-6 animate-fade-in-up delay-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex-1 w-full">
              <div className="flex justify-between mb-2">
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Data Sources</span>
                <span className="font-mono" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                  {data.scrape_summary.total_scraped} scraped · {data.scrape_summary.total_predicted} predicted
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full transition-all duration-700"
                  style={{ width: `${scrapedPct}%`, background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
                <div className="h-full transition-all duration-700"
                  style={{ width: `${100 - scrapedPct}%`, background: AMBER, boxShadow: `0 0 6px ${AMBER}` }} />
              </div>
              <div className="flex gap-5 mt-2.5">
                {[['Scraped', GREEN, scrapedPct], ['Predicted', AMBER, 100 - scrapedPct]].map(([label, color, pct]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{label} ({Math.round(pct)}%)</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleExport} className="btn-solid shrink-0">
              <Download className="w-4 h-4" /> Download JSON
            </button>
          </div>
        </footer>

      </main>
    </div>
  )
}