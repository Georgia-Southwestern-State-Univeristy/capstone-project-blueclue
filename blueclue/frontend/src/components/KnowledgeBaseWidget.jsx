import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * KnowledgeBaseWidget — Quick-access widget for the Knowledge Base.
 * Shows a search bar, popular articles, and a link to the full FAQ page.
 * Uses public endpoints (no auth required).
 */
export default function KnowledgeBaseWidget() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [popular, setPopular] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  // Fetch popular articles on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/knowledge-base/search?sort=views&limit=5`)
        if (!res.ok) throw new Error(res.statusText)
        const data = await res.json()
        if (!cancelled) setPopular(data.results || [])
      } catch (err) {
        console.error('KB widget: failed to load popular articles', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Debounced search
  const handleSearch = useCallback((value) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim() || value.trim().length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/knowledge-base/search?q=${encodeURIComponent(value.trim())}&limit=5`
        )
        if (!res.ok) throw new Error(res.statusText)
        const data = await res.json()
        setResults(data.results || [])
      } catch (err) {
        console.error('KB widget: search error', err)
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/faq/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  const articles = query.trim().length >= 2 ? results : popular
  const showEmpty = !loading && !searching && articles.length === 0

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-100 truncate">Knowledge Base</h3>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="px-4 pb-2">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search articles…"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </form>

      {/* Article list */}
      <div className="flex-1 overflow-y-auto px-4 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : showEmpty ? (
          <p className="text-xs text-gray-500 text-center py-4">
            {query.trim() ? 'No articles found.' : 'No articles available.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {!query.trim() && (
              <li className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold pb-1">Popular Articles</li>
            )}
            {articles.map((article) => (
              <li key={article.id}>
                <button
                  onClick={() => navigate(`/faq/article/${article.id}`)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-800 transition-colors group"
                >
                  <p className="text-xs text-blue-400 group-hover:text-blue-300 truncate font-medium">
                    {article.title}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {article.category}{article.views > 0 ? ` · ${article.views} views` : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-700/50">
        <button
          onClick={() => navigate('/faq')}
          className="w-full text-center text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
        >
          Browse All Articles →
        </button>
      </div>
    </div>
  )
}
