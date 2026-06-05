import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS = ['#00FFE5', '#FFB800', '#BF5FFF', '#FF2D78', '#00FF94', '#FF6B35']

const tooltipStyle = {
  backgroundColor: '#0D1729',
  border: '1px solid rgba(0,255,229,0.25)',
  borderRadius: '10px',
  color: '#ffffff',
  boxShadow: '0 0 20px rgba(0,255,229,0.15)',
  fontSize: '13px',
}

function DonutChart({ data, labels, title }) {
  const chartData = data.map((value, i) => ({ name: labels[i], value }))
  return (
    <div className="glass-card p-6 flex flex-col items-center">
      <h3 className="text-sm font-semibold mb-4 text-center uppercase tracking-widest text-white/50">{title}</h3>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%" cy="50%"
              innerRadius={52} outerRadius={72}
              paddingAngle={4}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={COLORS[i % COLORS.length]}
                  style={{ filter: `drop-shadow(0 0 6px ${COLORS[i % COLORS.length]}80)` }}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#ffffff' }}
              formatter={(v) => [`${v}%`]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {chartData.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length], boxShadow: `0 0 6px ${COLORS[i % COLORS.length]}` }} />
            <span className="text-xs text-white/50">{entry.name}</span>
            <span className="text-xs font-mono font-bold" style={{ color: COLORS[i % COLORS.length] }}>{entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PatientMixChart({ data }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <DonutChart data={data.new_vs_repeat}        labels={['New', 'Repeat']}          title="New vs Repeat Patients" />
      <DonutChart data={data.walkin_vs_appointment} labels={['Walk-in', 'Appointment']} title="Walk-in vs Appointment" />
      <DonutChart data={data.corporate_vs_retail}   labels={['Corporate', 'Retail']}    title="Corporate vs Retail" />
    </div>
  )
}