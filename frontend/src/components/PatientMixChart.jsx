import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS = ['#00D4FF', '#fbbf24', '#34d399', '#f87171', '#a78bfa', '#fb923c']

function DonutChart({ data, labels, title }) {
  const chartData = data.map((value, i) => ({ name: labels[i], value }))
  return (
    <div className="glass-card p-6 flex flex-col items-center animate-fade-in-up">
      <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} formatter={(v) => `${v}%`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 mt-2 justify-center">
        {chartData.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-sm text-white/70">{entry.name}</span>
            <span className="text-sm font-mono font-bold">{entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PatientMixChart({ data }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <DonutChart data={data.new_vs_repeat} labels={['New', 'Repeat']} title="New vs Repeat Patients" />
      <DonutChart data={data.walkin_vs_appointment} labels={['Walk-in', 'Appointment']} title="Walk-in vs Appointment" />
      <DonutChart data={data.corporate_vs_retail} labels={['Corporate', 'Retail']} title="Corporate vs Retail" />
    </div>
  )
}