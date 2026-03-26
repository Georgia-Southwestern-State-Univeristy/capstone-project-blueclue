import { createContext, useContext, useState, useCallback } from 'react'

const MinimizedTicketsContext = createContext(null)

export function MinimizedTicketsProvider({ children }) {
  const [minimizedTickets, setMinimizedTickets] = useState([])
  const [activeTicketId, setActiveTicketId] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const minimize = useCallback((ticketData) => {
    setMinimizedTickets(prev =>
      prev.some(t => t.ticketId === ticketData.ticketId) ? prev : [...prev, ticketData]
    )
    setIsDetailOpen(false)
  }, [])

  const restore = useCallback((ticketId) => {
    setActiveTicketId(ticketId)
    setIsDetailOpen(true)
  }, [])

  const close = useCallback((ticketId) => {
    setMinimizedTickets(prev => prev.filter(t => t.ticketId !== ticketId))
  }, [])

  const clearAll = useCallback(() => {
    setMinimizedTickets([])
  }, [])

  const openTicket = useCallback((ticketId) => {
    setActiveTicketId(ticketId)
    setIsDetailOpen(true)
  }, [])

  const closeDetail = useCallback(() => {
    setIsDetailOpen(false)
  }, [])

  return (
    <MinimizedTicketsContext.Provider
      value={{
        minimizedTickets,
        activeTicketId,
        isDetailOpen,
        minimize,
        restore,
        close,
        clearAll,
        openTicket,
        closeDetail,
      }}
    >
      {children}
    </MinimizedTicketsContext.Provider>
  )
}

export function useMinimizedTickets() {
  const ctx = useContext(MinimizedTicketsContext)
  if (!ctx) throw new Error('useMinimizedTickets must be used within MinimizedTicketsProvider')
  return ctx
}
