import { useState } from 'react'
import { trackSuggestionEvent } from '../services/chatService'

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'

/**
 * ArticleSuggestionCard
 * ─────────────────────
 * Shown in the TicketForm when the user has typed 20+ words.
 * Displays up to 3 relevant KB articles that may prevent ticket creation.
 *
 * Props:
 *  - articles:     Array<{id, title, slug, category, excerpt}>
 *  - description:  string  – the current description (for tracking)
 *  - onDismiss:    () => void
 *  - onCancel:     () => void  – user cancelled ticket after seeing articles
 */
function ArticleSuggestionCard({ articles, description, onDismiss, onCancel }) {
  const [dismissed, setDismissed] = useState(false)
  const [articleClicked, setArticleClicked] = useState(null)

  if (dismissed || !articles?.length) return null

  const handleArticleClick = async (article) => {
    setArticleClicked(article.id)
    try {
      await trackSuggestionEvent('clicked', article.id, description)
    } catch { /* non-blocking */ }
    // Open article in a new tab
    window.open(`/faq/article/${article.id}`, '_blank', 'noopener,noreferrer')
  }

  const handleDismiss = async () => {
    setDismissed(true)
    try {
      await trackSuggestionEvent('dismissed', null, description)
    } catch { /* non-blocking */ }
    onDismiss?.()
  }

  const handleCancel = async () => {
    try {
      await trackSuggestionEvent('ticket_cancelled', null, description)
    } catch { /* non-blocking */ }
    onCancel?.()
  }

  return (
    <div className="mb-5 rounded-xl border border-blue-700/50 bg-blue-950/40 p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-lg"></span>
          <div>
            <p className="text-sm font-semibold text-blue-300">Before you submit, check if these articles help:</p>
            <p className="text-xs text-blue-400/70 mt-0.5">You might find a quick solution here</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-300 transition-colors ml-2 flex-shrink-0"
          title="Dismiss suggestions"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Article cards */}
      <div className="space-y-2">
        {articles.map((article) => (
          <button
            key={article.id}
            type="button"
            onClick={() => handleArticleClick(article)}
            className={`w-full text-left p-3 rounded-lg border transition-all group
              ${articleClicked === article.id
                ? 'border-blue-500 bg-blue-900/50'
                : 'border-gray-700 bg-gray-800/50 hover:border-blue-600 hover:bg-blue-900/30'
              }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors truncate">
                  {article.title}
                </p>
                {article.excerpt && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {article.excerpt}
                  </p>
                )}
                <span className="inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 capitalize">
                  {article.category || 'General'}
                </span>
              </div>
              <span className="flex-shrink-0 text-blue-400 text-xs font-medium whitespace-nowrap mt-0.5 group-hover:text-blue-300">
                View Article →
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-700/50">
        <button
          type="button"
          onClick={handleCancel}
          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
          title="These articles resolved my issue — I don't need to submit a ticket"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          My issue is resolved — cancel ticket
        </button>
        <span className="text-gray-600">·</span>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
        >
          These didn&apos;t help, proceed with ticket
        </button>
      </div>
    </div>
  )
}

export default ArticleSuggestionCard
