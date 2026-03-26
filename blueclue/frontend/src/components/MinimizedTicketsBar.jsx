import { createPortal } from 'react-dom'

/**
 * MinimizedTicketsBar
 * Fixed bottom bar showing minimized ticket chips.
 * Each chip shows ticket number + subject, and can be restored or closed.
 */
function MinimizedTicketsBar({ tickets = [], onRestore, onClose, onClearAll }) {
  if (tickets.length === 0) return null

  return createPortal(
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="flex justify-start px-4 pb-1">
        <button
          onClick={onClearAll}
          className="text-[10px] text-gray-400 hover:text-red-400 bg-gray-800/90 hover:bg-gray-700 border border-gray-700 rounded px-2 py-0.5 transition-colors"
        >
          Clear all
        </button>
      </div>
      <div className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 shadow-2xl px-4 py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
        {tickets.map((t) => (
          <div
            key={t.ticketId}
            className="flex items-center gap-1 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500/50 rounded px-2 py-1 shrink-0 group transition-colors cursor-pointer"
            onClick={() => onRestore(t.ticketId)}
            title={`${t.ticketNumber || `#${t.ticketId}`} – ${t.subject || 'Untitled'}`}
          >
            <span className="text-white text-[10px] font-mono leading-none">
              {t.ticketNumber || `#${t.ticketId}`}
            </span>
            <span className="text-gray-400 text-[10px] leading-none">
              {(t.subject || 'Untitled').slice(0, 10)}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(t.ticketId) }}
              className="text-gray-500 hover:text-red-400 rounded hover:bg-gray-700 transition-colors flex-shrink-0 opacity-60 group-hover:opacity-100 ml-0.5"
              title="Close ticket"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      </div>
    </div>,
    document.body
  )
}

export default MinimizedTicketsBar
