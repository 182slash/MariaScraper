import { useState } from 'react'
import { useTheme } from '../App'
import KPICard from './KPICard'
import ChartSection from './ChartSection'
import ServiceMixChart from './ServiceMixChart'
import PatientMixChart from './PatientMixChart'
import PredictionsLog from './PredictionsLog'
import ConfidenceBadge from './ConfidenceBadge'
import {
  ArrowLeft, Moon, Sun, Download, Globe,
  Building2, Stethoscope, Users, CreditCard,
  TrendingUp, Activity, PieChart, BarChart3,
  ChevronDown, ChevronUp
} from 'lucide-react'

function GaugeChart({ value, max }) {
  const pct = Math.min((value / max) * 100, 100)
  const color = pct >= 70 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#f87171'
  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/10" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${pct * 2.51} 251`} strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-mono font-bold">{value}</span>
        <span className="text-xs text-white/40">of {max}</span>
      </div>
    </div>
  )
}

export default function Dashboard({ data, onScrapeNew }) {
  const { theme, toggleTheme } = useTheme()
  const [showPredictions, setShowPredictions] = useState(false)

  const confidenceColor = data.overall_confidence >= 0.7 ? 'text-emerald-400' : data.overall_confidence >= 0.4 ? 'text-amber-400' : 'text-red-400'
  const confidenceBg = data.overall_confidence >= 0.7 ? 'bg-emerald-400/20' : data.overall_confidence >= 0.4 ? 'bg-amber-400/20' : 'bg-red-400/20'

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scrape-${Date.now()}.json`
    a.click()
  }

  const totalFields = data.scrape_summary.total_scraped + data.scrape_summary.total_predicted
  const scrapedPct = (data.scrape_summary.total_scraped / totalFields) * 100

  return (
    <div className="min-h-screen pb-20">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 glass-card border-b border-white/10 rounded-none px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={onScrapeNew} className="p-2 rounded-lg hover:bg-white/10 transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <img
              src={data.favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(data.url)}&sz=64`}
              alt="" className="w-8 h-8 rounded-lg bg-white/10 shrink-0"
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate text-sm md:text-base">{data.url}</span>
                <ConfidenceBadge type={data.clinic_type} className="shrink-0" />
              </div>
              <div className="text-xs text-white/50">Scraped {new Date(data.timestamp).toLocaleString()}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className={`px-3 py-1.5 rounded-lg ${confidenceBg} ${confidenceColor} text-sm font-bold font-mono`}>
              {Math.round(data.overall_confidence * 100)}% Confidence
            </div>
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleExport} className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-electric-blue/10 text-electric-blue hover:bg-electric-blue/20 transition-all text-sm font-medium">
              <Download className="w-4 h-4" /> Export JSON
            </button>
            <button onClick={onScrapeNew} className="px-4 py-2 rounded-lg bg-electric-blue text-electric-dark font-semibold text-sm hover:bg-electric-blue/90 transition-all">
              Scrape New URL
            </button>
          </div>
        </div>
      </header>

      {/* Confidence Legend */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6 animate-fade-in-up">
        <div className="glass-card px-4 py-3 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2" title="Data extracted directly from the website">
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            <span className="text-white/70">Scraped Data</span>
          </div>
          <div className="flex items-center gap-2" title="Values estimated by our AI prediction engine based on available signals">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-white/70">AI Predicted</span>
          </div>
          <div className="ml-auto text-white/40 text-xs hidden md:block">Hover badges for prediction methodology details</div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8 space-y-8">
        {/* Section 1: Financial Overview */}
        <section className="animate-fade-in-up delay-100">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-electric-blue" />
            <h2 className="text-xl font-semibold">Financial Overview</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Revenue (Latest Year)" data={data.financial.revenue_latest} icon={TrendingUp} />
            <KPICard title="EBITDA Margin" data={data.financial.ebitda_margin} icon={Activity} />
            <KPICard title="Gross Margin" data={data.financial.gross_margin} icon={PieChart} />
            <KPICard title="Avg Transaction Value" data={data.financial.avg_transaction_value} icon={CreditCard} />
            <KPICard title="CAC" data={data.financial.cac} icon={Users} />
            <KPICard title="LTV" data={data.financial.ltv} icon={TrendingUp} />
            <KPICard title="Marketing Spend" data={data.financial.marketing_spend_pct} icon={BarChart3} />
            <KPICard title="Investment per Clinic" data={data.financial.investment_per_clinic} icon={Building2} />
          </div>
        </section>

        {/* Section 2: Revenue Trends */}
        <section className="animate-fade-in-up delay-200">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-electric-blue" />
            <h2 className="text-xl font-semibold">Revenue Trends</h2>
          </div>
          <ChartSection data={data.revenue_trends} />
        </section>

        {/* Section 3: Outlet & Capacity */}
        <section className="animate-fade-in-up delay-300">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-electric-blue" />
            <h2 className="text-xl font-semibold">Outlets & Capacity</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="glass-card p-6 flex flex-col items-center justify-center">
              <div className="text-white/50 text-sm mb-2">Total Outlets</div>
              <div className="metric-value text-4xl text-electric-blue">{data.outlets.total}</div>
            </div>
            <div className="glass-card p-6 lg:col-span-2">
              <div className="text-white/50 text-sm mb-4">Revenue by City</div>
              <div className="space-y-3">
                {Object.entries(data.outlets.by_city).map(([city, count]) => (
                  <div key={city} className="flex items-center gap-3">
                    <span className="text-sm w-32 shrink-0">{city}</span>
                    <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden">
                      <div className="h-full bg-electric-blue/60 rounded-lg flex items-center justify-end px-2" style={{ width: `${(count / data.outlets.total) * 100}%` }}>
                        <span className="text-xs font-mono font-bold">{count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Operational Metrics */}
        <section className="animate-fade-in-up delay-100">
          <div className="flex items-center gap-2 mb-4">
            <Stethoscope className="w-5 h-5 text-electric-blue" />
            <h2 className="text-xl font-semibold">Operational Metrics</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="glass-card p-5"><div className="text-white/50 text-sm mb-1">Doctors</div><div className="metric-value">{data.operational.doctors}</div></div>
            <div className="glass-card p-5"><div className="text-white/50 text-sm mb-1">Dentists</div><div className="metric-value">{data.operational.dentists}</div></div>
            <div className="glass-card p-5"><div className="text-white/50 text-sm mb-1">Therapists</div><div className="metric-value">{data.operational.therapists}</div></div>
            <KPICard title="Doctor Utilization" data={data.operational.doctor_utilization} />
            <KPICard title="Patients per Doctor / Day" data={data.operational.patients_per_doctor_per_day} />
            <div className="glass-card p-5"><div className="text-white/50 text-sm mb-1">Treatment Rooms</div><div className="metric-value">{data.operational.treatment_rooms}</div></div>
            <div className="glass-card p-5"><div className="text-white/50 text-sm mb-1">Opening Hours</div><div className="metric-value text-lg">{data.operational.opening_hours}</div></div>
            <div className="glass-card p-5"><div className="text-white/50 text-sm mb-1">Operating Days/Year</div><div className="metric-value">{data.operational.operating_days_per_year}</div></div>
          </div>
        </section>

        {/* Section 5: Patient Metrics */}
        <section className="animate-fade-in-up delay-200">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-electric-blue" />
            <h2 className="text-xl font-semibold">Patient Metrics</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard title="Total Patients" data={data.patient_metrics.total_patients} />
            <KPICard title="New Patients/Month" data={data.patient_metrics.new_patients_per_month} />
            <KPICard title="Visit Frequency/Year" data={data.patient_metrics.visit_frequency_per_year} />
            <KPICard title="Avg Waiting Time" data={data.patient_metrics.avg_waiting_time} />
            <div className="glass-card p-5 flex flex-col items-center">
              <div className="text-white/50 text-sm mb-3">Retention Rate</div>
              <GaugeChart value={data.patient_metrics.retention_rate.value} max={100} />
              <div className="mt-2"><ConfidenceBadge source={data.patient_metrics.retention_rate.source} confidence={data.patient_metrics.retention_rate.confidence} /></div>
            </div>
            <div className="glass-card p-5 flex flex-col items-center">
              <div className="text-white/50 text-sm mb-3">NPS Score</div>
              <GaugeChart value={data.patient_metrics.nps_score.value} max={100} />
              <div className="mt-2"><ConfidenceBadge source={data.patient_metrics.nps_score.source} confidence={data.patient_metrics.nps_score.confidence} /></div>
            </div>
          </div>
        </section>

        {/* Section 6: Patient Mix */}
        <section className="animate-fade-in-up delay-300">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-electric-blue" />
            <h2 className="text-xl font-semibold">Patient Mix</h2>
          </div>
          <PatientMixChart data={data.patient_mix} />
        </section>

        {/* Section 7: Service Mix */}
        <section className="animate-fade-in-up delay-100">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-electric-blue" />
            <h2 className="text-xl font-semibold">Service Mix</h2>
          </div>
          <ServiceMixChart skinData={data.service_mix.skin} dentalData={data.service_mix.dental} clinicType={data.clinic_type} />
        </section>

        {/* Section 8: Dental Specific */}
        {(data.clinic_type === 'dental' || data.clinic_type === 'both') && (
          <section className="animate-fade-in-up delay-200">
            <div className="flex items-center gap-2 mb-4">
              <Stethoscope className="w-5 h-5 text-electric-blue" />
              <h2 className="text-xl font-semibold">Dental Specific Metrics</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <KPICard title="Dentist Utilization" data={data.dental_specific.dentist_utilization} />
              <KPICard title="Chair Utilization" data={data.dental_specific.chair_utilization} />
              <KPICard title="Visits per Chair/Day" data={data.dental_specific.visits_per_chair_per_day} />
              <KPICard title="Patients per Dentist/Day" data={data.dental_specific.patients_per_dentist_per_day} />
              <KPICard title="Avg Treatment Duration" data={data.dental_specific.avg_treatment_duration} />
              <KPICard title="Appointment Slot Utilization" data={data.dental_specific.appointment_slot_utilization} />
            </div>
          </section>
        )}

        {/* Section 9: Membership & Marketing */}
        <section className="animate-fade-in-up delay-300">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-electric-blue" />
            <h2 className="text-xl font-semibold">Membership & Marketing</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-6">
              <div className="text-white/50 text-sm mb-2">Membership Package Penetration</div>
              <div className="metric-value text-4xl text-electric-blue">{data.membership_marketing.membership_penetration.value}{data.membership_marketing.membership_penetration.unit}</div>
              <div className="mt-2"><ConfidenceBadge source={data.membership_marketing.membership_penetration.source} confidence={data.membership_marketing.membership_penetration.confidence} /></div>
            </div>
            <div className="glass-card p-6">
              <div className="text-white/50 text-sm mb-4">Marketing Spend vs Industry Benchmark</div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1"><span>Current</span><span className="font-mono font-bold">{data.membership_marketing.marketing_spend_pct.value}%</span></div>
                  <div className="h-4 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-electric-blue rounded-full" style={{ width: `${(data.membership_marketing.marketing_spend_pct.value / 20) * 100}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span>Industry Benchmark</span><span className="font-mono font-bold">{data.membership_marketing.industry_benchmark}%</span></div>
                  <div className="h-4 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-white/30 rounded-full" style={{ width: `${(data.membership_marketing.industry_benchmark / 20) * 100}%` }} /></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 10: Predictions Log */}
        <section className="animate-fade-in-up delay-100">
          <button onClick={() => setShowPredictions(!showPredictions)} className="w-full glass-card p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl font-semibold">Predictions Log</h2>
              <span className="text-white/40 text-sm ml-2">{data.predictions_log.length} predictions</span>
            </div>
            {showPredictions ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {showPredictions && <div className="mt-2"><PredictionsLog data={data.predictions_log} /></div>}
        </section>

        {/* Section 11: Scrape Summary Footer */}
        <footer className="glass-card p-6 animate-fade-in-up delay-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/60">Data Sources</span>
                <span className="font-mono text-sm">{data.scrape_summary.total_scraped} scraped · {data.scrape_summary.total_predicted} predicted</span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-400 rounded-l-full" style={{ width: `${scrapedPct}%` }} />
                <div className="h-full bg-amber-400 rounded-r-full" style={{ width: `${100 - scrapedPct}%` }} />
              </div>
              <div className="flex gap-4 mt-2 text-xs text-white/40">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" />Scraped ({Math.round(scrapedPct)}%)</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" />Predicted ({Math.round(100 - scrapedPct)}%)</div>
              </div>
            </div>
            <button onClick={handleExport} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-electric-blue text-electric-dark font-semibold hover:bg-electric-blue/90 transition-all shrink-0">
              <Download className="w-5 h-5" /> Download JSON
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}