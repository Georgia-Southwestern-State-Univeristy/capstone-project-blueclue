import { useState, useRef, useEffect } from 'react'
import { formatDate as _fmtDate } from '../utils/dateFormatter'

/**
 * SaveLayoutButton – inline button with popover input for naming and saving layouts.
 */
function SaveLayoutButton({ onSave }) {
  const [showInput, setShowInput] = useState(false)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (showInput && inputRef.current) inputRef.current.focus()
  }, [showInput])

  const handleSave = () => {
    if (!name.trim()) return
    const success = onSave?.(name.trim())
    if (success !== false) {
      setSaved(true)
      setTimeout(() => { setSaved(false); setShowInput(false); setName('') }, 1200)
    }
  }

  if (saved) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                        bg-green-600/20 border border-green-500/40 text-green-400">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Saved!
      </span>
    )
  }

  if (showInput) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setShowInput(false); setName('') } }}
          placeholder="Layout name..."
          maxLength={30}
          className="px-2.5 py-1 text-xs rounded-lg bg-gray-800 border border-gray-600 text-white
                     placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 w-36"
        />
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-green-600 hover:bg-green-500
                     text-white border border-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          onClick={() => { setShowInput(false); setName('') }}
          className="p-1.5 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white
                 border border-gray-600 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
      Save Layout
    </button>
  )
}

/**
 * WidgetGallery – sidebar displaying available widgets with visual previews.
 * Widgets can be dragged onto the dashboard grid or clicked to add.
 */

// Mini-preview layout patterns for different widget types
const PREVIEW_PATTERNS = {
  timeline:       'stacked-bar',      // Stacked vertical bar chart (hourly activity buckets)
  ticketControl:  'card-grid',        // Tabbed card grid with ticket cards
  assignedChart:  'chart-donut',      // Donut chart (assigned vs unassigned)
  categoriesChart:'chart-pie',        // Pie chart with color-coded category slices
  overdue:        'list-alert',       // Alert card list with severity colors
  escalations:    'list-actions',     // Priority card list with action buttons
  todaysActions:  'list-check',       // Categorized action item list
  topRequesters:  'ranked-bars',      // Ranked horizontal bar list with user avatars
  techPerformance:'data-table',       // Sortable multi-column data table
  deletedTickets: 'list-restore',     // Searchable list with restore buttons
  pendingRequests:'list-pending',     // Action cards with approve/deny buttons
  responseTime:   'stat-cards',       // Stat cards with KPI metrics
  createTicket:   'form-create',      // Ticket creation form with input fields
  ticketTrend:    'chart-trend',      // Dual-line trend chart (opened vs resolved)
  ticketStatus:   'chart-hbar',       // Horizontal bar chart with status breakdown
  techResponseTime:'clock-bars',       // Clock icon + horizontal bars (response times)
  knowledgeBase:'kb-search',            // Book icon + search bar + article list
  chatBot:'chat-bubbles',                // Chat bubble icon + message bubbles + input
  recentActivity:'activity-feed',          // Clock icon + activity log rows
  ticketUpdates:'activity-list',            // Filter tabs + update entries with change-type icons
}

/** Tiny SVG preview matching the widget type */
function WidgetPreview({ pattern }) {
  const p = pattern || 'generic'

  return (
    <div className="relative w-full h-20 bg-gray-800/60 rounded-md border border-gray-700/50 overflow-hidden">
      {/* Background pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 120 60" fill="none">
        {p === 'stacked-bar' && (
          /* Stacked vertical bar chart — hourly buckets with colored segments */
          <>
            {/* Time axis labels */}
            <rect x="6" y="53" width="10" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="30" y="53" width="10" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="54" y="53" width="10" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="78" y="53" width="10" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="102" y="53" width="10" height="3" rx="1" fill="#374151" opacity="0.4" />
            {/* Stacked bars - bar 1 */}
            <rect x="8" y="30" width="8" height="20" rx="1" fill="#3b82f6" opacity="0.7" />
            <rect x="8" y="22" width="8" height="8" rx="0" fill="#22c55e" opacity="0.6" />
            <rect x="8" y="18" width="8" height="4" rx="0" fill="#f59e0b" opacity="0.5" />
            {/* bar 2 */}
            <rect x="20" y="35" width="8" height="15" rx="1" fill="#3b82f6" opacity="0.7" />
            <rect x="20" y="28" width="8" height="7" rx="0" fill="#22c55e" opacity="0.6" />
            {/* bar 3 */}
            <rect x="32" y="20" width="8" height="30" rx="1" fill="#3b82f6" opacity="0.7" />
            <rect x="32" y="12" width="8" height="8" rx="0" fill="#22c55e" opacity="0.6" />
            <rect x="32" y="8" width="8" height="4" rx="0" fill="#f59e0b" opacity="0.5" />
            <rect x="32" y="5" width="8" height="3" rx="0" fill="#ef4444" opacity="0.4" />
            {/* bar 4 */}
            <rect x="44" y="38" width="8" height="12" rx="1" fill="#3b82f6" opacity="0.7" />
            <rect x="44" y="32" width="8" height="6" rx="0" fill="#22c55e" opacity="0.6" />
            {/* bar 5 */}
            <rect x="56" y="25" width="8" height="25" rx="1" fill="#3b82f6" opacity="0.7" />
            <rect x="56" y="18" width="8" height="7" rx="0" fill="#22c55e" opacity="0.6" />
            <rect x="56" y="14" width="8" height="4" rx="0" fill="#f59e0b" opacity="0.5" />
            {/* bar 6 */}
            <rect x="68" y="40" width="8" height="10" rx="1" fill="#3b82f6" opacity="0.7" />
            <rect x="68" y="36" width="8" height="4" rx="0" fill="#22c55e" opacity="0.6" />
            {/* bar 7 */}
            <rect x="80" y="28" width="8" height="22" rx="1" fill="#3b82f6" opacity="0.7" />
            <rect x="80" y="20" width="8" height="8" rx="0" fill="#22c55e" opacity="0.6" />
            <rect x="80" y="16" width="8" height="4" rx="0" fill="#f59e0b" opacity="0.5" />
            {/* bar 8 */}
            <rect x="92" y="33" width="8" height="17" rx="1" fill="#3b82f6" opacity="0.7" />
            <rect x="92" y="26" width="8" height="7" rx="0" fill="#22c55e" opacity="0.6" />
            {/* bar 9 */}
            <rect x="104" y="42" width="8" height="8" rx="1" fill="#3b82f6" opacity="0.7" />
            <rect x="104" y="38" width="8" height="4" rx="0" fill="#22c55e" opacity="0.6" />
            {/* Axis line */}
            <line x1="6" y1="51" x2="114" y2="51" stroke="#374151" strokeWidth="0.5" />
          </>
        )}
        {p === 'card-grid' && (
          /* Tabbed card grid — tab bar + 3-column ticket cards */
          <>
            {/* Tab bar */}
            <rect x="8" y="4" width="22" height="6" rx="2" fill="#3b82f6" opacity="0.5" />
            <rect x="34" y="4" width="22" height="6" rx="2" fill="#374151" opacity="0.4" />
            <line x1="8" y1="12" x2="112" y2="12" stroke="#374151" strokeWidth="0.5" />
            {/* Row 1 of cards */}
            <rect x="8" y="15" width="30" height="16" rx="2" stroke="#374151" strokeWidth="0.7" fill="#374151" fillOpacity="0.15" />
            <circle cx="15" cy="20" r="2" fill="#22c55e" opacity="0.5" />
            <rect x="20" y="18" width="14" height="3" rx="1" fill="#374151" opacity="0.5" />
            <rect x="10" y="25" width="25" height="2" rx="1" fill="#374151" opacity="0.3" />
            <rect x="44" y="15" width="30" height="16" rx="2" stroke="#374151" strokeWidth="0.7" fill="#374151" fillOpacity="0.15" />
            <circle cx="51" cy="20" r="2" fill="#f97316" opacity="0.5" />
            <rect x="56" y="18" width="14" height="3" rx="1" fill="#374151" opacity="0.5" />
            <rect x="46" y="25" width="25" height="2" rx="1" fill="#374151" opacity="0.3" />
            <rect x="80" y="15" width="30" height="16" rx="2" stroke="#374151" strokeWidth="0.7" fill="#374151" fillOpacity="0.15" />
            <circle cx="87" cy="20" r="2" fill="#3b82f6" opacity="0.5" />
            <rect x="92" y="18" width="14" height="3" rx="1" fill="#374151" opacity="0.5" />
            <rect x="82" y="25" width="25" height="2" rx="1" fill="#374151" opacity="0.3" />
            {/* Row 2 of cards */}
            <rect x="8" y="35" width="30" height="16" rx="2" stroke="#374151" strokeWidth="0.7" fill="#374151" fillOpacity="0.1" />
            <circle cx="15" cy="40" r="2" fill="#ef4444" opacity="0.5" />
            <rect x="20" y="38" width="14" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="10" y="45" width="25" height="2" rx="1" fill="#374151" opacity="0.2" />
            <rect x="44" y="35" width="30" height="16" rx="2" stroke="#374151" strokeWidth="0.7" fill="#374151" fillOpacity="0.1" />
            <circle cx="51" cy="40" r="2" fill="#22c55e" opacity="0.4" />
            <rect x="56" y="38" width="14" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="46" y="45" width="25" height="2" rx="1" fill="#374151" opacity="0.2" />
            <rect x="80" y="35" width="30" height="16" rx="2" stroke="#374151" strokeWidth="0.7" fill="#374151" fillOpacity="0.1" />
            <circle cx="87" cy="40" r="2" fill="#f59e0b" opacity="0.4" />
            <rect x="92" y="38" width="14" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="82" y="45" width="25" height="2" rx="1" fill="#374151" opacity="0.2" />
          </>
        )}
        {p === 'chart-donut' && (
          <>
            <circle cx="60" cy="32" r="22" stroke="#374151" strokeWidth="8" fill="none" />
            <circle cx="60" cy="32" r="22" stroke="#22c55e" strokeWidth="8" fill="none"
              strokeDasharray="88 138" strokeDashoffset="0" />
            <circle cx="60" cy="32" r="22" stroke="#f97316" strokeWidth="8" fill="none"
              strokeDasharray="50 176" strokeDashoffset="-88" />
          </>
        )}
        {p === 'chart-pie' && (
          /* Pie chart with multiple category color slices */
          <>
            <circle cx="50" cy="30" r="24" fill="#374151" opacity="0.2" />
            {/* Pie slices using wedge paths */}
            <path d="M50,30 L50,6 A24,24 0 0,1 70,12 Z" fill="#3b82f6" opacity="0.7" />
            <path d="M50,30 L70,12 A24,24 0 0,1 74,30 Z" fill="#22c55e" opacity="0.7" />
            <path d="M50,30 L74,30 A24,24 0 0,1 65,50 Z" fill="#f59e0b" opacity="0.7" />
            <path d="M50,30 L65,50 A24,24 0 0,1 38,52 Z" fill="#ef4444" opacity="0.6" />
            <path d="M50,30 L38,52 A24,24 0 0,1 27,18 Z" fill="#8b5cf6" opacity="0.6" />
            <path d="M50,30 L27,18 A24,24 0 0,1 50,6 Z" fill="#06b6d4" opacity="0.6" />
            {/* Legend dots */}
            <circle cx="88" cy="12" r="2" fill="#3b82f6" opacity="0.7" />
            <rect x="93" y="10" width="18" height="3" rx="1" fill="#374151" opacity="0.5" />
            <circle cx="88" cy="22" r="2" fill="#22c55e" opacity="0.7" />
            <rect x="93" y="20" width="15" height="3" rx="1" fill="#374151" opacity="0.5" />
            <circle cx="88" cy="32" r="2" fill="#f59e0b" opacity="0.7" />
            <rect x="93" y="30" width="20" height="3" rx="1" fill="#374151" opacity="0.5" />
            <circle cx="88" cy="42" r="2" fill="#ef4444" opacity="0.6" />
            <rect x="93" y="40" width="13" height="3" rx="1" fill="#374151" opacity="0.5" />
            <circle cx="88" cy="52" r="2" fill="#8b5cf6" opacity="0.6" />
            <rect x="93" y="50" width="17" height="3" rx="1" fill="#374151" opacity="0.5" />
          </>
        )}
        {p === 'list-alert' && (
          /* Alert card list with severity color indicators */
          <>
            <circle cx="16" cy="14" r="4" fill="#ef4444" opacity="0.6" />
            <rect x="26" y="11" width="50" height="5" rx="1" fill="#374151" opacity="0.6" />
            <rect x="86" y="11" width="22" height="5" rx="1" fill="#ef4444" opacity="0.3" />
            <circle cx="16" cy="28" r="4" fill="#f97316" opacity="0.6" />
            <rect x="26" y="25" width="45" height="5" rx="1" fill="#374151" opacity="0.5" />
            <rect x="86" y="25" width="22" height="5" rx="1" fill="#f97316" opacity="0.3" />
            <circle cx="16" cy="42" r="4" fill="#f59e0b" opacity="0.5" />
            <rect x="26" y="39" width="55" height="5" rx="1" fill="#374151" opacity="0.4" />
            <rect x="86" y="39" width="22" height="5" rx="1" fill="#f59e0b" opacity="0.3" />
          </>
        )}
        {p === 'list-actions' && (
          /* Priority card list with action buttons (escalations) */
          <>
            {/* Card 1 - critical */}
            <rect x="8" y="6" width="104" height="14" rx="2" stroke="#ef4444" strokeWidth="0.7" fill="#ef4444" fillOpacity="0.05" />
            <rect x="11" y="9" width="3" height="8" rx="1" fill="#ef4444" opacity="0.6" />
            <rect x="18" y="9" width="35" height="3" rx="1" fill="#374151" opacity="0.6" />
            <rect x="18" y="14" width="25" height="2.5" rx="1" fill="#374151" opacity="0.3" />
            <rect x="76" y="9" width="14" height="7" rx="2" fill="#3b82f6" opacity="0.3" />
            <rect x="93" y="9" width="14" height="7" rx="2" fill="#22c55e" opacity="0.3" />
            {/* Card 2 - high */}
            <rect x="8" y="24" width="104" height="14" rx="2" stroke="#f97316" strokeWidth="0.7" fill="#f97316" fillOpacity="0.04" />
            <rect x="11" y="27" width="3" height="8" rx="1" fill="#f97316" opacity="0.5" />
            <rect x="18" y="27" width="40" height="3" rx="1" fill="#374151" opacity="0.5" />
            <rect x="18" y="32" width="22" height="2.5" rx="1" fill="#374151" opacity="0.25" />
            <rect x="76" y="27" width="14" height="7" rx="2" fill="#3b82f6" opacity="0.25" />
            <rect x="93" y="27" width="14" height="7" rx="2" fill="#22c55e" opacity="0.25" />
            {/* Card 3 - high */}
            <rect x="8" y="42" width="104" height="14" rx="2" stroke="#f97316" strokeWidth="0.5" fill="none" opacity="0.5" />
            <rect x="11" y="45" width="3" height="8" rx="1" fill="#f97316" opacity="0.4" />
            <rect x="18" y="45" width="32" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="18" y="50" width="28" height="2.5" rx="1" fill="#374151" opacity="0.2" />
            <rect x="76" y="45" width="14" height="7" rx="2" fill="#3b82f6" opacity="0.2" />
            <rect x="93" y="45" width="14" height="7" rx="2" fill="#22c55e" opacity="0.2" />
          </>
        )}
        {p === 'list-check' && (
          /* Categorized action item list */
          <>
            <rect x="10" y="10" width="8" height="8" rx="2" stroke="#22c55e" strokeWidth="1.5" fill="none" opacity="0.6" />
            <rect x="24" y="11" width="55" height="5" rx="1" fill="#374151" opacity="0.6" />
            <rect x="10" y="26" width="8" height="8" rx="2" stroke="#3b82f6" strokeWidth="1.5" fill="none" opacity="0.6" />
            <rect x="24" y="27" width="48" height="5" rx="1" fill="#374151" opacity="0.5" />
            <rect x="10" y="42" width="8" height="8" rx="2" stroke="#f59e0b" strokeWidth="1.5" fill="none" opacity="0.5" />
            <rect x="24" y="43" width="60" height="5" rx="1" fill="#374151" opacity="0.4" />
          </>
        )}
        {p === 'ranked-bars' && (
          /* Ranked horizontal bar chart with user avatars and gradient fill */
          <>
            {/* Rank 1 */}
            <circle cx="14" cy="12" r="4" fill="#6366f1" opacity="0.5" />
            <rect x="8" y="8" width="12" height="8" rx="4" fill="none" stroke="#f59e0b" strokeWidth="0.7" opacity="0.6" />
            <rect x="24" y="9" width="82" height="6" rx="2" fill="#3b82f6" opacity="0.35" />
            <rect x="24" y="9" width="82" height="6" rx="2" fill="url(#grad1)" opacity="0.5" />
            <rect x="108" y="9" width="8" height="6" rx="1" fill="#374151" opacity="0.4" />
            {/* Rank 2 */}
            <circle cx="14" cy="26" r="4" fill="#6366f1" opacity="0.4" />
            <rect x="24" y="23" width="64" height="6" rx="2" fill="#3b82f6" opacity="0.3" />
            <rect x="108" y="23" width="8" height="6" rx="1" fill="#374151" opacity="0.35" />
            {/* Rank 3 */}
            <circle cx="14" cy="40" r="4" fill="#6366f1" opacity="0.3" />
            <rect x="24" y="37" width="48" height="6" rx="2" fill="#3b82f6" opacity="0.25" />
            <rect x="108" y="37" width="8" height="6" rx="1" fill="#374151" opacity="0.3" />
            {/* Rank 4 */}
            <circle cx="14" cy="54" r="4" fill="#6366f1" opacity="0.2" />
            <rect x="24" y="51" width="35" height="6" rx="2" fill="#3b82f6" opacity="0.2" />
            <rect x="108" y="51" width="8" height="6" rx="1" fill="#374151" opacity="0.25" />
          </>
        )}
        {p === 'data-table' && (
          /* Sortable multi-column data table */
          <>
            {/* Header row with sort indicators */}
            <rect x="6" y="5" width="108" height="8" rx="1" fill="#3b82f6" opacity="0.15" />
            <rect x="8" y="7" width="20" height="3" rx="1" fill="#3b82f6" opacity="0.4" />
            <rect x="32" y="7" width="14" height="3" rx="1" fill="#3b82f6" opacity="0.35" />
            <rect x="50" y="7" width="14" height="3" rx="1" fill="#3b82f6" opacity="0.35" />
            <rect x="68" y="7" width="12" height="3" rx="1" fill="#3b82f6" opacity="0.35" />
            <rect x="84" y="7" width="12" height="3" rx="1" fill="#3b82f6" opacity="0.35" />
            <rect x="100" y="7" width="10" height="3" rx="1" fill="#3b82f6" opacity="0.35" />
            {/* Column lines */}
            <line x1="30" y1="5" x2="30" y2="56" stroke="#374151" strokeWidth="0.3" />
            <line x1="48" y1="5" x2="48" y2="56" stroke="#374151" strokeWidth="0.3" />
            <line x1="66" y1="5" x2="66" y2="56" stroke="#374151" strokeWidth="0.3" />
            <line x1="82" y1="5" x2="82" y2="56" stroke="#374151" strokeWidth="0.3" />
            <line x1="98" y1="5" x2="98" y2="56" stroke="#374151" strokeWidth="0.3" />
            {/* Data rows */}
            <rect x="8" y="16" width="18" height="3" rx="1" fill="#374151" opacity="0.5" />
            <rect x="32" y="16" width="12" height="3" rx="1" fill="#22c55e" opacity="0.3" />
            <rect x="50" y="16" width="10" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="68" y="16" width="10" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="84" y="16" width="10" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="100" y="16" width="8" height="3" rx="1" fill="#f59e0b" opacity="0.3" />
            <line x1="6" y1="22" x2="114" y2="22" stroke="#374151" strokeWidth="0.3" />
            <rect x="8" y="25" width="20" height="3" rx="1" fill="#374151" opacity="0.45" />
            <rect x="32" y="25" width="10" height="3" rx="1" fill="#22c55e" opacity="0.25" />
            <rect x="50" y="25" width="12" height="3" rx="1" fill="#374151" opacity="0.35" />
            <rect x="68" y="25" width="8" height="3" rx="1" fill="#374151" opacity="0.35" />
            <rect x="84" y="25" width="10" height="3" rx="1" fill="#374151" opacity="0.35" />
            <rect x="100" y="25" width="8" height="3" rx="1" fill="#22c55e" opacity="0.3" />
            <line x1="6" y1="31" x2="114" y2="31" stroke="#374151" strokeWidth="0.3" />
            <rect x="8" y="34" width="16" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="32" y="34" width="14" height="3" rx="1" fill="#22c55e" opacity="0.2" />
            <rect x="50" y="34" width="10" height="3" rx="1" fill="#374151" opacity="0.3" />
            <rect x="68" y="34" width="10" height="3" rx="1" fill="#374151" opacity="0.3" />
            <rect x="84" y="34" width="8" height="3" rx="1" fill="#374151" opacity="0.3" />
            <rect x="100" y="34" width="8" height="3" rx="1" fill="#ef4444" opacity="0.25" />
            <line x1="6" y1="40" x2="114" y2="40" stroke="#374151" strokeWidth="0.3" />
            <rect x="8" y="43" width="18" height="3" rx="1" fill="#374151" opacity="0.35" />
            <rect x="32" y="43" width="8" height="3" rx="1" fill="#22c55e" opacity="0.2" />
            <rect x="50" y="43" width="14" height="3" rx="1" fill="#374151" opacity="0.25" />
            <rect x="68" y="43" width="10" height="3" rx="1" fill="#374151" opacity="0.25" />
            <rect x="84" y="43" width="10" height="3" rx="1" fill="#374151" opacity="0.25" />
            <rect x="100" y="43" width="8" height="3" rx="1" fill="#22c55e" opacity="0.2" />
            <line x1="6" y1="49" x2="114" y2="49" stroke="#374151" strokeWidth="0.3" />
          </>
        )}
        {p === 'list-restore' && (
          /* Searchable card list with restore buttons (deleted tickets) */
          <>
            {/* Search bar */}
            <rect x="8" y="5" width="70" height="8" rx="3" stroke="#374151" strokeWidth="0.7" fill="none" />
            <circle cx="14" cy="9" r="2.5" stroke="#374151" strokeWidth="0.7" fill="none" />
            <rect x="20" y="7.5" width="25" height="2.5" rx="1" fill="#374151" opacity="0.3" />
            {/* Card 1 */}
            <rect x="8" y="17" width="104" height="12" rx="2" stroke="#374151" strokeWidth="0.5" fill="#374151" fillOpacity="0.1" />
            <line x1="11" y1="17" x2="11" y2="29" stroke="#ef4444" strokeWidth="1.5" opacity="0.4" />
            <rect x="16" y="19" width="35" height="3" rx="1" fill="#374151" opacity="0.5" />
            <rect x="16" y="24" width="25" height="2.5" rx="1" fill="#374151" opacity="0.25" />
            <rect x="88" y="19" width="20" height="7" rx="2" fill="#3b82f6" opacity="0.25" />
            <text x="98" y="24" textAnchor="middle" fontSize="4" fill="#3b82f6" opacity="0.6">↺</text>
            {/* Card 2 */}
            <rect x="8" y="33" width="104" height="12" rx="2" stroke="#374151" strokeWidth="0.5" fill="#374151" fillOpacity="0.08" />
            <line x1="11" y1="33" x2="11" y2="45" stroke="#ef4444" strokeWidth="1.5" opacity="0.3" />
            <rect x="16" y="35" width="30" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="16" y="40" width="28" height="2.5" rx="1" fill="#374151" opacity="0.2" />
            <rect x="88" y="35" width="20" height="7" rx="2" fill="#3b82f6" opacity="0.2" />
            {/* Card 3 */}
            <rect x="8" y="49" width="104" height="10" rx="2" stroke="#374151" strokeWidth="0.4" fill="none" opacity="0.5" />
            <line x1="11" y1="49" x2="11" y2="59" stroke="#ef4444" strokeWidth="1.5" opacity="0.2" />
            <rect x="16" y="51" width="32" height="3" rx="1" fill="#374151" opacity="0.3" />
            <rect x="88" y="51" width="20" height="6" rx="2" fill="#3b82f6" opacity="0.15" />
          </>
        )}
        {p === 'list-pending' && (
          /* Pending approval cards with approve/deny action buttons */
          <>
            <rect x="8" y="6" width="104" height="16" rx="2" stroke="#f59e0b" strokeWidth="0.7" fill="#f59e0b" fillOpacity="0.04" />
            <circle cx="16" cy="12" r="3.5" fill="#6366f1" opacity="0.3" />
            <rect x="22" y="9" width="30" height="3" rx="1" fill="#374151" opacity="0.5" />
            <rect x="22" y="14" width="20" height="2.5" rx="1" fill="#374151" opacity="0.3" />
            {/* Timer */}
            <circle cx="80" cy="12" r="3" stroke="#f59e0b" strokeWidth="0.5" fill="none" opacity="0.4" />
            {/* Approve/Deny */}
            <rect x="88" y="8" width="10" height="8" rx="2" fill="#22c55e" opacity="0.3" />
            <rect x="100" y="8" width="10" height="8" rx="2" fill="#ef4444" opacity="0.3" />
            {/* Card 2 */}
            <rect x="8" y="26" width="104" height="16" rx="2" stroke="#374151" strokeWidth="0.5" fill="none" />
            <circle cx="16" cy="32" r="3.5" fill="#6366f1" opacity="0.25" />
            <rect x="22" y="29" width="28" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="22" y="34" width="18" height="2.5" rx="1" fill="#374151" opacity="0.2" />
            <circle cx="80" cy="32" r="3" stroke="#f59e0b" strokeWidth="0.5" fill="none" opacity="0.3" />
            <rect x="88" y="28" width="10" height="8" rx="2" fill="#22c55e" opacity="0.2" />
            <rect x="100" y="28" width="10" height="8" rx="2" fill="#ef4444" opacity="0.2" />
            {/* Card 3 faded */}
            <rect x="8" y="46" width="104" height="12" rx="2" stroke="#374151" strokeWidth="0.4" fill="none" opacity="0.5" />
            <circle cx="16" cy="51" r="3.5" fill="#6366f1" opacity="0.15" />
            <rect x="22" y="49" width="25" height="3" rx="1" fill="#374151" opacity="0.3" />
            <rect x="88" y="48" width="10" height="7" rx="2" fill="#22c55e" opacity="0.15" />
            <rect x="100" y="48" width="10" height="7" rx="2" fill="#ef4444" opacity="0.15" />
          </>
        )}
        {p === 'stat-cards' && (
          /* Stat cards with KPI metrics (response times) */
          <>
            {/* Stat card 1 */}
            <rect x="6" y="5" width="34" height="22" rx="3" stroke="#374151" strokeWidth="0.6" fill="#374151" fillOpacity="0.1" />
            <rect x="10" y="8" width="10" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="10" y="14" width="18" height="6" rx="1" fill="#22c55e" opacity="0.35" />
            <rect x="10" y="22" width="26" height="2" rx="1" fill="#374151" opacity="0.2" />
            {/* Stat card 2 */}
            <rect x="44" y="5" width="34" height="22" rx="3" stroke="#374151" strokeWidth="0.6" fill="#374151" fillOpacity="0.1" />
            <rect x="48" y="8" width="12" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="48" y="14" width="16" height="6" rx="1" fill="#3b82f6" opacity="0.35" />
            <rect x="48" y="22" width="26" height="2" rx="1" fill="#374151" opacity="0.2" />
            {/* Stat card 3 */}
            <rect x="82" y="5" width="34" height="22" rx="3" stroke="#374151" strokeWidth="0.6" fill="#374151" fillOpacity="0.1" />
            <rect x="86" y="8" width="14" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="86" y="14" width="14" height="6" rx="1" fill="#f59e0b" opacity="0.35" />
            <rect x="86" y="22" width="26" height="2" rx="1" fill="#374151" opacity="0.2" />
            {/* Bottom summary bar */}
            <rect x="6" y="32" width="110" height="10" rx="2" fill="#374151" fillOpacity="0.1" stroke="#374151" strokeWidth="0.4" />
            <rect x="10" y="34" width="22" height="3" rx="1" fill="#374151" opacity="0.35" />
            <rect x="10" y="38" width="14" height="2" rx="1" fill="#22c55e" opacity="0.25" />
            <rect x="42" y="34" width="22" height="3" rx="1" fill="#374151" opacity="0.35" />
            <rect x="42" y="38" width="16" height="2" rx="1" fill="#3b82f6" opacity="0.25" />
            <rect x="78" y="34" width="22" height="3" rx="1" fill="#374151" opacity="0.35" />
            <rect x="78" y="38" width="12" height="2" rx="1" fill="#f59e0b" opacity="0.25" />
            {/* Per-tech cards below */}
            <rect x="6" y="46" width="52" height="10" rx="2" stroke="#374151" strokeWidth="0.4" fill="none" />
            <circle cx="14" cy="51" r="3" fill="#6366f1" opacity="0.25" />
            <rect x="20" y="49" width="16" height="2.5" rx="1" fill="#374151" opacity="0.3" />
            <rect x="40" y="48" width="14" height="6" rx="1" fill="#22c55e" opacity="0.15" />
            <rect x="62" y="46" width="52" height="10" rx="2" stroke="#374151" strokeWidth="0.4" fill="none" />
            <circle cx="70" cy="51" r="3" fill="#6366f1" opacity="0.2" />
            <rect x="76" y="49" width="18" height="2.5" rx="1" fill="#374151" opacity="0.25" />
            <rect x="96" y="48" width="14" height="6" rx="1" fill="#f59e0b" opacity="0.15" />
          </>
        )}
        {p === 'form-create' && (
          /* Ticket creation form — labels, input fields, and submit button */
          <>
            {/* Title / Subject field */}
            <rect x="8" y="5" width="18" height="3" rx="1" fill="#374151" opacity="0.5" />
            <rect x="8" y="10" width="104" height="7" rx="2" stroke="#374151" strokeWidth="0.6" fill="#374151" fillOpacity="0.1" />
            <rect x="11" y="12" width="40" height="3" rx="1" fill="#374151" opacity="0.25" />
            {/* Description textarea */}
            <rect x="8" y="21" width="24" height="3" rx="1" fill="#374151" opacity="0.5" />
            <rect x="8" y="26" width="104" height="14" rx="2" stroke="#374151" strokeWidth="0.6" fill="#374151" fillOpacity="0.1" />
            <rect x="11" y="29" width="60" height="2.5" rx="1" fill="#374151" opacity="0.2" />
            <rect x="11" y="33" width="45" height="2.5" rx="1" fill="#374151" opacity="0.15" />
            {/* Priority & Category dropdowns */}
            <rect x="8" y="44" width="48" height="7" rx="2" stroke="#374151" strokeWidth="0.6" fill="#374151" fillOpacity="0.1" />
            <rect x="12" y="46" width="20" height="3" rx="1" fill="#f59e0b" opacity="0.35" />
            <rect x="64" y="44" width="48" height="7" rx="2" stroke="#374151" strokeWidth="0.6" fill="#374151" fillOpacity="0.1" />
            <rect x="68" y="46" width="22" height="3" rx="1" fill="#3b82f6" opacity="0.35" />
            {/* Submit button */}
            <rect x="78" y="54" width="34" height="6" rx="2" fill="#22c55e" opacity="0.5" />
            <rect x="86" y="55.5" width="18" height="3" rx="1" fill="#ffffff" opacity="0.3" />
          </>
        )}
        {p === 'chart-trend' && (
          /* Dual-line chart — opened (orange) vs resolved (green) trend lines */
          <>
            {/* Grid lines */}
            <line x1="8" y1="12" x2="112" y2="12" stroke="#374151" strokeWidth="0.3" />
            <line x1="8" y1="24" x2="112" y2="24" stroke="#374151" strokeWidth="0.3" />
            <line x1="8" y1="36" x2="112" y2="36" stroke="#374151" strokeWidth="0.3" />
            <line x1="8" y1="48" x2="112" y2="48" stroke="#374151" strokeWidth="0.3" />
            {/* Opened area fill */}
            <path d="M8,38 L22,30 L36,34 L50,22 L64,26 L78,18 L92,24 L106,14 L112,16 L112,48 L8,48 Z"
              fill="#f97316" fillOpacity="0.12" />
            {/* Resolved area fill */}
            <path d="M8,44 L22,40 L36,38 L50,32 L64,28 L78,24 L92,20 L106,18 L112,16 L112,48 L8,48 Z"
              fill="#22c55e" fillOpacity="0.12" />
            {/* Opened line */}
            <polyline points="8,38 22,30 36,34 50,22 64,26 78,18 92,24 106,14"
              fill="none" stroke="#f97316" strokeWidth="1.2" strokeLinejoin="round" />
            {/* Resolved line */}
            <polyline points="8,44 22,40 36,38 50,32 64,28 78,24 92,20 106,18"
              fill="none" stroke="#22c55e" strokeWidth="1.2" strokeLinejoin="round" />
            {/* Dots on opened line */}
            <circle cx="8" cy="38" r="1.5" fill="#f97316" />
            <circle cx="36" cy="34" r="1.5" fill="#f97316" />
            <circle cx="64" cy="26" r="1.5" fill="#f97316" />
            <circle cx="92" cy="24" r="1.5" fill="#f97316" />
            {/* Dots on resolved line */}
            <circle cx="8" cy="44" r="1.5" fill="#22c55e" />
            <circle cx="36" cy="38" r="1.5" fill="#22c55e" />
            <circle cx="64" cy="28" r="1.5" fill="#22c55e" />
            <circle cx="92" cy="20" r="1.5" fill="#22c55e" />
            {/* Legend */}
            <rect x="8" y="3" width="6" height="3" rx="1" fill="#f97316" opacity="0.7" />
            <rect x="16" y="3.5" width="14" height="2" rx="0.5" fill="#374151" opacity="0.4" />
            <rect x="36" y="3" width="6" height="3" rx="1" fill="#22c55e" opacity="0.7" />
            <rect x="44" y="3.5" width="16" height="2" rx="0.5" fill="#374151" opacity="0.4" />
            {/* X-axis labels */}
            <rect x="8" y="52" width="10" height="2.5" rx="0.5" fill="#374151" opacity="0.3" />
            <rect x="50" y="52" width="10" height="2.5" rx="0.5" fill="#374151" opacity="0.3" />
            <rect x="98" y="52" width="10" height="2.5" rx="0.5" fill="#374151" opacity="0.3" />
          </>
        )}

        {p === 'chart-hbar' && (
          /* Horizontal bar chart — status breakdown */
          <>
            {/* Labels */}
            <rect x="4" y="8"  width="22" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="4" y="18" width="18" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="4" y="28" width="26" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="4" y="38" width="20" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="4" y="48" width="16" height="3" rx="1" fill="#374151" opacity="0.4" />
            {/* Background tracks */}
            <rect x="34" y="7"  width="80" height="5" rx="2" fill="#1f2937" />
            <rect x="34" y="17" width="80" height="5" rx="2" fill="#1f2937" />
            <rect x="34" y="27" width="80" height="5" rx="2" fill="#1f2937" />
            <rect x="34" y="37" width="80" height="5" rx="2" fill="#1f2937" />
            <rect x="34" y="47" width="80" height="5" rx="2" fill="#1f2937" />
            {/* Filled bars */}
            <rect x="34" y="7"  width="60" height="5" rx="2" fill="#3b82f6" opacity="0.7" />
            <rect x="34" y="17" width="45" height="5" rx="2" fill="#f97316" opacity="0.7" />
            <rect x="34" y="27" width="30" height="5" rx="2" fill="#22c55e" opacity="0.7" />
            <rect x="34" y="37" width="18" height="5" rx="2" fill="#6b7280" opacity="0.7" />
            <rect x="34" y="47" width="10" height="5" rx="2" fill="#ef4444" opacity="0.7" />
          </>
        )}

        {p === 'clock-bars' && (
          /* Clock icon + horizontal bars — per-tech response times */
          <>
            {/* Small clock icon */}
            <circle cx="12" cy="12" r="7" stroke="#60a5fa" strokeWidth="1" fill="none" opacity="0.6" />
            <line x1="12" y1="12" x2="12" y2="8" stroke="#60a5fa" strokeWidth="1" opacity="0.7" />
            <line x1="12" y1="12" x2="15" y2="12" stroke="#60a5fa" strokeWidth="1" opacity="0.7" />
            {/* Search bar placeholder */}
            <rect x="24" y="6" width="40" height="5" rx="2" fill="#374151" opacity="0.3" />
            <rect x="25" y="7.5" width="4" height="2" rx="0.5" fill="#6b7280" opacity="0.4" />
            {/* Name labels */}
            <rect x="4" y="24" width="20" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="4" y="33" width="16" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="4" y="42" width="22" height="3" rx="1" fill="#374151" opacity="0.4" />
            <rect x="4" y="51" width="18" height="3" rx="1" fill="#374151" opacity="0.4" />
            {/* Background tracks */}
            <rect x="30" y="23" width="82" height="5" rx="2" fill="#1f2937" />
            <rect x="30" y="32" width="82" height="5" rx="2" fill="#1f2937" />
            <rect x="30" y="41" width="82" height="5" rx="2" fill="#1f2937" />
            <rect x="30" y="50" width="82" height="5" rx="2" fill="#1f2937" />
            {/* Filled bars — green (fast) to red (slow) */}
            <rect x="30" y="23" width="20" height="5" rx="2" fill="#22c55e" opacity="0.7" />
            <rect x="30" y="32" width="40" height="5" rx="2" fill="#eab308" opacity="0.7" />
            <rect x="30" y="41" width="55" height="5" rx="2" fill="#eab308" opacity="0.7" />
            <rect x="30" y="50" width="72" height="5" rx="2" fill="#ef4444" opacity="0.7" />
          </>
        )}
        {p === 'chat-bubbles' && (
          /* Chat bubble icon + message bubbles + input — chat assistant */
          <>
            {/* Chat bubble icon */}
            <path d="M8 4 C4 4 2 7 2 10 C2 13 4 16 8 16 L8 18 L11 16 L16 16 C20 16 22 13 22 10 C22 7 20 4 16 4 Z" stroke="#60a5fa" strokeWidth="1" fill="none" opacity="0.6" />
            <circle cx="9" cy="10" r="1" fill="#60a5fa" opacity="0.5" />
            <circle cx="13" cy="10" r="1" fill="#60a5fa" opacity="0.5" />
            <circle cx="17" cy="10" r="1" fill="#60a5fa" opacity="0.5" />
            {/* Bot message bubble */}
            <rect x="4" y="24" width="55" height="8" rx="4" fill="#1f2937" opacity="0.6" />
            <rect x="8" y="26.5" width="32" height="2" rx="1" fill="#6b7280" opacity="0.4" />
            <rect x="8" y="29.5" width="20" height="2" rx="1" fill="#6b7280" opacity="0.3" />
            {/* User message bubble */}
            <rect x="50" y="36" width="62" height="7" rx="3.5" fill="#2563eb" opacity="0.5" />
            <rect x="55" y="38.5" width="28" height="2" rx="1" fill="#93c5fd" opacity="0.4" />
            {/* Bot reply bubble */}
            <rect x="4" y="47" width="65" height="8" rx="4" fill="#1f2937" opacity="0.6" />
            <rect x="8" y="49.5" width="38" height="2" rx="1" fill="#6b7280" opacity="0.4" />
            <rect x="8" y="52.5" width="25" height="2" rx="1" fill="#6b7280" opacity="0.3" />
            {/* Input bar */}
            <rect x="4" y="59" width="110" height="6" rx="3" fill="#374151" opacity="0.4" />
            <rect x="8" y="61" width="20" height="2" rx="1" fill="#6b7280" opacity="0.3" />
          </>
        )}
        {p === 'activity-feed' && (
          /* Clock icon + activity log rows — recent ticket activity */
          <>
            {/* Clock icon */}
            <circle cx="12" cy="10" r="7" stroke="#60a5fa" strokeWidth="1" fill="none" opacity="0.6" />
            <line x1="12" y1="6" x2="12" y2="10" stroke="#60a5fa" strokeWidth="1" opacity="0.5" />
            <line x1="12" y1="10" x2="15" y2="12" stroke="#60a5fa" strokeWidth="1" opacity="0.5" />
            {/* Activity rows */}
            <rect x="4" y="22" width="110" height="7" rx="2" fill="#1f2937" opacity="0.5" />
            <circle cx="9" cy="25.5" r="2" fill="#facc15" opacity="0.5" />
            <rect x="14" y="23.5" width="16" height="2" rx="1" fill="#60a5fa" opacity="0.5" />
            <rect x="33" y="23.5" width="30" height="2" rx="1" fill="#6b7280" opacity="0.3" />
            <rect x="90" y="23.5" width="18" height="2" rx="1" fill="#6b7280" opacity="0.2" />
            <rect x="4" y="32" width="110" height="7" rx="2" fill="#1f2937" opacity="0.5" />
            <circle cx="9" cy="35.5" r="2" fill="#22c55e" opacity="0.5" />
            <rect x="14" y="33.5" width="18" height="2" rx="1" fill="#60a5fa" opacity="0.5" />
            <rect x="35" y="33.5" width="25" height="2" rx="1" fill="#6b7280" opacity="0.3" />
            <rect x="90" y="33.5" width="14" height="2" rx="1" fill="#6b7280" opacity="0.2" />
            <rect x="4" y="42" width="110" height="7" rx="2" fill="#1f2937" opacity="0.5" />
            <circle cx="9" cy="45.5" r="2" fill="#f97316" opacity="0.5" />
            <rect x="14" y="43.5" width="14" height="2" rx="1" fill="#60a5fa" opacity="0.5" />
            <rect x="31" y="43.5" width="35" height="2" rx="1" fill="#6b7280" opacity="0.3" />
            <rect x="90" y="43.5" width="16" height="2" rx="1" fill="#6b7280" opacity="0.2" />
            <rect x="4" y="52" width="110" height="7" rx="2" fill="#1f2937" opacity="0.5" />
            <circle cx="9" cy="55.5" r="2" fill="#ef4444" opacity="0.5" />
            <rect x="14" y="53.5" width="20" height="2" rx="1" fill="#60a5fa" opacity="0.5" />
            <rect x="37" y="53.5" width="28" height="2" rx="1" fill="#6b7280" opacity="0.3" />
            <rect x="90" y="53.5" width="12" height="2" rx="1" fill="#6b7280" opacity="0.2" />
          </>
        )}
        {p === 'activity-list' && (
          /* Filter tabs + update log entries — client ticket update log */
          <>
            {/* Filter tab bar */}
            <rect x="4" y="3" width="16" height="5" rx="2" fill="#3b82f6" opacity="0.6" />
            <rect x="23" y="3" width="20" height="5" rx="2" fill="#374151" opacity="0.4" />
            <rect x="46" y="3" width="22" height="5" rx="2" fill="#374151" opacity="0.4" />
            {/* Row 1 — status change (green) */}
            <rect x="4" y="12" width="112" height="9" rx="2" fill="#1f2937" opacity="0.5" />
            <rect x="8" y="14" width="5" height="5" rx="1" fill="#22c55e" opacity="0.5" />
            <rect x="16" y="14" width="14" height="2" rx="1" fill="#60a5fa" opacity="0.5" />
            <rect x="33" y="14" width="12" height="2" rx="1" fill="#22c55e" opacity="0.4" />
            <rect x="16" y="17.5" width="40" height="1.5" rx="0.5" fill="#6b7280" opacity="0.3" />
            <rect x="96" y="14.5" width="16" height="2" rx="1" fill="#6b7280" opacity="0.2" />
            {/* Row 2 — priority change (yellow) */}
            <rect x="4" y="24" width="112" height="9" rx="2" fill="#1f2937" opacity="0.5" />
            <rect x="8" y="26" width="5" height="5" rx="1" fill="#facc15" opacity="0.5" />
            <rect x="16" y="26" width="16" height="2" rx="1" fill="#60a5fa" opacity="0.5" />
            <rect x="35" y="26" width="16" height="2" rx="1" fill="#facc15" opacity="0.4" />
            <rect x="16" y="29.5" width="35" height="1.5" rx="0.5" fill="#6b7280" opacity="0.3" />
            <rect x="96" y="26.5" width="12" height="2" rx="1" fill="#6b7280" opacity="0.2" />
            {/* Row 3 — assignment (blue) */}
            <rect x="4" y="36" width="112" height="9" rx="2" fill="#1f2937" opacity="0.5" />
            <rect x="8" y="38" width="5" height="5" rx="1" fill="#60a5fa" opacity="0.5" />
            <rect x="16" y="38" width="12" height="2" rx="1" fill="#60a5fa" opacity="0.5" />
            <rect x="31" y="38" width="18" height="2" rx="1" fill="#60a5fa" opacity="0.4" />
            <rect x="16" y="41.5" width="45" height="1.5" rx="0.5" fill="#6b7280" opacity="0.3" />
            <rect x="96" y="38.5" width="14" height="2" rx="1" fill="#6b7280" opacity="0.2" />
            {/* Row 4 — comment (purple) */}
            <rect x="4" y="48" width="112" height="9" rx="2" fill="#1f2937" opacity="0.5" />
            <rect x="8" y="50" width="5" height="5" rx="1" fill="#a78bfa" opacity="0.5" />
            <rect x="16" y="50" width="18" height="2" rx="1" fill="#60a5fa" opacity="0.5" />
            <rect x="37" y="50" width="14" height="2" rx="1" fill="#a78bfa" opacity="0.4" />
            <rect x="16" y="53.5" width="38" height="1.5" rx="0.5" fill="#6b7280" opacity="0.3" />
            <rect x="96" y="50.5" width="16" height="2" rx="1" fill="#6b7280" opacity="0.2" />
          </>
        )}
        {p === 'kb-search' && (
          /* Book icon + search bar + article list — knowledge base quick access */
          <>
            {/* Book icon */}
            <path d="M8 4 L8 18 Q14 16 20 18 L20 4 Q14 6 8 4 Z" stroke="#60a5fa" strokeWidth="1" fill="none" opacity="0.6" />
            <line x1="14" y1="5" x2="14" y2="17" stroke="#60a5fa" strokeWidth="0.8" opacity="0.5" />
            {/* Search bar */}
            <rect x="4" y="22" width="110" height="7" rx="3" fill="#374151" opacity="0.4" />
            <circle cx="11" cy="25.5" r="2.5" stroke="#6b7280" strokeWidth="0.8" fill="none" opacity="0.5" />
            <line x1="13" y1="27.5" x2="15" y2="29" stroke="#6b7280" strokeWidth="0.8" opacity="0.5" />
            <rect x="18" y="24" width="24" height="2.5" rx="1" fill="#6b7280" opacity="0.3" />
            {/* Article list items */}
            <rect x="4" y="34" width="110" height="8" rx="2" fill="#1f2937" opacity="0.5" />
            <rect x="8" y="36" width="40" height="2.5" rx="1" fill="#60a5fa" opacity="0.5" />
            <rect x="8" y="39.5" width="60" height="1.5" rx="0.5" fill="#6b7280" opacity="0.3" />
            <rect x="4" y="45" width="110" height="8" rx="2" fill="#1f2937" opacity="0.5" />
            <rect x="8" y="47" width="50" height="2.5" rx="1" fill="#60a5fa" opacity="0.5" />
            <rect x="8" y="50.5" width="55" height="1.5" rx="0.5" fill="#6b7280" opacity="0.3" />
            <rect x="4" y="56" width="110" height="8" rx="2" fill="#1f2937" opacity="0.5" />
            <rect x="8" y="58" width="35" height="2.5" rx="1" fill="#60a5fa" opacity="0.5" />
            <rect x="8" y="61.5" width="48" height="1.5" rx="0.5" fill="#6b7280" opacity="0.3" />
          </>
        )}
      </svg>
    </div>
  )
}

export default function WidgetGallery({
  allWidgets,
  activeKeys,
  // onAddWidget — handled externally via drag-and-drop, not used directly here
  onClose,
  onDragStartWidget,
  savedLayouts = [],
  onLoadLayout,
  onDeleteLayout,
  onRenameLayout,
  isEditMode = false,
  toggleEditMode,
  onSaveLayout,
  resetLayout,
}) {
  const [activeTab, setActiveTab] = useState('widgets') // 'widgets' | 'saved'
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const available = allWidgets.filter(w => !activeKeys.has(w.key))
  const placed = allWidgets.filter(w => activeKeys.has(w.key))

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Compact header bar (horizontal for bottom panel) ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-gray-700/50">
        {/* Title */}
        <h3 className="text-sm font-bold text-white flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          Manage Layout
        </h3>

        {/* Edit / Lock Layout toggle */}
        {toggleEditMode && (
          <button
            onClick={toggleEditMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                       border transition-colors ${
                         isEditMode
                           ? 'bg-blue-600 hover:bg-blue-700 border-blue-500 text-white'
                           : 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300 hover:text-white'
                       }`}
          >
            {isEditMode ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Lock Layout
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Layout
              </>
            )}
          </button>
        )}

        {/* Save & Reset (only in edit mode) */}
        {isEditMode && (
          <>
            <SaveLayoutButton onSave={onSaveLayout} />
            <button
              onClick={resetLayout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                         bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white
                         border border-gray-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset Layout
            </button>
            <span className="hidden sm:flex items-center gap-2 text-[10px] text-gray-500 select-none">
              <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 font-mono">Esc</kbd> exit
              <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 font-mono">Del</kbd> remove
            </span>
          </>
        )}

        {/* Inline tab buttons */}
        <div className="flex border border-gray-700/60 rounded-lg overflow-hidden">
          <button
            onClick={() => setActiveTab('widgets')}
            className={`px-3 py-1 text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'widgets'
                ? 'bg-blue-600/30 text-blue-400'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            Widgets
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-3 py-1 text-[11px] font-semibold transition-colors flex items-center gap-1.5 border-l border-gray-700/60 ${
              activeTab === 'saved'
                ? 'bg-purple-600/30 text-purple-400'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Saved{savedLayouts.length > 0 ? ` (${savedLayouts.length})` : ''}
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors shrink-0"
            title="Hide gallery"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 15l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Widgets Tab (vertical scroll grid) ─────────────── */}
      {activeTab === 'widgets' && (
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-2"
           style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {/* Available (unplaced) widgets first */}
          {available.map((widget) => (
            <div
              key={widget.key}
              draggable={isEditMode}
              unselectable="on"
              onDragStart={(e) => {
                if (!isEditMode) { e.preventDefault(); return }
                e.dataTransfer.setData('text/plain', widget.key)
                e.dataTransfer.effectAllowed = 'copy'
                onDragStartWidget?.(widget.key)
              }}
              className={`group relative bg-gray-800/80 hover:bg-gray-750/90 border border-gray-700
                         hover:border-blue-500/50 rounded-lg overflow-hidden
                         transition-all duration-150 hover:shadow-lg hover:shadow-blue-500/5
                         ${isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default opacity-60'}`}
            >
              <WidgetPreview pattern={PREVIEW_PATTERNS[widget.key]} />
              <div className="p-2">
                <h4 className="text-[11px] font-semibold text-white truncate leading-tight">
                  {widget.label}
                </h4>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed line-clamp-2">
                  {widget.description}
                </p>
              </div>
              <div className="absolute inset-0 rounded-lg border-2 border-dashed border-blue-400/0
                             group-hover:border-blue-400/20 transition-colors pointer-events-none" />
            </div>
          ))}

          {/* Already placed widgets — grayed out with overlay */}
          {placed.map((widget) => (
            <div
              key={widget.key}
              className="relative bg-gray-800/40 border border-gray-700/30 rounded-lg overflow-hidden
                         opacity-40 pointer-events-none select-none"
            >
              <WidgetPreview pattern={PREVIEW_PATTERNS[widget.key]} />
              <div className="p-2">
                <h4 className="text-[11px] font-semibold text-gray-500 truncate leading-tight">
                  {widget.label}
                </h4>
                <p className="text-[10px] text-gray-600 mt-0.5 leading-relaxed line-clamp-2">
                  {widget.description}
                </p>
              </div>
              {/* "Widget already placed" overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 rounded-lg">
                <span className="text-[10px] font-semibold text-gray-400 bg-gray-800/80 px-2 py-1 rounded-md border border-gray-700/50">
                  Widget already placed
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ── Saved Layouts Tab (horizontal scroll) ───────────── */}
      {activeTab === 'saved' && (
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden overscroll-contain px-3 py-2"
           style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
        {savedLayouts.length > 0 ? (
          <div className="flex gap-3 h-full items-start">
            {savedLayouts.map((entry) => (
              <div
                key={entry.id}
                className="group bg-gray-800/60 hover:bg-gray-800/90 border border-gray-700/50
                           hover:border-purple-500/40 rounded-lg p-3 transition-all duration-150 shrink-0"
                style={{ width: '220px' }}
              >
                {renamingId === entry.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { onRenameLayout?.(entry.id, renameValue); setRenamingId(null) }
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      autoFocus
                      maxLength={30}
                      className="flex-1 px-2 py-0.5 text-[11px] rounded bg-gray-900 border border-gray-600
                                 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                    />
                    <button
                      onClick={() => { onRenameLayout?.(entry.id, renameValue); setRenamingId(null) }}
                      className="p-0.5 text-green-400 hover:text-green-300"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setRenamingId(null)}
                      className="p-0.5 text-gray-400 hover:text-white"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-semibold text-white truncate leading-tight flex items-center gap-1.5">
                          <svg className="w-3 h-3 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                          </svg>
                          {entry.name}
                        </h4>
                        <p className="text-[9px] text-gray-500 mt-0.5 pl-[18px]">
                          {_fmtDate(entry.createdAt)}
                          {entry.hidden?.length > 0 && ` · ${allWidgets.length - entry.hidden.length} widgets`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 pl-[18px]">
                      <button
                        onClick={() => onLoadLayout?.(entry.id)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md
                                   bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 hover:text-purple-200
                                   border border-purple-500/30 hover:border-purple-500/50 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Load
                      </button>
                      <button
                        onClick={() => { setRenamingId(entry.id); setRenameValue(entry.name) }}
                        className="p-1 text-gray-500 hover:text-blue-400 rounded-md hover:bg-gray-700/50 transition-colors"
                        title="Rename"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {confirmDeleteId === entry.id ? (
                        <div className="flex items-center gap-1 ml-auto">
                          <span className="text-[9px] text-red-400">Delete?</span>
                          <button
                            onClick={() => { onDeleteLayout?.(entry.id); setConfirmDeleteId(null) }}
                            className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-red-600/30 hover:bg-red-600/50 text-red-300 transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-gray-700 hover:bg-gray-600 text-gray-400 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(entry.id)}
                          className="p-1 text-gray-500 hover:text-red-400 rounded-md hover:bg-gray-700/50 transition-colors ml-auto"
                          title="Delete"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 py-4 px-4">
            <svg className="w-8 h-8 text-purple-500/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <div>
              <p className="text-xs text-gray-400 font-medium">No saved layouts</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Use the <span className="text-purple-400 font-medium">Save Layout</span> button to save your current arrangement
              </p>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
