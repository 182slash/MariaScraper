import ConfidenceBadge from './ConfidenceBadge'

export default function PredictionsLog({ data }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Field', 'Method', 'Confidence', 'Value'].map(h => (
                <th key={h} className="section-label text-left px-5 py-3.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td className="px-5 py-3.5 font-mono" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                  {row.field}
                </td>
                <td className="px-5 py-3.5" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                  {row.method}
                </td>
                <td className="px-5 py-3.5">
                  <ConfidenceBadge source="predicted" confidence={row.confidence} />
                </td>
                <td className="px-5 py-3.5 font-mono font-bold" style={{ fontSize: '12px', color: '#FFB800' }}>
                  {row.value ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}