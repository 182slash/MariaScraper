import ConfidenceBadge from './ConfidenceBadge'

export default function KPICard({ title, data, icon: Icon }) {
  const isPredicted = data?.source === 'predicted'
  return (
    <div className={`glass-card p-5 transition-all hover:bg-white/[0.07] ${isPredicted ? 'border-amber-400/20' : 'border-white/10'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-white/50 text-sm">{title}</div>
        {Icon && <Icon className="w-4 h-4 text-white/30" />}
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className={`metric-value ${isPredicted ? 'text-amber-400' : 'text-white'}`}>
          {data?.value ?? '—'}
        </span>
        <span className="text-white/40 text-sm font-medium">{data?.unit ?? ''}</span>
      </div>
      <ConfidenceBadge source={data?.source} confidence={data?.confidence} />
    </div>
  )
}