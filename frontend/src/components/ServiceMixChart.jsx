import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function ServiceMixChart({ skinData, dentalData, clinicType }) {
  const showSkin = clinicType === 'skin' || clinicType === 'both'
  const showDental = clinicType === 'dental' || clinicType === 'both'

  const renderChart = (data, title) => (
    <div className="glass-card p-6 animate-fade-in-up">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} unit="%" />
            <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} width={140} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} formatter={(v) => [`${v}%`, 'Revenue Share']} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.source === 'scraped' ? '#00D4FF' : '#fbbf24'} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )

  return (
    <div className={`grid ${showSkin && showDental ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-4`}>
      {showSkin && renderChart(skinData, 'Skin Clinic Services')}
      {showDental && renderChart(dentalData, 'Dental Clinic Services')}
    </div>
  )
}