import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function ChartSection({ data }) {
  const [metric, setMetric] = useState('revenue')

  const metrics = {
    revenue: { label: 'Revenue', key: 'revenue', unit: 'B IDR' },
    per_outlet: { label: 'Per Outlet', key: 'revenue_per_outlet', unit: 'B IDR' },
    per_patient: { label: 'Per Patient', key: 'revenue_per_patient', unit: 'M IDR' },
    per_visit: { label: 'Per Visit', key: 'revenue_per_visit', unit: 'M IDR' },
  }

  const chartData = data.years.map((year, i) => ({
    year,
    value: data[metrics[metric].key][i],
  }))

  return (
    <div className="glass-card p-6">
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(metrics).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setMetric(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${metric === key ? 'bg-electric-blue text-electric-dark' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
            <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
            <Line type="monotone" dataKey="value" stroke="#00D4FF" strokeWidth={3} dot={{ fill: '#00D4FF', strokeWidth: 2, r: 5 }} activeDot={{ r: 7 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}