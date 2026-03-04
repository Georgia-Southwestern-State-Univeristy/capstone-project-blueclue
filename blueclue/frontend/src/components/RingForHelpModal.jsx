import React, { useState, useEffect } from 'react';
import { getTechnicians } from '../services/userService';
import { sendRingRequest, checkLocalCooldown, getUrgencyColor, getUrgencyLabel } from '../services/ringService';
import { getUserId } from '../services/authService';

/**
 * RingForHelpModal - Modal for sending urgent help requests to other technicians
 * @param {Object} props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {number} props.ticketId - Ticket ID
 * @param {string} props.ticketSubject - Ticket subject
 * @param {Array} props.existingCollaborators - Current collaborators
 * @param {Function} props.onRingSent - Callback after ring is sent
 */
const RingForHelpModal = ({ 
  isOpen, 
  onClose, 
  ticketId,
  ticketSubject,
  existingCollaborators = [],
  onRingSent
}) => {
  const [technicians, setTechnicians] = useState([]);
  const [filteredTechnicians, setFilteredTechnicians] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTechId, setSelectedTechId] = useState(null);
  const [urgencyLevel, setUrgencyLevel] = useState('medium');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldownInfo, setCooldownInfo] = useState(null);

  // Check cooldown on mount
  useEffect(() => {
    if (isOpen) {
      const userId = getUserId();
      const lastRingTime = localStorage.getItem(`lastRingTime_${userId}`);
      if (lastRingTime) {
        const cooldown = checkLocalCooldown(lastRingTime, 10);
        if (!cooldown.canSend) {
          setCooldownInfo(cooldown);
        }
      }
      fetchTechnicians();
      resetForm();
    }
  }, [isOpen]);

  // Filter technicians based on search and existing collaborators
  useEffect(() => {
    if (!technicians.length) return;

    let filtered = technicians;

    // Filter out existing collaborators
    const existingIds = existingCollaborators.map(c => c.user_id);
    filtered = filtered.filter(tech => !existingIds.includes(tech.id));

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tech => 
        tech.first_name?.toLowerCase().includes(query) ||
        tech.last_name?.toLowerCase().includes(query) ||
        tech.email?.toLowerCase().includes(query) ||
        tech.username?.toLowerCase().includes(query)
      );
    }

    setFilteredTechnicians(filtered);
  }, [searchQuery, technicians, existingCollaborators]);

  const fetchTechnicians = async () => {
    try {
      setLoading(true);
      const response = await getTechnicians();
      setTechnicians(response || []);
    } catch (err) {
      console.error('Failed to fetch technicians:', err);
      setError('Failed to load technicians');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSearchQuery('');
    setSelectedTechId(null);
    setUrgencyLevel('medium');
    setMessage('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedTechId) {
      setError('Please select a technician');
      return;
    }

    if (cooldownInfo && !cooldownInfo.canSend) {
      setError(`Please wait ${cooldownInfo.remainingTime} more minutes before sending another ring`);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const result = await sendRingRequest(ticketId, selectedTechId, urgencyLevel, message);
      
      // Store cooldown info (user-specific)
      const userId = getUserId();
      localStorage.setItem(`lastRingTime_${userId}`, new Date().toISOString());
      
      // Call success callback
      if (onRingSent) {
        const selectedTech = technicians.find(t => t.id === selectedTechId);
        onRingSent({
          targetTech: selectedTech,
          urgencyLevel,
          message,
          cooldown: result.cooldown
        });
      }
      
      onClose();
    } catch (err) {
      console.error('Failed to send ring request:', err);
      if (err.status === 429) {
        setError(err.message || 'Rate limit exceeded. Please try again later.');
        setCooldownInfo({ canSend: false, remainingTime: 10 });
      } else {
        setError(err.message || 'Failed to send ring request');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTech = (techId) => {
    setSelectedTechId(selectedTechId === techId ? null : techId);
    setError('');
  };

  const getTechAvailabilityStatus = (tech) => {
    if (tech.dnd_enabled && tech.dnd_until && new Date(tech.dnd_until) > new Date()) {
      return { available: false, status: 'DND', color: 'text-red-400' };
    }
    return { available: true, status: 'Available', color: 'text-green-400' };
  };

  if (!isOpen) return null;

  const selectedTech = selectedTechId ? technicians.find(t => t.id === selectedTechId) : null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-[#1a1f2e] border border-orange-500/30 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-900/30 rounded-lg border border-orange-500/30">
              <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Ring for Help</h2>
              <p className="text-sm text-gray-400 mt-1">Send an urgent help request to another technician</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Ticket Info */}
        <div className="px-6 pt-4 pb-2 bg-gray-900/30 border-b border-gray-700/30">
          <p className="text-sm text-gray-400">
            <span className="font-medium">Ticket:</span> #{ticketId} - {ticketSubject}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start gap-2">
              <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Cooldown Warning */}
          {cooldownInfo && !cooldownInfo.canSend && (
            <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-yellow-300">
                Cooldown active. Please wait {cooldownInfo.remainingTime} minute(s) before sending another ring request.
              </p>
            </div>
          )}

          {/* Urgency Level */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Urgency Level <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['low', 'medium', 'high'].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setUrgencyLevel(level)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    urgencyLevel === level
                      ? `border-2 bg-opacity-20`
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  style={{
                    borderColor: urgencyLevel === level ? getUrgencyColor(level) : undefined,
                    backgroundColor: urgencyLevel === level ? `${getUrgencyColor(level)}15` : undefined
                  }}
                >
                  <div className="text-center">
                    <span className="text-2xl block mb-1">{getUrgencyLabel(level)}</span>
                    <span className="text-xs text-gray-400 capitalize">{level}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="mb-6">
            <label htmlFor="ringMessage" className="block text-sm font-medium text-gray-300 mb-2">
              Message (Optional)
            </label>
            <textarea
              id="ringMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Brief explanation of what you need help with..."
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none"
              rows={3}
              maxLength={500}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">{message.length}/500 characters</p>
          </div>

          {/* Technician Search */}
          <div className="mb-4">
            <label htmlFor="techSearch" className="block text-sm font-medium text-gray-300 mb-2">
              Select Technician <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                id="techSearch"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full px-4 py-2 pl-10 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                disabled={loading}
              />
              <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Technician List */}
          <div className="mb-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-400 mt-2">Loading technicians...</p>
              </div>
            ) : filteredTechnicians.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p>No technicians available</p>
                {searchQuery && <p className="text-sm mt-1">Try adjusting your search</p>}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredTechnicians.map((tech) => {
                  const availability = getTechAvailabilityStatus(tech);
                  const isSelected = selectedTechId === tech.id;

                  return (
                    <button
                      key={tech.id}
                      type="button"
                      onClick={() => availability.available && handleSelectTech(tech.id)}
                      disabled={!availability.available || loading}
                      className={`w-full p-4 rounded-lg border transition-all text-left ${
                        isSelected
                          ? 'border-orange-500 bg-orange-900/20'
                          : availability.available
                          ? 'border-gray-700 hover:border-orange-500/50 hover:bg-white/5'
                          : 'border-gray-800 bg-gray-900/30 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          {/* Avatar */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                            availability.available ? 'bg-gradient-to-br from-orange-500 to-red-500' : 'bg-gray-700'
                          }`}>
                            {tech.first_name?.[0]}{tech.last_name?.[0]}
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white">
                                {tech.first_name} {tech.last_name}
                              </p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${availability.color} bg-opacity-10`}>
                                • {availability.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-400">{tech.email}</p>
                            <p className="text-xs text-gray-500 capitalize">{tech.role?.replace('_', ' ')}</p>
                          </div>
                        </div>

                        {/* Selection indicator */}
                        {isSelected && (
                          <svg className="w-6 h-6 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Tech Summary */}
          {selectedTech && (
            <div className="mb-4 p-4 bg-orange-900/10 border border-orange-500/30 rounded-lg">
              <p className="text-sm text-gray-300 mb-2">
                <strong className="text-orange-400">Sending to:</strong> {selectedTech.first_name} {selectedTech.last_name}
              </p>
              <p className="text-sm text-gray-300 mb-2">
                <strong className="text-orange-400">Urgency:</strong> {getUrgencyLabel(urgencyLevel)}
              </p>
              {message && (
                <p className="text-sm text-gray-300">
                  <strong className="text-orange-400">Message:</strong> {message}
                </p>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-700/50 bg-gray-900/30">
          <p className="text-xs text-gray-500">
            The technician will have 5 minutes to respond
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !selectedTechId || (cooldownInfo && !cooldownInfo.canSend)}
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Send Ring Request
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RingForHelpModal;
