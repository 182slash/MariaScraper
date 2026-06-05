import { Zap, Database } from 'lucide-react'

export default function ConfidenceBadge({ source, confidence, type, className = '' }) {
  if (type) {
    const map = {
      skin:    { color: '#A78BFF', bg: 'rgba(167,139,255,0.1)', border: 'rgba(167,139,255,0.25)' },
      dental:  { color: '#00D2FF', bg: 'rgba(0,210,255,0.1)',   border: 'rgba(0,210,255,0.25)'   },
      both:    { color: '#00D2FF', bg: 'rgba(0,210,255,0.1)',   border: 'rgba(0,210,255,0.25)'   },
      unknown: { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
    }
    const s = map[type] || map.unknown
    return (
      <span className={`pill ${className}`}
        style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
        {type}
      </span>
    )
  }

  const isPredicted = source === 'predicted'
  const color  = isPredicted ? '#FFB800' : '#00DC82'
  const bg     = isPredicted ? 'rgba(255,184,0,0.09)'  : 'rgba(0,220,130,0.09)'
  const border = isPredicted ? 'rgba(255,184,0,0.22)'  : 'rgba(0,220,130,0.22)'

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="pill" style={{ background: bg, border: `1px solid ${border}`, color }}>
        {isPredicted
          ? <Zap className="w-2.5 h-2.5" />
          : <Database className="w-2.5 h-2.5" />}
        {isPredicted ? 'MS' : 'Live'}
      </span>
      {confidence !== undefined && (
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-px rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full"
              style={{ width: `${confidence * 100}%`, background: color, boxShadow: `0 0 4px ${color}` }} />
          </div>
          <span style={{ fontSize: '10px', fontFamily: 'Space Mono, monospace', color: 'rgba(255,255,255,0.3)' }}>
            {Math.round(confidence * 100)}%
          </span>
        </div>
      )}
    </div>
  )
}