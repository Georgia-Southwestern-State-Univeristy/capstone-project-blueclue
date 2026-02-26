import { useState, useEffect, useMemo } from 'react';
import { requestUpdate, calculateDeadline } from '../services/updateRequestService';

/**
 * RequestUpdateModal
 * Modal for management to request status updates from technicians
 */
function RequestUpdateModal({ isOpen, onClose, ticketId, ticketSubject, collaborators, assignedTo, assignedToName }) {
  const [selectedTech, setSelectedTech] = useState(assignedTo ? String(assignedTo) : '');
  const [message, setMessage] = useState('');
  const [deadlineOption, setDeadlineOption] = useState('4h');
  const [customDeadline, setCustomDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Build complete list of available technicians
  const availableTechnicians = useMemo(() => {
    const techList = [];
    
    // Add assigned primary technician if exists and not already in collaborators
    if (assignedTo && assignedToName) {
      const isInCollaborators = collaborators?.some(c => c.user_id === assignedTo);
      if (!isInCollaborators) {
        techList.push({
          user_id: assignedTo,
          first_name: assignedToName.split(' ')[0] || assignedToName,
          last_name: assignedToName.split(' ').slice(1).join(' ') || '',
          role: 'primary'
        });
      }
    }
    
    // Add all collaborators
    if (collaborators && collaborators.length > 0) {
      techList.push(...collaborators);
    }
    
    return techList;
  }, [assignedTo, assignedToName, collaborators]);

  // Sync selectedTech with assignedTo prop when it changes
  useEffect(() => {
    if (isOpen && assignedTo) {
      setSelectedTech(String(assignedTo));
    }
  }, [isOpen, assignedTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedTech || selectedTech === '') {
      setError('Please select a technician');
      return;
    }

    try {
      setLoading(true);
      
      const deadline = deadlineOption === 'custom' 
        ? new Date(customDeadline)
        : calculateDeadline(deadlineOption);

      const result = await requestUpdate(ticketId, {
        assignedTo: parseInt(selectedTech),
        message: message.trim() || null,
        deadline: deadline.toISOString()
      });

      // Success - notify parent and close
      onClose(result.data);
    } catch (err) {
      console.error('Error requesting update:', err);
      setError(err.response?.data?.message || 'Failed to send update request');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSelectedTech(assignedTo ? String(assignedTo) : '');
      setMessage('');
      setDeadlineOption('4h');
      setCustomDeadline('');
      setError(null);
      onClose(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div 
        className="bg-[#1a1f2e] border border-indigo-500/30 rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-900/30 rounded-lg border border-indigo-500/30">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Request Status Update</h2>
              <p className="text-sm text-gray-400 mt-1">Ticket #{ticketId} - {ticketSubject}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}

          {/* Technician Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Request Update From <span className="text-red-400">*</span>
            </label>
            {availableTechnicians.length === 0 ? (
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-sm text-yellow-300">
                  No technicians are assigned to this ticket yet. Please assign a technician first.
                </p>
              </div>
            ) : (
              <select
                value={selectedTech}
                onChange={(e) => setSelectedTech(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                required
              >
                <option value="" className="bg-gray-900">Select a technician...</option>
                {availableTechnicians.map(tech => (
                  <option key={String(tech.user_id)} value={String(tech.user_id)} className="bg-gray-900">
                    {tech.first_name} {tech.last_name} 
                    {tech.role === 'primary' ? ' (Primary)' : ' (Assisting)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Deadline Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Deadline <span className="text-red-400">*</span>
            </label>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeadlineOption('1h')}
                  className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    deadlineOption === '1h'
                      ? 'bg-indigo-900/30 border-indigo-500 text-indigo-300'
                      : 'bg-gray-900/30 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  1 Hour
                </button>
                <button
                  type="button"
                  onClick={() => setDeadlineOption('4h')}
                  className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    deadlineOption === '4h'
                      ? 'bg-indigo-900/30 border-indigo-500 text-indigo-300'
                      : 'bg-gray-900/30 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  4 Hours
                </button>
                <button
                  type="button"
                  onClick={() => setDeadlineOption('eod')}
                  className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    deadlineOption === 'eod'
                      ? 'bg-indigo-900/30 border-indigo-500 text-indigo-300'
                      : 'bg-gray-900/30 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  End of Day
                </button>
                <button
                  type="button"
                  onClick={() => setDeadlineOption('custom')}
                  className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    deadlineOption === 'custom'
                      ? 'bg-indigo-900/30 border-indigo-500 text-indigo-300'
                      : 'bg-gray-900/30 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  Custom
                </button>
              </div>
              
              {deadlineOption === 'custom' && (
                <input
                  type="datetime-local"
                  value={customDeadline}
                  onChange={(e) => setCustomDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  required
                />
              )}
            </div>
          </div>

          {/* Optional Message */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Message / Question (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What specific information do you need? Any context or questions..."
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1.5">{message.length}/500 characters</p>
          </div>

          {/* Preview */}
          {selectedTech && (
            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-3">
              <p className="text-sm text-indigo-300">
                <strong className="text-indigo-200">Preview:</strong> The selected technician will receive a high-priority notification
                and email requesting an update by{' '}
                <strong className="text-white">
                  {deadlineOption === 'custom' && customDeadline
                    ? new Date(customDeadline).toLocaleString()
                    : calculateDeadline(deadlineOption).toLocaleString()
                  }
                </strong>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedTech || selectedTech === '' || (deadlineOption === 'custom' && !customDeadline)}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RequestUpdateModal;
