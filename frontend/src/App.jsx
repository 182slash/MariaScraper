import { useState, useEffect, createContext, useContext } from 'react'
import URLInput from './components/URLInput'
import Dashboard from './components/Dashboard'

export const ThemeContext = createContext()
export const useTheme = () => useContext(ThemeContext)

function App() {
  const [theme,  setTheme]  = useState('dark')
  const [view,   setView]   = useState('input')
  const [data,   setData]   = useState(null)
  const [recent, setRecent] = useState([])

  useEffect(() => {
    const saved = localStorage.getItem('recent_scrapes')
    if (saved) setRecent(JSON.parse(saved))
    const savedTheme = localStorage.getItem('theme') || 'dark'
    setTheme(savedTheme)
    document.documentElement.classList.toggle('light', savedTheme === 'light')
    document.documentElement.classList.toggle('dark',  savedTheme === 'dark')
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('light', next === 'light')
    document.documentElement.classList.toggle('dark',  next === 'dark')
  }

  const handleSuccess = (result) => {
    // FIX 1: clear stale data FIRST so Dashboard fully unmounts before
    // re-mounting with fresh props — no old numbers can flash on screen.
    setData(null)
    setView('input')

    // FIX 2: let the null render flush, then set fresh data and switch view.
    requestAnimationFrame(() => {
      setData(result)
      setView('dashboard')

      // Keep recent list — deduplicate by URL, max 5 entries.
      setRecent(prev => {
        const deduped = [result, ...prev.filter(r => r.url !== result.url)].slice(0, 5)
        localStorage.setItem('recent_scrapes', JSON.stringify(deduped))
        return deduped
      })
    })
  }

  // FIX 3: going back also clears data so stale state never sits in memory.
  const handleScrapeNew = () => {
    setData(null)
    setView('input')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="min-h-screen transition-colors duration-300">
        {view === 'input' ? (
          <URLInput onSuccess={handleSuccess} recent={recent} />
        ) : (
          <Dashboard data={data} onScrapeNew={handleScrapeNew} />
        )}
      </div>
    </ThemeContext.Provider>
  )
}

export default App