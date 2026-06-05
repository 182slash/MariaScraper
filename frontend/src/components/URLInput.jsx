import { useState } from 'react'
import { useScraper } from '../hooks/useScraper'
import { Globe, ArrowRight, AlertCircle, RotateCcw, Clock, Layers } from 'lucide-react'

// Must match the PHASES array in useScraper.js exactly (same order, same count).
const PHASE_STEPS = [
  { label: 'Connect',  icon: '⬡' },
  { label: 'Crawl',    icon: '⬡' },
  { label: 'Extract',  icon: '⬡' },
  { label: 'Predict',  icon: '⬡' },
  { label: 'Score',    icon: '⬡' },
  { label: 'Render',   icon: '⬡' },
]

// Progress thresholds at which each step becomes "done".
// Derived from PHASES[n].start in useScraper.js.
const PHASE_THRESHOLDS = [12, 30, 52, 72, 88, 100]

export default function URLInput({ onSuccess, recent }) {
  const [url, setUrl] = useState('')
  const { scrape, loading, error, progress, statusMessage, elapsedSecs } = useScraper()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    try {
      const data = await scrape(url)
      onSuccess(data)
    } catch {}
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* ── Background ─────────────────────────────────────────────────────── */}
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

        {/* ── Header ─────────────────────────────────────────────────────────── */}
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

        {/* ── Recent ─────────────────────────────────────────────────────────── */}
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
                  {item.url.replace(/^https?:\/\//, '').slice(0, 35)}
                  {item.url.length > 35 ? '…' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── URL form ────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="animate-fade-in-up delay-200">
          <div className="glass-card p-2 flex items-center gap-2"
            style={{
              borderColor: 'rgba(0,210,255,0.2)',
              boxShadow: '0 0 0 1px rgba(0,210,255,0.04), 0 8px 40px rgba(0,0,0,0.5)',
            }}>
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

        {/* ── Progress card ───────────────────────────────────────────────────── */}
        {loading && (
          <div className="mt-5 glass-card p-5 animate-fade-in-up"
            style={{ borderColor: 'rgba(0,210,255,0.15)' }}>

            <style>{`
              @keyframes shimmer {
                0%   { transform: translateX(-100%); }
                100% { transform: translateX(400%); }
              }
              @keyframes pulse-text {
                0%, 100% { opacity: 1; }
                50%       { opacity: 0.55; }
              }
              @keyframes spin-ring {
                0%   { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes breathe-bar {
                0%, 100% { box-shadow: 0 0 6px rgba(0,210,255,0.4); }
                50%       { box-shadow: 0 0 16px rgba(0,210,255,0.8), 0 0 28px rgba(120,80,255,0.35); }
              }
              @keyframes pip-done {
                0%   { transform: scale(0.6); opacity: 0; }
                60%  { transform: scale(1.15); opacity: 1; }
                100% { transform: scale(1);    opacity: 1; }
              }
            `}</style>

            {/* Status row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                {/* Spinning ring */}
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  border: '1.5px solid rgba(0,210,255,0.15)',
                  borderTopColor: '#00D2FF',
                  borderRightColor: '#7850FF',
                  animation: 'spin-ring 0.75s linear infinite',
                }} />
                <span style={{
                  color: '#00D2FF', fontSize: '13px', fontWeight: 500,
                  animation: 'pulse-text 2.2s ease-in-out infinite',
                }}>
                  {statusMessage}
                </span>
              </div>

              {/* Right side: elapsed + percent */}
              <div className="flex items-center gap-3">
                {elapsedSecs !== null && (
                  <span className="font-mono text-xs flex items-center gap-1"
                    style={{ color: 'rgba(255,255,255,0.28)' }}>
                    <Clock style={{ width: 10, height: 10 }} />
                    {elapsedSecs}s
                  </span>
                )}
                <span className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {Math.round(progress)}%
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4 rounded-full overflow-hidden"
              style={{ height: 2, background: 'rgba(255,255,255,0.06)', position: 'relative' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0,
                width: `${progress}%`, height: '100%',
                background: 'linear-gradient(90deg, #00D2FF, #7850FF)',
                animation: 'breathe-bar 2s ease-in-out infinite',
                transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
                borderRadius: 9999,
              }} />
              {/* Shimmer sweep */}
              <div style={{
                position: 'absolute', top: 0, left: 0,
                width: `${progress}%`, height: '100%',
                overflow: 'hidden', borderRadius: 9999,
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '25%', height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                  animation: 'shimmer 1.8s ease-in-out infinite',
                }} />
              </div>
            </div>

            {/* Phase step indicators */}
            <div className="flex gap-1.5">
              {PHASE_STEPS.map((step, i) => {
                const threshold = PHASE_THRESHOLDS[i]
                const prevThreshold = i === 0 ? 0 : PHASE_THRESHOLDS[i - 1]
                const done   = progress >= threshold
                const active = progress >= prevThreshold && !done

                return (
                  <div key={step.label} className="flex-1 flex flex-col gap-1.5">
                    {/* Segment bar */}
                    <div className="rounded-full" style={{
                      height: 2,
                      background: done
                        ? 'linear-gradient(90deg, #00D2FF, #7850FF)'
                        : active
                          ? 'rgba(0,210,255,0.30)'
                          : 'rgba(255,255,255,0.07)',
                      boxShadow: done
                        ? '0 0 6px rgba(0,210,255,0.55)'
                        : active
                          ? '0 0 4px rgba(0,210,255,0.25)'
                          : 'none',
                      transition: 'background 0.35s ease, box-shadow 0.35s ease',
                    }} />

                    {/* Pip dot */}
                    <div className="flex items-center gap-1">
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                        background: done
                          ? '#00D2FF'
                          : active
                            ? 'rgba(0,210,255,0.45)'
                            : 'rgba(255,255,255,0.12)',
                        boxShadow: done ? '0 0 5px rgba(0,210,255,0.7)' : 'none',
                        animation: done ? 'pip-done 0.35s ease forwards' : 'none',
                        transition: 'background 0.3s ease',
                      }} />
                      <span style={{
                        fontSize: '9px',
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        color: done
                          ? 'rgba(0,210,255,0.75)'
                          : active
                            ? 'rgba(255,255,255,0.42)'
                            : 'rgba(255,255,255,0.18)',
                        transition: 'color 0.3s ease',
                      }}>
                        {step.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Sub-text: reassurance that deep analysis is running */}
            <p style={{
              marginTop: 14,
              fontSize: '11px',
              color: 'rgba(255,255,255,0.22)',
              lineHeight: 1.5,
            }}>
              Deep analysis crawls sub-pages for staff, pricing & location data.
              This typically takes 15–25 seconds.
            </p>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────────────────── */}
        {error && (
          <div className="mt-4 glass-card card-red p-5 animate-fade-in-up">
            <div className="flex gap-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#FF3C64' }} />
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: '#FF3C64' }}>Analysis Failed</p>
                <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>{error}</p>
                <button
                  onClick={() => scrape(url).then(onSuccess).catch(() => {})}
                  className="btn-ghost text-xs">
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