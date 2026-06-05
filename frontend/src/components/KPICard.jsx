import ConfidenceBadge from './ConfidenceBadge'

export default function KPICard({ title, data, icon: Icon }) {
  const isPredicted = data?.source === 'predicted'
  const hasValue = data?.value != null

  const formatValue = (val) => {
    if (typeof val !== 'number') return val
    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`
    if (val >= 1_000_000)     return `${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000)         return `${(val / 1_000).toFixed(0)}K`
    return val
  }

  return (
    <div className={`glass-card ${isPredicted ? 'card-amber' : 'card-green'} p-5 transition-all duration-200 hover:translate-y-[-1px]`}
      style={{ cursor: 'default' }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <span className="section-label">{title}</span>
        {Icon && (
          <div className="w-6 h-6 flex items-center justify-center rounded-md"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Icon className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5 mb-4" style={{ minHeight: 36 }}>
        {hasValue ? (
          <>
            <span className="metric-value" style={{ color: isPredicted ? '#FFB800' : '#00DC82' }}>
              {formatValue(data.value)}
            </span>
            {data?.unit && (
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Space Mono, monospace' }}>
                {data.unit}
              </span>
            )}
          </>
        ) : (
          <span className="metric-value" style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
        )}
      </div>

      <ConfidenceBadge source={data?.source} confidence={data?.confidence} />
    </div>
  )
}