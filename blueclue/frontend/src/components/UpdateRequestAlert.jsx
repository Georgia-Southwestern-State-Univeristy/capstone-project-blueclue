import { useState, useEffect } from 'react';
import { getUpdateRequests, formatTimeRemaining } from '../services/updateRequestService';
import { formatDateTime as _fmtDateTime } from '../utils/dateFormatter';

/**
 * UpdateRequestAlert
 * Banner component showing pending update requests for technicians
 * Displays on dashboard with countdown and quick response button
 */
function UpdateRequestAlert({ onRespond }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch pending requests
  const fetchRequests = async () => {
    try {
      const result = await getUpdateRequests({ status: 'pending' });
      setRequests(result.data.requests || []);
    } catch (error) {
      console.error('Error fetching update requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-rotate through requests every 5 seconds if multiple
  useEffect(() => {
    if (requests.length > 1) {
      const rotateInterval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % requests.length);
      }, 5000);
      return () => clearInterval(rotateInterval);
    }
  }, [requests.length]);

  // Update countdown every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const tickInterval = setInterval(() => {
      setTick(t => t + 1);
    }, 60000); // Update every minute
    return () => clearInterval(tickInterval);
  }, []);

  if (loading || requests.length === 0) {
    return null;
  }

  const currentRequest = requests[currentIndex];
  const timeInfo = formatTimeRemaining(currentRequest.deadline);
  
  // Determine alert style based on urgency
  const getAlertStyle = () => {
    if (timeInfo.isOverdue) {
      return {
        bg: 'bg-red-900/20',
        border: 'border-red-500/30',
        icon: 'text-red-400',
        badge: 'bg-red-900/30 text-red-300 border border-red-500/30',
        button: 'bg-red-600 hover:bg-red-500',
        dot: 'bg-red-500'
      };
    } else if (timeInfo.isUrgent) {
      return {
        bg: 'bg-orange-900/20',
        border: 'border-orange-500/30',
        icon: 'text-orange-400',
        badge: 'bg-orange-900/30 text-orange-300 border border-orange-500/30',
        button: 'bg-orange-600 hover:bg-orange-500',
        dot: 'bg-orange-500'
      };
    } else {
      return {
        bg: 'bg-indigo-900/20',
        border: 'border-indigo-500/30',
        icon: 'text-indigo-400',
        badge: 'bg-indigo-900/30 text-indigo-300 border border-indigo-500/30',
        button: 'bg-indigo-600 hover:bg-indigo-500',
        dot: 'bg-indigo-500'
      };
    }
  };

  const style = getAlertStyle();

  return (
    <div className={`${style.bg} border-l-4 ${style.border} rounded-lg p-4 mb-6 shadow-lg`}>
      <div className="flex items-start justify-between gap-4">
        {/* Icon & Content */}
        <div className="flex items-start gap-3 flex-1">
          {/* Alert Icon */}
          <div className={`${style.icon} flex-shrink-0 mt-0.5`}>
            {timeInfo.isOverdue ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white">
                {timeInfo.isOverdue ? 'Overdue Update Request' : 'Status Update Requested'}
              </h3>
              <span className={`${style.badge} px-2 py-0.5 rounded-full text-xs font-medium`}>
                {timeInfo.text}
              </span>
              {requests.length > 1 && (
                <span className="text-xs text-gray-500">
                  ({currentIndex + 1} of {requests.length})
                </span>
              )}
            </div>
            
            <p className="text-sm text-gray-300 mt-1">
              <strong className="text-gray-200">{currentRequest.requester_first_name} {currentRequest.requester_last_name}</strong>
              {' '}requested an update on{' '}
              <strong className="text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer">
                Ticket #{currentRequest.ticket_id}
              </strong>
              {currentRequest.ticket_priority && (
                <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium border ${
                  currentRequest.ticket_priority === 'urgent' ? 'bg-red-900/30 text-red-300 border-red-500/30' :
                  currentRequest.ticket_priority === 'high' ? 'bg-orange-900/30 text-orange-300 border-orange-500/30' :
                  currentRequest.ticket_priority === 'normal' ? 'bg-indigo-900/30 text-indigo-300 border-indigo-500/30' :
                  'bg-gray-800/50 text-gray-400 border-gray-600'
                }`}>
                  {currentRequest.ticket_priority}
                </span>
              )}
            </p>

            {currentRequest.message && (
              <p className="text-sm text-gray-400 mt-2 italic">
                "{currentRequest.message}"
              </p>
            )}

            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <span>
                Deadline: {_fmtDateTime(currentRequest.deadline)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => onRespond(currentRequest)}
          className={`${style.button} text-white px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 flex-shrink-0 shadow-md`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Respond
        </button>
      </div>

      {/* Pagination Dots */}
      {requests.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {requests.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex 
                  ? `${style.dot} w-4` 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
              aria-label={`View request ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default UpdateRequestAlert;
