import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function ChartSection({ data }) {
  const [metric, setMetric] = useState('revenue')

  const metrics = {
    revenue:     { label: 'Revenue',     key: 'revenue',              unit: 'B IDR' },
    per_outlet:  { label: 'Per Outlet',  key: 'revenue_per_outlet',   unit: 'B IDR' },
    per_patient: { label: 'Per Patient', key: 'revenue_per_patient',  unit: 'M IDR' },
    per_visit:   { label: 'Per Visit',   key: 'revenue_per_visit',    unit: 'M IDR' },
  }

  const activeKey = metrics[metric].key
  const activeUnit = metrics[metric].unit

  const chartData = data.years
    .map((year, i) => ({ year, value: data[activeKey]?.[i] ?? null }))
    .filter(d => d.value !== null)

  const hasData = chartData.length > 0

  return (
    <div className="glass-card p-6">
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(metrics).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setMetric(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              metric === key
                ? 'bg-electric-blue text-electric-dark'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="h-80">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="year"
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                tickFormatter={v => `${v}`}
              />
              <Tooltip
                contentStyle={{
  backgroundColor: '#0D1729',
  border: '1px solid rgba(0,255,229,0.25)',
  borderRadius: '10px',
  color: '#ffffff',
  boxShadow: '0 0 20px rgba(0,255,229,0.15)',
  fontSize: '13px',
}}
                formatter={v => [`${v} ${activeUnit}`, metrics[metric].label]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#00D4FF"
                strokeWidth={3}
                dot={{ fill: '#00D4FF', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-white/30">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-4 4 4 4-4" />
            </svg>
            <p className="text-sm">No historical data available for this metric</p>
            <p className="text-xs text-white/20">Revenue trends require financial data published on the clinic website</p>
          </div>
        )}
      </div>
    </div>
  )
}