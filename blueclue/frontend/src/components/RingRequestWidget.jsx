import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIncomingRingRequests, respondToRingRequest, getUrgencyColor, getUrgencyLabel } from '../services/ringService';
import { getSocket } from '../services/socketService';

/**
 * RingRequestWidget - Dashboard widget for displaying incoming ring requests
 * Shows pending help requests with Accept/Decline/View actions
 */
const RingRequestWidget = ({ onViewTicket }) => {
  const [ringRequests, setRingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [respondingId, setRespondingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRingRequests();
    
    // Poll for new requests every 10 seconds as a fallback
    const interval = setInterval(fetchRingRequests, 10000);

    // Fetch immediately when the tab regains focus
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchRingRequests();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Listen for instant push via WebSocket — no polling delay
    const socket = getSocket();
    if (socket) {
      socket.on('ring_request', fetchRingRequests);
    }
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (socket) {
        socket.off('ring_request', fetchRingRequests);
      }
    };
  }, []);

  const fetchRingRequests = async () => {
    try {
      const requests = await getIncomingRingRequests();
      setRingRequests(requests || []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch ring requests:', err);
      setError('Failed to load ring requests');
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (ringRequestId, action) => {
    try {
      setRespondingId(ringRequestId);
      await respondToRingRequest(ringRequestId, action);
      
      // Remove the request from the list
      setRingRequests(prev => prev.filter(req => req.id !== ringRequestId));
      
      // Show success message
      const actionText = action === 'accept' ? 'accepted' : 'declined';
      // You could add a toast notification here
      console.log(`Ring request ${actionText} successfully`);
      
    } catch (err) {
      console.error(`Failed to ${action} ring request:`, err);
      setError(`Failed to ${action} ring request`);
    } finally {
      setRespondingId(null);
    }
  };

  const handleViewTicket = (ticketId) => {
    // If callback provided, use it
    if (onViewTicket) {
      onViewTicket(ticketId);
      return;
    }

    // Otherwise, fallback to navigation
    sessionStorage.setItem('openTicketId', ticketId);
    
    // Get user role to navigate to appropriate dashboard
    const userStr = localStorage.getItem('blueclue_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === 'technician') {
          navigate('/my-tickets');
        } else if (user.role === 'management') {
          navigate('/management-dashboard');
        } else {
          navigate('/technician');
        }
      } catch (e) {
        navigate('/technician');
      }
    }
  };

  const getTimeSince = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return 'Just now';
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin} mins ago`;
    
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  };

  const getTimeRemaining = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const expiry = new Date(created.getTime() + 5 * 60000); // 5 minutes from creation
    const remaining = Math.max(0, Math.ceil((expiry - now) / 60000));
    return remaining;
  };

  return (
    <div className="h-full flex flex-col bg-[#1a1f2e] rounded-lg border border-orange-500/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 border-b border-orange-500/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className={`w-5 h-5 text-white ${ringRequests.length > 0 ? 'animate-pulse' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
          <h3 className="font-bold text-white">Ring for Help</h3>
          {ringRequests.length > 0 && (
            <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium text-white">
              {ringRequests.length}
            </span>
          )}
        </div>
        {ringRequests.length > 0 && (
          <button
            onClick={() => setRingRequests([])}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Dismiss all"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-3 py-2 bg-red-900/20 border-b border-red-500/30 flex-shrink-0">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Request List */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-full py-8">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : ringRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-gray-400 px-4">
            <svg className="w-12 h-12 mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-sm font-medium text-gray-400">No pending ring requests</p>
            <p className="text-xs text-gray-500 mt-1">You'll be notified when a technician needs help</p>
          </div>
        ) : (
            ringRequests.map((request) => {
              const timeRemaining = getTimeRemaining(request.created_at);
              const isExpiring = timeRemaining <= 2;
              const isResponding = respondingId === request.id;

              return (
                <div
                  key={request.id}
                  className="p-4 border-b border-gray-700/50 hover:bg-white/5 transition-colors"
                  style={{
                    borderLeft: `4px solid ${getUrgencyColor(request.urgency_level)}`
                  }}
                >
                  {/* Requester Info */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-medium flex-shrink-0">
                      {request.requester_first_name?.[0]}{request.requester_last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-white text-sm truncate">
                          {request.requester_first_name} {request.requester_last_name}
                        </p>
                        <span 
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ 
                            backgroundColor: `${getUrgencyColor(request.urgency_level)}20`,
                            color: getUrgencyColor(request.urgency_level)
                          }}
                        >
                          {getUrgencyLabel(request.urgency_level)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Ticket #{request.ticket_id} • {request.ticket_subject}
                      </p>
                    </div>
                  </div>

                  {/* Message */}
                  {request.message && (
                    <div className="mb-3 p-2 bg-gray-900/50 rounded text-sm text-gray-300 italic">
                      "{request.message}"
                    </div>
                  )}

                  {/* Time Info */}
                  <div className="flex items-center gap-2 mb-3">
                    <svg className={`w-4 h-4 ${isExpiring ? 'text-red-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className={`text-xs ${isExpiring ? 'text-red-400 font-medium' : 'text-gray-500'}`}>
                      {timeRemaining}m remaining • {getTimeSince(request.created_at)}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespond(request.id, 'accept')}
                      disabled={isResponding}
                      className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      {isResponding ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Accept</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleRespond(request.id, 'decline')}
                      disabled={isResponding}
                      className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Decline</span>
                    </button>
                    
                    <button
                      onClick={() => handleViewTicket(request.ticket_id)}
                      disabled={isResponding}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      title="View Ticket"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      {/* Footer */}
      {ringRequests.length > 0 && (
        <div className="px-3 py-2 bg-gray-900/30 border-t border-gray-700/50 flex-shrink-0">
          <p className="text-xs text-gray-500 text-center">
            Requests auto-expire after 5 minutes
          </p>
        </div>
      )}
    </div>
  );
};

export default RingRequestWidget;
