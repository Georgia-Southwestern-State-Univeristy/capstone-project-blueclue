import { useMinimizedTickets } from '../contexts/MinimizedTicketsContext'
import MinimizedTicketsBar from './MinimizedTicketsBar'
import TicketDetailView from './TicketDetailView'

/**
 * GlobalMinimizedBar
 * Rendered once at the App level so minimized tickets persist across page navigation.
 * Each minimized ticket gets its own TicketDetailView instance (hidden via preserveState)
 * so form state survives minimize/restore cycles.
 */
function GlobalMinimizedBar() {
  const {
    minimizedTickets,
    activeTicketId,
    isDetailOpen,
    minimize,
    restore,
    close,
    clearAll,
    closeDetail,
  } = useMinimizedTickets()

  if (minimizedTickets.length === 0) return null

  return (
    <>
      {/* One TicketDetailView per minimized ticket — preserveState keeps them mounted but hidden */}
      {minimizedTickets.map((mt) => (
        <TicketDetailView
          key={mt.ticketId}
          ticketId={mt.ticketId}
          isOpen={isDetailOpen && activeTicketId === mt.ticketId}
          onClose={closeDetail}
          onMinimize={minimize}
          preserveState
        />
      ))}
      <MinimizedTicketsBar
        tickets={minimizedTickets.filter(t => !(isDetailOpen && activeTicketId === t.ticketId))}
        onRestore={restore}
        onClose={close}
        onClearAll={clearAll}
      />
    </>
  )
}

export default GlobalMinimizedBar
