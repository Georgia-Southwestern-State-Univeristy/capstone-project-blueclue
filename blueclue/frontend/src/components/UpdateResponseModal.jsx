import { useState } from 'react';
import { fulfillUpdateRequest, requestExtension, formatTimeRemaining } from '../services/updateRequestService';

/**
 * UpdateResponseModal
 * Modal for technicians to respond to update requests
 */
function UpdateResponseModal({ isOpen, onClose, updateRequest }) {
  const [responseText, setResponseText] = useState('');
  const [isResolved, setIsResolved] = useState(false);
  const [needsMoreTime, setNeedsMoreTime] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockerDescription, setBlockerDescription] = useState('');
  const [estimatedCompletion, setEstimatedCompletion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showExtensionRequest, setShowExtensionRequest] = useState(false);
  const [extensionDeadline, setExtensionDeadline] = useState('');
  const [extensionReason, setExtensionReason] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!responseText.trim()) {
      setError('Please provide a status update');
      return;
    }

    if (isBlocked && !blockerDescription.trim()) {
      setError('Please describe the blocker');
      return;
    }

    try {
      setLoading(true);
      
      const result = await fulfillUpdateRequest(updateRequest.id, {
        responseText: responseText.trim(),
        isResolved,
        needsMoreTime,
        isBlocked,
        blockerDescription: isBlocked ? blockerDescription.trim() : null,
        estimatedCompletion: estimatedCompletion ? new Date(estimatedCompletion).toISOString() : null
      });

      // Success - notify parent and close
      onClose(result.data);
    } catch (err) {
      console.error('Error submitting update response:', err);
      setError(err.response?.data?.message || 'Failed to submit update');
    } finally {
      setLoading(false);
    }
  };

  const handleExtensionRequest = async () => {
    if (!extensionDeadline || !extensionReason.trim()) {
      setError('Please provide both a new deadline and reason for extension');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await requestExtension(updateRequest.id, {
        newDeadline: new Date(extensionDeadline).toISOString(),
        reason: extensionReason.trim()
      });

      alert('Extension request submitted! Your manager will review it.');
      setShowExtensionRequest(false);
      setExtensionDeadline('');
      setExtensionReason('');
    } catch (err) {
      console.error('Error requesting extension:', err);
      setError(err.response?.data?.message || 'Failed to request extension');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setResponseText('');
      setIsResolved(false);
      setNeedsMoreTime(false);
      setIsBlocked(false);
      setBlockerDescription('');
      setEstimatedCompletion('');
      setError(null);
      onClose(null);
    }
  };

  if (!isOpen || !updateRequest) return null;

  const timeInfo = formatTimeRemaining(updateRequest.deadline);

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-[#1a1f2e] border border-indigo-500/30 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1f2e] border-b border-indigo-500/30 px-6 py-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-900/30 border border-indigo-500/30">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Respond to Update Request</h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Ticket #{updateRequest.ticket_id} - {updateRequest.ticket_subject}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  timeInfo.isOverdue 
                    ? 'bg-red-900/30 text-red-300 border border-red-500/30' 
                    : timeInfo.isUrgent 
                    ? 'bg-orange-900/30 text-orange-300 border border-orange-500/30' 
                    : 'bg-indigo-900/30 text-indigo-300 border border-indigo-500/30'
                }`}>
                  {timeInfo.text}
                </span>
                <span className="text-xs text-gray-500">
                  Requested by {updateRequest.requester_first_name} {updateRequest.requester_last_name}
                </span>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-200 disabled:opacity-50 ml-4 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Request Message */}
          {updateRequest.message && (
            <div className="mt-3 bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-3">
              <p className="text-sm text-indigo-300">
                <strong className="text-indigo-200">Request:</strong> {updateRequest.message}
              </p>
            </div>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}

          {/* Status Update Text */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Status Update *
            </label>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Provide a detailed status update on this ticket..."
              rows={6}
              maxLength={2000}
              className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              required
            />
            <p className="text-xs text-gray-400 mt-1">{responseText.length}/2000 characters</p>
          </div>

          {/* Status Checkboxes */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Current Status
            </label>
            
            <label className="flex items-start gap-3 p-3 bg-gray-900/30 border border-gray-700 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={isResolved}
                onChange={(e) => {
                  setIsResolved(e.target.checked);
                  if (e.target.checked) {
                    setNeedsMoreTime(false);
                    setIsBlocked(false);
                  }
                }}
                className="mt-1 w-4 h-4 text-green-600 bg-gray-900 border-gray-600 rounded focus:ring-green-500 focus:ring-offset-gray-900"
              />
              <div>
                <div className="font-medium text-gray-200 flex items-center gap-2">
                  <span>Resolved</span>
                </div>
                <p className="text-sm text-gray-400">The ticket issue has been resolved</p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-gray-900/30 border border-gray-700 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={needsMoreTime}
                onChange={(e) => {
                  setNeedsMoreTime(e.target.checked);
                  if (e.target.checked) {
                    setIsResolved(false);
                  }
                }}
                className="mt-1 w-4 h-4 text-orange-600 bg-gray-900 border-gray-600 rounded focus:ring-orange-500 focus:ring-offset-gray-900"
              />
              <div>
                <div className="font-medium text-gray-200 flex items-center gap-2">
                  <span>Need More Time</span>
                </div>
                <p className="text-sm text-gray-400">Still working on this, need additional time</p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-gray-900/30 border border-gray-700 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={isBlocked}
                onChange={(e) => {
                  setIsBlocked(e.target.checked);
                  if (e.target.checked) {
                    setIsResolved(false);
                  }
                }}
                className="mt-1 w-4 h-4 text-red-600 bg-gray-900 border-gray-600 rounded focus:ring-red-500 focus:ring-offset-gray-900"
              />
              <div>
                <div className="font-medium text-gray-200 flex items-center gap-2">
                  <span>Blocked</span>
                </div>
                <p className="text-sm text-gray-400">Progress is blocked by external factors</p>
              </div>
            </label>
          </div>

          {/* Blocker Description (conditional) */}
          {isBlocked && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <label className="block text-sm font-medium text-red-300 mb-2">
                Describe the Blocker *
              </label>
              <textarea
                value={blockerDescription}
                onChange={(e) => setBlockerDescription(e.target.value)}
                placeholder="What is preventing progress? Who or what do you need to proceed?"
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 bg-gray-900/50 border border-red-500/50 text-gray-200 placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                required={isBlocked}
              />
              <p className="text-xs text-red-400 mt-1">{blockerDescription.length}/500 characters</p>
            </div>
          )}

          {/* Estimated Completion (conditional) */}
          {(needsMoreTime || isBlocked) && !isResolved && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Estimated Completion Time
              </label>
              <input
                type="datetime-local"
                value={estimatedCompletion}
                onChange={(e) => setEstimatedCompletion(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">When do you expect to complete this?</p>
            </div>
          )}

          {/* Deadline Extension Request */}
          {!showExtensionRequest && !updateRequest.extension_requested && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowExtensionRequest(true)}
                className="w-full px-4 py-2 bg-amber-900/30 border border-amber-500/30 text-amber-300 rounded-lg hover:bg-amber-900/50 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Request Deadline Extension
              </button>
            </div>
          )}

          {/* Extension Request Form */}
          {showExtensionRequest && (
            <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-900/10 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-amber-300 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Request Deadline Extension
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowExtensionRequest(false);
                    setExtensionDeadline('');
                    setExtensionReason('');
                  }}
                  className="text-gray-400 hover:text-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Deadline *
                </label>
                <input
                  type="datetime-local"
                  value={extensionDeadline}
                  onChange={(e) => setExtensionDeadline(e.target.value)}
                  min={new Date(updateRequest.deadline).toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">Must be after current deadline</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reason for Extension *
                </label>
                <textarea
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="Explain why you need more time..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">{extensionReason.length}/500 characters</p>
              </div>

              <button
                type="button"
                onClick={handleExtensionRequest}
                disabled={loading || !extensionDeadline || !extensionReason.trim()}
                className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                Submit Extension Request
              </button>
            </div>
          )}

          {/* Extension Status Display */}
          {updateRequest.extension_requested && (
            <div className={`border rounded-lg p-4 ${
              updateRequest.extension_approved 
                ? 'border-green-500/30 bg-green-900/10' 
                : updateRequest.extension_approved === false
                ? 'border-red-500/30 bg-red-900/10'
                : 'border-amber-500/30 bg-amber-900/10'
            }`}>
              <p className={`text-sm font-medium ${
                updateRequest.extension_approved 
                  ? 'text-green-300' 
                  : updateRequest.extension_approved === false
                  ? 'text-red-300'
                  : 'text-amber-300'
              }`}>
                {updateRequest.extension_approved 
                  ? 'Extension Approved' 
                  : updateRequest.extension_approved === false
                  ? 'Extension Denied'
                  : 'Extension Pending Approval'}
              </p>
              {updateRequest.extension_approved && updateRequest.extension_deadline && (
                <p className="text-xs text-gray-400 mt-1">
                  New deadline: {new Date(updateRequest.extension_deadline).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !responseText.trim() || (isBlocked && !blockerDescription.trim())}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Submit Update
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UpdateResponseModal;
