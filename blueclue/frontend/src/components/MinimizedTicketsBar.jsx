import { createPortal } from 'react-dom'

/**
 * MinimizedTicketsBar
 * Fixed bottom bar showing minimized ticket chips.
 * Each chip shows ticket number + subject, and can be restored or closed.
 */
function MinimizedTicketsBar({ tickets = [], onRestore, onClose, onClearAll }) {
  if (tickets.length === 0) return null

  // Scale down chips as count grows: full size at 1-5, shrink progressively after
  const count = tickets.length
  const scale = count <= 5 ? 1 : Math.max(0.45, 1 - (count - 5) * 0.06)
  const gap = count <= 5 ? 6 : Math.max(2, 6 - (count - 5))

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
      <div className="flex items-center flex-wrap" style={{ gap: `${gap}px` }}>
        {tickets.map((t) => (
          <div
            key={t.ticketId}
            className="flex items-center bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500/50 rounded group transition-all cursor-pointer"
            style={{ padding: `${2 * scale}px ${6 * scale}px`, gap: `${3 * scale}px`, fontSize: `${Math.max(8, 10 * scale)}px` }}
            onClick={() => onRestore(t.ticketId)}
            title={`${t.ticketNumber || `#${t.ticketId}`} – ${t.subject || 'Untitled'}`}
          >
            <span className="text-white font-mono leading-none whitespace-nowrap">
              {t.ticketNumber || `#${t.ticketId}`}
            </span>
            <span className="text-gray-400 leading-none whitespace-nowrap">
              {(t.subject || 'Untitled').slice(0, Math.max(3, Math.floor(10 * scale)))}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(t.ticketId) }}
              className="text-gray-500 hover:text-red-400 rounded hover:bg-gray-700 transition-colors flex-shrink-0 opacity-60 group-hover:opacity-100"
              style={{ padding: `${Math.max(2, 4 * scale)}px`, minWidth: '16px', minHeight: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Close ticket"
            >
              <svg style={{ width: `${Math.max(8, 10 * scale)}px`, height: `${Math.max(8, 10 * scale)}px` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
