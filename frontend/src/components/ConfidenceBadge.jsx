import { Zap, Database } from 'lucide-react'

export default function ConfidenceBadge({ source, confidence, type, className = '' }) {
  if (type) {
    const colors = {
      skin: 'bg-purple-400/20 text-purple-400 border-purple-400/30',
      dental: 'bg-cyan-400/20 text-cyan-400 border-cyan-400/30',
      both: 'bg-electric-blue/20 text-electric-blue border-electric-blue/30',
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${colors[type] || colors.both} ${className}`}>
        {type}
      </span>
    )
  }

  const isPredicted = source === 'predicted'
  const colorClass = isPredicted
    ? 'bg-amber-400/15 text-amber-400 border-amber-400/25'
    : 'bg-emerald-400/15 text-emerald-400 border-emerald-400/25'

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${colorClass}`}>
        {isPredicted ? <Zap className="w-3 h-3" /> : <Database className="w-3 h-3" />}
        {isPredicted ? 'AI' : 'Live'}
      </span>
      {confidence !== undefined && (
        <div className="flex items-center gap-1">
          <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${isPredicted ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${confidence * 100}%` }} />
          </div>
          <span className="text-xs text-white/40 font-mono">{Math.round(confidence * 100)}%</span>
        </div>
      )}
    </div>
  )
}