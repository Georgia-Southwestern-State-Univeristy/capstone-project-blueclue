import { useState, useEffect, useRef } from 'react'

const CANCELLATION_REASONS = [
  { value: '', label: 'Select a reason...' },
  { value: 'Resolved myself', label: 'Resolved myself' },
  { value: 'No longer needed', label: 'No longer needed' },
  { value: 'Duplicate', label: 'Duplicate' },
  { value: 'Other', label: 'Other' },
]

/**
 * CancelTicketModal
 * Confirmation modal for clients to cancel their own ticket.
 * Requires a cancellation reason (dropdown) and accepts optional details.
 */
function CancelTicketModal({ isOpen, ticketNumber, onConfirm, onClose, isSubmitting }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState(null)
  const modalRef = useRef(null)
  const [lastOpenState, setLastOpenState] = useState(false)

  // Reset state when modal transitions from closed to open
  if (isOpen && !lastOpenState) {
    setReason('')
    setDetails('')
    setError(null)
    setLastOpenState(true)
  } else if (!isOpen && lastOpenState) {
    setLastOpenState(false)
  }

  // Escape key closes modal
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, isSubmitting, onClose])

  const handleSubmit = () => {
    if (!reason) {
      setError('Please select a cancellation reason')
      return
    }
    setError(null)
    onConfirm(reason, details.trim())
  }

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current && !isSubmitting) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-900/60 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Cancel Ticket</h2>
              {ticketNumber && (
                <p className="text-sm text-gray-400">{ticketNumber}</p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-300">
            Are you sure you want to cancel this ticket? This action cannot be undone.
          </p>

          {/* Reason dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Reason for cancellation <span className="text-red-400">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(null) }}
              disabled={isSubmitting}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-600 text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50 cursor-pointer"
            >
              {CANCELLATION_REASONS.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Optional details */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Additional details <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              disabled={isSubmitting}
              placeholder="Provide any additional context..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-600 text-gray-200 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50 resize-none"
            />
            <p className="text-xs text-gray-600 mt-1 text-right">{details.length}/500</p>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-400 flex items-center gap-1.5">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-950/50 border-t border-gray-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium border border-gray-700 transition-colors disabled:opacity-50"
          >
            Keep Ticket
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !reason}
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Cancel Ticket
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CancelTicketModal
