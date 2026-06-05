import ConfidenceBadge from './ConfidenceBadge'

export default function KPICard({ title, data, icon: Icon }) {
  const isPredicted = data?.source === 'predicted'
  const hasValue = data?.value != null

  const cardClass = isPredicted ? 'glass-card glass-card-amber' : 'glass-card glass-card-green'
  const valueClass = isPredicted ? 'text-neon-amber' : 'text-neon-green'

  return (
    <div className={`${cardClass} p-5 transition-all duration-200 hover:scale-[1.01]`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-white/45 text-xs font-medium uppercase tracking-widest">{title}</span>
        {Icon && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 border border-white/8">
            <Icon className="w-3.5 h-3.5 text-white/30" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 mb-3 min-h-[36px]">
        {hasValue ? (
          <>
            <span className={`metric-value ${valueClass}`}>
              {typeof data.value === 'number' && data.value > 1000000
                ? (data.value / 1000000000 >= 1
                    ? `${(data.value / 1000000000).toFixed(1)}B`
                    : `${(data.value / 1000000).toFixed(1)}M`)
                : data.value}
            </span>
            <span className="text-white/35 text-sm font-medium">{data?.unit ?? ''}</span>
          </>
        ) : (
          <span className="metric-value text-white/20">—</span>
        )}
      </div>

      <ConfidenceBadge source={data?.source} confidence={data?.confidence} />
    </div>
  )
}