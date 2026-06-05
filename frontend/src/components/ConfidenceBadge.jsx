import { Zap, Database } from 'lucide-react'

export default function ConfidenceBadge({ source, confidence, type, className = '' }) {
  if (type) {
    const styles = {
      skin:    { bg: 'rgba(191,95,255,0.12)', border: 'rgba(191,95,255,0.3)', color: '#BF5FFF' },
      dental:  { bg: 'rgba(0,255,229,0.10)',  border: 'rgba(0,255,229,0.3)',  color: '#00FFE5' },
      both:    { bg: 'rgba(0,255,229,0.10)',  border: 'rgba(0,255,229,0.3)',  color: '#00FFE5' },
      unknown: { bg: 'rgba(255,255,255,0.06)',border: 'rgba(255,255,255,0.12)',color: 'rgba(255,255,255,0.5)' },
    }
    const s = styles[type] || styles.unknown
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${className}`}
        style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
      >
        {type}
      </span>
    )
  }

  const isPredicted = source === 'predicted'
  const color     = isPredicted ? '#FFB800' : '#00FF94'
  const bgColor   = isPredicted ? 'rgba(255,184,0,0.10)'  : 'rgba(0,255,148,0.10)'
  const bdColor   = isPredicted ? 'rgba(255,184,0,0.25)'  : 'rgba(0,255,148,0.25)'

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
        style={{ background: bgColor, border: `1px solid ${bdColor}`, color }}
      >
        {isPredicted ? <Zap className="w-3 h-3" /> : <Database className="w-3 h-3" />}
        {isPredicted ? 'MS' : 'Live'}
      </span>

      {confidence !== undefined && (
        <div className="flex items-center gap-1.5">
          <div className="w-14 h-1 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${confidence * 100}%`, background: color, boxShadow: `0 0 6px ${color}60` }}
            />
          </div>
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {Math.round(confidence * 100)}%
          </span>
        </div>
      )}
    </div>
  )
}