import { useState, useEffect } from 'react'

/**
 * Alert component for ticket submission feedback
 * @param {Object} props
 * @param {string} props.type - Alert type: 'success' or 'error'
 * @param {string} props.message - The message to display
 * @param {function} props.onClose - Callback when alert is dismissed
 * @param {number} props.autoDismiss - Auto-dismiss time in ms (default: 5000, set to 0 to disable)
 */
function Alert({ type = 'success', message, onClose, autoDismiss = 5000 }) {
  const [isVisible, setIsVisible] = useState(true)

  // Auto-dismiss after specified time
  useEffect(() => {
    if (autoDismiss > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, autoDismiss)

      return () => clearTimeout(timer)
    }
  }, [autoDismiss, onClose])

  // Handle manual close
  const handleClose = () => {
    setIsVisible(false)
    onClose?.()
  }

  if (!isVisible || !message) return null

  const styles = {
    success: {
      container: 'bg-green-50 border-green-200 text-green-700',
      icon: (
        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path 
            fillRule="evenodd" 
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
            clipRule="evenodd" 
          />
        </svg>
      ),
      closeButton: 'text-green-500 hover:text-green-700'
    },
    error: {
      container: 'bg-red-50 border-red-200 text-red-700',
      icon: (
        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path 
            fillRule="evenodd" 
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
            clipRule="evenodd" 
          />
        </svg>
      ),
      closeButton: 'text-red-500 hover:text-red-700'
    }
  }

  const currentStyle = styles[type] || styles.success

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`
        ${currentStyle.container}
        border rounded-lg px-4 py-3
        flex items-center justify-between gap-3
        animate-fade-in
      `}
    >
      <div className="flex items-center gap-2">
        {currentStyle.icon}
        <span>{message}</span>
      </div>
      
      <button
        type="button"
        onClick={handleClose}
        className={`
          ${currentStyle.closeButton}
          p-1 rounded-full
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current
          transition-colors duration-200
        `}
        aria-label="Dismiss alert"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path 
            fillRule="evenodd" 
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
            clipRule="evenodd" 
          />
        </svg>
      </button>
    </div>
  )
}

export default Alert
