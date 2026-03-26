import { createPortal } from 'react-dom'

/**
 * MinimizedTicketsBar
 * Fixed bottom bar showing minimized ticket chips.
 * Each chip shows ticket number + subject, and can be restored or closed.
 */
function MinimizedTicketsBar({ tickets = [], onRestore, onClose }) {
  if (tickets.length === 0) return null

  return createPortal(
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 shadow-2xl px-4 py-2">
      <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
        {tickets.map((t) => (
          <div
            key={t.ticketId}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500/50 rounded-lg px-3 py-2 min-w-0 max-w-xs shrink-0 group transition-colors cursor-pointer"
            onClick={() => onRestore(t.ticketId)}
            title="Click to restore"
          >
            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
            <div className="min-w-0 flex-1">
              <span className="text-white text-xs font-mono bg-gray-700 px-1.5 py-0.5 rounded mr-2">
                {t.ticketNumber || `#${t.ticketId}`}
              </span>
              <span className="text-gray-400 text-xs truncate">
                {t.subject || 'Untitled'}
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(t.ticketId) }}
              className="text-gray-500 hover:text-red-400 p-0.5 rounded hover:bg-gray-700 transition-colors flex-shrink-0 opacity-60 group-hover:opacity-100"
              title="Close ticket"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>,
    document.body
  )
}

export default MinimizedTicketsBar
