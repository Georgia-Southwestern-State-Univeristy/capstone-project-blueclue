import { useState } from 'react';
import { respondToRingRequest } from '../services/ringService';

/**
 * RingRequestPopup - Displays an urgent ring request notification as a popup
 * @param {Object} notification - The ring request notification
 * @param {Function} onRespond - Callback when user responds
 * @param {Function} onClose - Callback when popup is closed
 */
function RingRequestPopup({ notification, onRespond, onClose }) {
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState(null);

  const ringRequestId = notification.metadata?.ring_request_id;
  const urgencyLevel = (notification.metadata?.urgency_level || 'MEDIUM').toUpperCase();
  const userMessage = notification.metadata?.user_message;

  const urgencyColors = {
    HIGH: 'from-red-500 via-red-600 to-orange-500',
    MEDIUM: 'from-red-500 via-red-600 to-orange-500',
    LOW: 'from-red-500 via-red-600 to-orange-500'
  };

  const handleResponse = async (action) => {
    if (!ringRequestId) return;
    
    setIsResponding(true);
    setError(null);

    try {
      await respondToRingRequest(ringRequestId, action);
      if (onRespond) onRespond(action);
      onClose();
    } catch (err) {
      console.error('Failed to respond to ring request:', err);
      setError('Failed to respond. Please try again.');
      setIsResponding(false);
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
      <div className={`
        bg-gradient-to-r ${urgencyColors[urgencyLevel]}
        rounded-lg shadow-2xl 
        w-96 max-w-full
        overflow-hidden
        ring-2 ring-red-400/60
      `}>
        {/* Header */}
        <div className="bg-black/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h3 className="text-white font-bold text-lg">Urgent Help Request!</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="bg-gray-900 p-4">
          {/* Priority Badge */}
          <div className="mb-3">
            <span className={`
              inline-block px-3 py-1 rounded-full text-sm font-bold
              ${urgencyLevel === 'HIGH' ? 'bg-red-500 text-white' : ''}
              ${urgencyLevel === 'MEDIUM' ? 'bg-orange-500 text-white' : ''}
              ${urgencyLevel === 'LOW' ? 'bg-amber-500 text-gray-900' : ''}
            `}>
              {urgencyLevel} PRIORITY
            </span>
          </div>

          {/* Message */}
          <p className="text-white text-base mb-3">
            {notification.message}
          </p>

          {/* User Message if provided */}
          {userMessage && (
            <div className="bg-gray-800/50 rounded p-3 mb-4 border border-gray-700">
              <p className="text-gray-300 text-sm italic">
                "{userMessage}"
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handleResponse('accept')}
              disabled={isResponding}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded transition-colors"
            >
              {isResponding ? 'Responding...' : 'Accept & Help'}
            </button>
            <button
              onClick={() => handleResponse('decline')}
              disabled={isResponding}
              className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded transition-colors"
            >
              Decline
            </button>
          </div>

          {/* View Ticket Link */}
          {notification.ticket_id && (
            <div className="mt-3 text-center">
              <button
                onClick={() => {
                  // This would be handled by parent component to open ticket detail
                  if (onClose) onClose();
                }}
                className="text-blue-400 hover:text-blue-300 text-sm underline"
              >
                View Ticket #{notification.ticket_number || notification.ticket_id}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RingRequestPopup;
