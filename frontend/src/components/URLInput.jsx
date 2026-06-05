import { useState } from 'react'
import { useScraper } from '../hooks/useScraper'
import { Globe, ArrowRight, AlertCircle, RotateCcw, Clock } from 'lucide-react'

const STEPS = ['Connect', 'Extract', 'Patients', 'Model', 'Render']

export default function URLInput({ onSuccess, recent }) {
  const [url, setUrl] = useState('')
  const { scrape, loading, error, progress, statusMessage } = useScraper()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    try { const data = await scrape(url); onSuccess(data) } catch {}
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* Background depth */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px]"
          style={{ background: 'radial-gradient(ellipse at center top, rgba(0,210,255,0.06) 0%, transparent 65%)' }} />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px]"
          style={{ background: 'radial-gradient(ellipse at right bottom, rgba(120,80,255,0.05) 0%, transparent 65%)' }} />
        <div className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }} />
      </div>

      <div className="w-full max-w-lg relative z-10">

        {/* Header */}
        <div className="text-center mb-14 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-7"
            style={{
              background: 'rgba(0,210,255,0.07)',
              border: '1px solid rgba(0,210,255,0.18)',
              boxShadow: '0 0 40px rgba(0,210,255,0.1)',
            }}>
            <Globe className="w-6 h-6" style={{ color: '#00D2FF' }} />
          </div>
          <div className="section-label mb-3">Clinic Intelligence Platform</div>
          <h1 className="text-4xl font-bold tracking-tight mb-3" style={{ letterSpacing: '-0.03em' }}>
            Maria{' '}
            <span style={{ color: '#00D2FF' }}>Scraper</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '15px', lineHeight: '1.6' }}>
            Extract financial & operational intelligence<br />from any clinic website
          </p>
        </div>

        {/* Recent */}
        {recent.length > 0 && (
          <div className="mb-5 animate-fade-in-up delay-100">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
              <span className="section-label">Recent</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {recent.map((item, i) => (
                <button key={i} onClick={() => setUrl(item.url)}
                  className="btn-ghost text-xs py-1.5 px-3 rounded-full">
                  {item.url.replace(/^https?:\/\//, '').slice(0, 35)}{item.url.length > 35 ? '…' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="animate-fade-in-up delay-200">
          <div className="glass-card p-2 flex items-center gap-2"
            style={{ borderColor: 'rgba(0,210,255,0.2)', boxShadow: '0 0 0 1px rgba(0,210,255,0.04), 0 8px 40px rgba(0,0,0,0.5)' }}>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://clinic-website.com"
              className="flex-1 bg-transparent px-4 py-3 outline-none text-sm"
              style={{ color: 'rgba(255,255,255,0.9)', caretColor: '#00D2FF' }}
              required
            />
            <button type="submit" disabled={loading} className="btn-solid rounded-xl shrink-0">
              {loading ? 'Analyzing…' : 'Analyze'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Progress */}
        {loading && (
          <div className="mt-5 glass-card p-5 animate-fade-in-up"
            style={{ borderColor: 'rgba(0,210,255,0.15)' }}>
            <div className="flex justify-between mb-3">
              <span style={{ color: '#00D2FF', fontSize: '13px', fontWeight: 500 }}>{statusMessage}</span>
              <span className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{Math.round(progress)}%</span>
            </div>
            <div className="h-px mb-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #00D2FF, #7850FF)',
                  boxShadow: '0 0 8px rgba(0,210,255,0.6)',
                  height: '1px',
                }} />
            </div>
            <div className="flex gap-2">
              {STEPS.map((step, i) => (
                <div key={step} className="flex-1 flex flex-col gap-1.5">
                  <div className="h-px rounded-full transition-all duration-400"
                    style={{ background: progress >= ((i + 1) / STEPS.length) * 100 ? '#00D2FF' : 'rgba(255,255,255,0.07)' }} />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em' }}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 glass-card card-red p-5 animate-fade-in-up">
            <div className="flex gap-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#FF3C64' }} />
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: '#FF3C64' }}>Analysis Failed</p>
                <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>{error}</p>
                <button onClick={() => scrape(url).then(onSuccess).catch(() => {})} className="btn-ghost text-xs">
                  <RotateCcw className="w-3 h-3" /> Try Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}