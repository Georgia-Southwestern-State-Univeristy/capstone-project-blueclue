import { useEffect, useRef } from 'react'
import TicketForm from './TicketForm'

function TicketSubmissionModal({ isOpen, onClose, onSubmit }) {
  const modalRef = useRef(null)

  // Close modal when clicking outside (on the backdrop)
  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      onClose()
    }
  }

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent scrolling when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    >
      <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Submit a Ticket</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors text-2xl leading-none"
            aria-label="Close modal"
          >
            X
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <TicketForm onSubmit={onSubmit} />
        </div>
      </div>
    </div>
  )
}

export default TicketSubmissionModal
