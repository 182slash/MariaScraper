import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const tooltipStyle = {
  backgroundColor: '#0D1729',
  border: '1px solid rgba(0,255,229,0.25)',
  borderRadius: '10px',
  color: '#ffffff',
  boxShadow: '0 0 20px rgba(0,255,229,0.15)',
  fontSize: '13px',
}

export default function ServiceMixChart({ skinData, dentalData, clinicType }) {
  const showSkin   = clinicType === 'skin'   || clinicType === 'both' || clinicType === 'unknown'
  const showDental = clinicType === 'dental' || clinicType === 'both' || clinicType === 'unknown'

  const renderChart = (data, title, accentColor) => (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold mb-5 uppercase tracking-widest"
        style={{ color: accentColor }}>{title}</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis
              type="number"
              stroke="rgba(255,255,255,0.1)"
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
              unit="%"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="rgba(255,255,255,0.1)"
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
              width={148}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#ffffff' }}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              formatter={(v) => [`${v}%`, 'Revenue Share']}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
              {data.map((entry, i) => {
                const color = entry.source === 'scraped' ? '#00FF94' : accentColor
                return (
                  <Cell
                    key={i}
                    fill={color}
                    fillOpacity={0.85}
                    style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
                  />
                )
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )

  return (
    <div className={`grid ${showSkin && showDental ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-4`}>
      {showSkin   && renderChart(skinData,   'Skin Clinic Services',   '#00FFE5')}
      {showDental && renderChart(dentalData, 'Dental Clinic Services', '#BF5FFF')}
    </div>
  )
}