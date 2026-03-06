/**
 * useTicketSocket
 * ───────────────
 * Calls `onTicketChange` whenever the server emits `ticket_created` or
 * `ticket_updated` over the shared Socket.IO connection.
 *
 * Falls back to a polling timer (default 5 min) when the socket is
 * disconnected so widgets never go completely stale.
 *
 * Usage:
 *   const { isConnected } = useTicketSocket(fetchData)
 */
import { useEffect, useRef, useCallback } from 'react'
import { getSocket } from '../services/socketService'

const FALLBACK_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * @param {Function} onTicketChange - Callback fired on ticket_created / ticket_updated
 * @param {number}   [fallbackMs]   - Fallback polling interval when socket is down (default 5 min)
 */
export function useTicketSocket(onTicketChange, fallbackMs = FALLBACK_INTERVAL_MS) {
  const debounceRef  = useRef(null)
  const fallbackRef  = useRef(null)
  const callbackRef  = useRef(onTicketChange)

  // Keep ref current without re-subscribing
  useEffect(() => { callbackRef.current = onTicketChange }, [onTicketChange])

  // Debounced fire — collapses rapid bursts (e.g. bulk updates) into one refresh
  const fire = useCallback(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      callbackRef.current?.()
    }, 300)
  }, [])

  useEffect(() => {
    const socket = getSocket()

    if (socket) {
      socket.on('ticket_created', fire)
      socket.on('ticket_updated', fire)
    }

    // Fallback: poll on a long interval in case socket is unavailable
    fallbackRef.current = setInterval(() => {
      // Only fire the fallback if socket is NOT connected
      const s = getSocket()
      if (!s || !s.connected) {
        callbackRef.current?.()
      }
    }, fallbackMs)

    return () => {
      if (socket) {
        socket.off('ticket_created', fire)
        socket.off('ticket_updated', fire)
      }
      clearInterval(fallbackRef.current)
      clearTimeout(debounceRef.current)
    }
  }, [fire, fallbackMs])

  // Expose connection status (re-read on each render — lightweight)
  const socket = getSocket()
  return { isConnected: socket?.connected ?? false }
}
