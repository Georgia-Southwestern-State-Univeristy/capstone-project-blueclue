import { useState, useCallback, useRef, useEffect } from 'react'
import { ToastContext } from './ToastContextDef'
import Toast from '../components/Toast'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [isOnCooldown, setIsOnCooldown] = useState(false)
  const cooldownTimerRef = useRef(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current)
      }
    }
  }, [])

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    // Prevent duplicate toasts with the same message and type
    setToasts(prev => {
      const isDuplicate = prev.some(
        toast => toast.message === message && toast.type === type
      )
      
      if (isDuplicate) {
        return prev // Don't add duplicate
      }
      
      // If on cooldown, skip adding new toast
      if (isOnCooldown) {
        return prev
      }
      
      const id = Date.now() + Math.random()
      return [...prev, { id, message, type, duration }]
    })
  }, [isOnCooldown])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
    
    // Start cooldown period (2 seconds) to prevent toast spam
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current)
    }
    
    setIsOnCooldown(true)
    cooldownTimerRef.current = setTimeout(() => {
      setIsOnCooldown(false)
      cooldownTimerRef.current = null
    }, 2000) // 2-second cooldown
  }, [])

  const toast = {
    success: (message, duration) => addToast(message, 'success', duration),
    error: (message, duration) => addToast(message, 'error', duration),
    warning: (message, duration) => addToast(message, 'warning', duration),
    info: (message, duration) => addToast(message, 'info', duration),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Container - Fixed position at top-right */}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map(({ id, message, type, duration }) => (
          <div key={id} className="pointer-events-auto">
            <Toast
              id={id}
              message={message}
              type={type}
              duration={duration}
              onClose={removeToast}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
