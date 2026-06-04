import { useState, useEffect, createContext, useContext } from 'react'
import URLInput from './components/URLInput'
import Dashboard from './components/Dashboard'

export const ThemeContext = createContext()
export const useTheme = () => useContext(ThemeContext)

function App() {
  const [theme, setTheme] = useState('dark')
  const [view, setView] = useState('input')
  const [data, setData] = useState(null)
  const [recent, setRecent] = useState([])

  useEffect(() => {
    const saved = localStorage.getItem('recent_scrapes')
    if (saved) setRecent(JSON.parse(saved))
    const savedTheme = localStorage.getItem('theme') || 'dark'
    setTheme(savedTheme)
    document.documentElement.classList.toggle('light', savedTheme === 'light')
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('light', next === 'light')
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  const handleSuccess = (result) => {
    setData(result)
    setView('dashboard')
    const next = [result, ...recent].slice(0, 5)
    setRecent(next)
    localStorage.setItem('recent_scrapes', JSON.stringify(next))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="min-h-screen transition-colors duration-300">
        {view === 'input' ? (
          <URLInput onSuccess={handleSuccess} recent={recent} />
        ) : (
          <Dashboard data={data} onScrapeNew={() => setView('input')} />
        )}
      </div>
    </ThemeContext.Provider>
  )
}

export default App