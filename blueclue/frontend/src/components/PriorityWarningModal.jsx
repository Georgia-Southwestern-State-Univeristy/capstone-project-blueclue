import { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * PriorityWarningModal Component
 * Shows when user selection conflicts with high-confidence AI recommendation
 */
const PriorityWarningModal = ({ 
  isOpen, 
  onClose, 
  userPriority, 
  aiPriority, 
  aiConfidence,
  onAcceptAI,
  onKeepUser,
  ticketSubject
}) => {
  const [overrideReason, setOverrideReason] = useState('');
  const [submitWithReason, setSubmitWithReason] = useState(false);

  if (!isOpen) return null;

  const confidencePercentage = Math.round(aiConfidence * 100);

  const priorityInfo = {
    critical: { label: 'Critical', color: 'text-red-400', bgColor: 'bg-red-900/30', icon: '' },
    high: { label: 'High', color: 'text-orange-400', bgColor: 'bg-orange-900/30', icon: '' },
    medium: { label: 'Medium', color: 'text-yellow-400', bgColor: 'bg-yellow-900/30', icon: '' },
    low: { label: 'Low', color: 'text-green-400', bgColor: 'bg-green-900/30', icon: '' }
  };

  const userInfo = priorityInfo[userPriority] || priorityInfo.medium;
  const aiInfo = priorityInfo[aiPriority] || priorityInfo.medium;

  const handleKeepUser = () => {
    if (submitWithReason && overrideReason.trim()) {
      onKeepUser(overrideReason);
    } else {
      onKeepUser(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-800 border border-yellow-600 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-yellow-900/30 border-b border-yellow-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-600 flex items-center justify-center text-2xl">
              !
            </div>
            <div>
              <h3 className="text-lg font-bold text-yellow-400">
                Priority Recommendation Conflict
              </h3>
              <p className="text-sm text-gray-300">
                AI has a different suggestion with high confidence
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Ticket subject */}
          {ticketSubject && (
            <div className="bg-gray-900/50 rounded p-3 border border-gray-700">
              <p className="text-xs text-gray-400 mb-1">Ticket Subject</p>
              <p className="text-sm text-gray-200 font-medium">{ticketSubject}</p>
            </div>
          )}

          {/* Comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* User selection */}
            <div className={`border-2 ${userInfo.bgColor} border-gray-600 rounded-lg p-4`}>
              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">
                Your Selection
              </p>
              <div className="flex items-center gap-2">
                <span className="text-3xl">{userInfo.icon}</span>
                <div>
                  <p className={`text-xl font-bold ${userInfo.color}`}>
                    {userInfo.label}
                  </p>
                </div>
              </div>
            </div>

            {/* AI recommendation */}
            <div className={`border-2 border-blue-500 ${aiInfo.bgColor} rounded-lg p-4`}>
              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">
                AI Recommends
              </p>
              <div className="flex items-center gap-2">
                <span className="text-3xl">{aiInfo.icon}</span>
                <div>
                  <p className={`text-xl font-bold ${aiInfo.color}`}>
                    {aiInfo.label}
                  </p>
                  <p className="text-xs text-blue-400 font-semibold">
                    {confidencePercentage}% Confidence
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
              <span></span>
              <span>Why is this important?</span>
            </h4>
            <ul className="text-sm text-gray-300 space-y-1 ml-6">
              <li className="list-disc">
                The AI analyzed your ticket content and has <strong className="text-blue-400">{confidencePercentage}% confidence</strong> in its recommendation
              </li>
              <li className="list-disc">
                Incorrect priority can affect response time and resource allocation
              </li>
              <li className="list-disc">
                High-confidence AI recommendations are typically more accurate
              </li>
            </ul>
          </div>

          {/* Optional reason input */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={submitWithReason}
                onChange={(e) => setSubmitWithReason(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <span>Provide a reason for overriding AI recommendation (optional but helpful for improving accuracy)</span>
            </label>
            
            {submitWithReason && (
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g., 'User is VIP and needs immediate attention' or 'Similar issue was resolved quickly before'"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 text-sm placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                rows={3}
              />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-900/50 border-t border-gray-700 px-6 py-4 flex gap-3">
          <button
            onClick={onAcceptAI}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>Use AI Recommendation ({aiInfo.label})</span>
          </button>
          <button
            onClick={handleKeepUser}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>Override</span>
            <span>Keep My Selection ({userInfo.label})</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 text-gray-400 hover:text-gray-300 transition-colors"
            title="Cancel ticket creation"
          >
            X
          </button>
        </div>
      </div>
    </div>
  );
};

PriorityWarningModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  userPriority: PropTypes.oneOf(['critical', 'high', 'medium', 'low']).isRequired,
  aiPriority: PropTypes.oneOf(['critical', 'high', 'medium', 'low']).isRequired,
  aiConfidence: PropTypes.number.isRequired,
  onAcceptAI: PropTypes.func.isRequired,
  onKeepUser: PropTypes.func.isRequired,
  ticketSubject: PropTypes.string
};

export default PriorityWarningModal;
