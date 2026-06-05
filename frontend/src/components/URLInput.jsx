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

      {/* Ambient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,255,229,0.06) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(191,95,255,0.06) 0%, transparent 70%)' }} />
        {/* Grid */}
        <div className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `linear-gradient(rgba(0,255,229,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,229,0.04) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }} />
      </div>

      <div className="w-full max-w-xl relative z-10 animate-fade-in-up">

        {/* Logo / Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
            style={{
              background: 'rgba(0,255,229,0.08)',
              border: '1px solid rgba(0,255,229,0.2)',
              boxShadow: '0 0 30px rgba(0,255,229,0.12)',
            }}>
            <Globe className="w-8 h-8" style={{ color: '#00FFE5' }} />
          </div>

          <h1 className="text-5xl font-bold font-display mb-3 tracking-tight">
            Maria{' '}
            <span style={{
              color: '#00FFE5',
              textShadow: '0 0 30px rgba(0,255,229,0.5)',
            }}>
              Scraper
            </span>
          </h1>
          <p className="text-white/40 text-base leading-relaxed">
            Enter any clinic URL to extract financial &amp; operational intelligence
          </p>
        </div>

        {/* Recent */}
        {recent.length > 0 && (
          <div className="mb-5 animate-fade-in-up delay-100">
            <div className="flex items-center gap-2 text-xs text-white/30 mb-3 uppercase tracking-widest">
              <Clock className="w-3.5 h-3.5" />
              <span>Recent</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {recent.map((item, i) => (
                <button key={i} onClick={() => setUrl(item.url)}
                  className="px-3 py-1.5 rounded-full text-xs text-white/50 transition-all hover:text-white/80"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,255,229,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                >
                  {item.url.replace(/^https?:\/\//, '').slice(0, 32)}{item.url.length > 32 ? '…' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input form */}
        <form onSubmit={handleSubmit} className="animate-fade-in-up delay-200">
          <div className="flex items-center gap-2 p-2 rounded-2xl"
            style={{
              background: 'rgba(13,23,41,0.8)',
              border: '1px solid rgba(0,255,229,0.2)',
              boxShadow: '0 0 0 1px rgba(0,255,229,0.05), 0 8px 32px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(20px)',
            }}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://clinic-website.com"
              className="flex-1 bg-transparent px-4 py-3 text-base outline-none"
              style={{ color: 'rgba(255,255,255,0.9)', caretColor: '#00FFE5' }}
              required
            />
            <button type="submit" disabled={loading} className="btn-solid px-5 py-3 shrink-0 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl">
              {loading ? 'Analyzing…' : 'Analyze'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Progress */}
        {loading && (
          <div className="mt-6 p-5 rounded-2xl animate-fade-in-up"
            style={{
              background: 'rgba(13,23,41,0.8)',
              border: '1px solid rgba(0,255,229,0.15)',
              backdropFilter: 'blur(20px)',
            }}>
            <div className="flex justify-between text-sm mb-2">
              <span style={{ color: '#00FFE5', fontWeight: 500 }}>{statusMessage}</span>
              <span className="font-mono text-white/40">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #00FFE5, #BF5FFF)',
                  boxShadow: '0 0 10px rgba(0,255,229,0.5)',
                }} />
            </div>
            <div className="flex gap-1.5 mt-3">
              {['Connect', 'Finance', 'Patients', 'AI', 'Build'].map((step, i) => (
                <div key={step} className="flex-1 h-0.5 rounded-full transition-all duration-300"
                  style={{ background: progress >= ((i + 1) / 5) * 100 ? '#00FFE5' : 'rgba(255,255,255,0.08)' }} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-5 p-5 rounded-2xl animate-fade-in-up"
            style={{
              background: 'rgba(255,45,120,0.06)',
              border: '1px solid rgba(255,45,120,0.25)',
              backdropFilter: 'blur(20px)',
            }}>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#FF2D78' }} />
              <div className="flex-1">
                <p className="font-semibold text-sm mb-1" style={{ color: '#FF2D78' }}>Analysis Failed</p>
                <p className="text-white/50 text-sm mb-3">{error}</p>
                <button
                  onClick={() => scrape(url).then(onSuccess).catch(() => {})}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white/60 hover:text-white transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Try Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}