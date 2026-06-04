import { useState } from 'react'
import { useScraper } from '../hooks/useScraper'
import { Globe, ArrowRight, AlertCircle, RotateCcw, Clock } from 'lucide-react'

export default function URLInput({ onSuccess, recent }) {
  const [url, setUrl] = useState('')
  const { scrape, loading, error, progress, statusMessage } = useScraper()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    try {
      const data = await scrape(url)
      onSuccess(data)
    } catch { /* handled in hook */ }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-electric-blue/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-electric-blue/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-2xl relative z-10 animate-fade-in-up">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-electric-blue/10 border border-electric-blue/20 mb-6">
            <Globe className="w-8 h-8 text-electric-blue" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-sans mb-3 tracking-tight">
            Clinic Analytics <span className="text-electric-blue">Scraper</span>
          </h1>
          <p className="text-white/60 text-lg">
            Enter any clinic website URL to extract financial & operational insights
          </p>
        </div>

        {recent.length > 0 && (
          <div className="mb-6 animate-fade-in-up delay-100">
            <div className="flex items-center gap-2 text-sm text-white/50 mb-3">
              <Clock className="w-4 h-4" />
              <span>Recent analyses</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {recent.map((item, i) => (
                <button
                  key={i}
                  onClick={() => setUrl(item.url)}
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 hover:border-electric-blue/30 transition-all"
                >
                  {item.url.replace(/^https?:\/\//, '').slice(0, 30)}
                  {item.url.length > 30 ? '...' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative animate-fade-in-up delay-200">
          <div className="glass-card p-2 flex items-center gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter any clinic website URL"
              className="flex-1 bg-transparent px-4 py-3 text-lg outline-none placeholder:text-white/30"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-electric-blue text-electric-dark font-semibold px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-electric-blue/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {loading ? 'Analyzing...' : 'Analyze Website'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </form>

        {loading && (
          <div className="mt-8 glass-card p-6 animate-fade-in-up">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-electric-blue font-medium">{statusMessage}</span>
              <span className="font-mono text-white/60">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-electric-blue rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex gap-2 mt-4">
              {['Connecting', 'Financials', 'Patients', 'AI Engine', 'Dashboard'].map((step, i) => (
                <div key={step} className={`flex-1 h-1 rounded-full transition-all duration-300 ${progress >= ((i + 1) / 5) * 100 ? 'bg-electric-blue' : 'bg-white/10'}`} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 glass-card p-6 border-red-500/30 bg-red-500/5 animate-fade-in-up">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-400 mb-1">Analysis Failed</h3>
                <p className="text-white/60 text-sm mb-4">{error}</p>
                <button
                  onClick={() => { setError(null); scrape(url).then(onSuccess).catch(()=>{}) }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}