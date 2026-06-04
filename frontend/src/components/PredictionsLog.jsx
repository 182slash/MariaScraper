import ConfidenceBadge from './ConfidenceBadge'

export default function PredictionsLog({ data }) {
  return (
    <div className="glass-card overflow-hidden animate-fade-in-up">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-white/50">
              <th className="text-left px-6 py-3 font-medium">Field</th>
              <th className="text-left px-6 py-3 font-medium">Prediction Method</th>
              <th className="text-left px-6 py-3 font-medium">Confidence</th>
              <th className="text-left px-6 py-3 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-6 py-3 font-medium">{row.field}</td>
                <td className="px-6 py-3 text-white/60">{row.method}</td>
                <td className="px-6 py-3"><ConfidenceBadge source="predicted" confidence={row.confidence} /></td>
                <td className="px-6 py-3 font-mono font-bold text-amber-400">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}