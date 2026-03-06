import { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * PriorityRecommendation Component
 * Displays AI's recommended priority with confidence visualization
 */
const PriorityRecommendation = ({ 
  aiPriority, 
  aiConfidence, 
  userPriority,
  onAccept,
  onReject,
  showActions = true,
  compact = false
}) => {
  const [showExplanation, setShowExplanation] = useState(false);

  // Determine confidence level
  const getConfidenceLevel = () => {
    if (aiConfidence >= 0.8) return 'high';
    if (aiConfidence >= 0.5) return 'medium';
    return 'low';
  };

  const confidenceLevel = getConfidenceLevel();
  const confidencePercentage = Math.round(aiConfidence * 100);

  // Color schemes based on confidence
  const confidenceColors = {
    high: {
      bg: 'bg-green-900/30',
      border: 'border-green-600',
      text: 'text-green-400',
      badge: 'bg-green-600',
      icon: ''
    },
    medium: {
      bg: 'bg-yellow-900/30',
      border: 'border-yellow-600',
      text: 'text-yellow-400',
      badge: 'bg-yellow-600',
      icon: '~'
    },
    low: {
      bg: 'bg-orange-900/30',
      border: 'border-orange-600',
      text: 'text-orange-400',
      badge: 'bg-orange-600',
      icon: '!'
    }
  };

  const colors = confidenceColors[confidenceLevel];

  // Priority display names and colors
  const priorityInfo = {
    critical: { label: 'Critical', color: 'text-red-400', icon: '' },
    high: { label: 'High', color: 'text-orange-400', icon: '' },
    medium: { label: 'Medium', color: 'text-yellow-400', icon: '' },
    low: { label: 'Low', color: 'text-green-400', icon: '' }
  };

  const priority = priorityInfo[aiPriority] || priorityInfo.medium;

  // Explanation text based on confidence and comparison
  const getExplanation = () => {
    const reasons = [];
    
    if (confidenceLevel === 'high') {
      reasons.push(`The AI is very confident (${confidencePercentage}%) about this classification based on the ticket content.`);
    } else if (confidenceLevel === 'medium') {
      reasons.push(`The AI has moderate confidence (${confidencePercentage}%) in this classification.`);
    } else {
      reasons.push(`The AI has low confidence (${confidencePercentage}%). Manual review recommended.`);
    }

    if (userPriority && userPriority !== aiPriority) {
      const userPriorityLabel = priorityInfo[userPriority]?.label || userPriority;
      reasons.push(`You selected "${userPriorityLabel}" priority, which differs from the AI recommendation.`);
      
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const diff = Math.abs(priorityOrder[aiPriority] - priorityOrder[userPriority]);
      
      if (diff > 1) {
        reasons.push(`This is a significant difference. Consider the AI's analysis before proceeding.`);
      }
    }

    return reasons;
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colors.border} ${colors.bg}`}>
        <span className={`text-xs font-medium ${colors.text}`}>
          AI: {priority.icon} {priority.label}
        </span>
        <span className={`text-xs ${colors.text}`}>
          {confidencePercentage}%
        </span>
      </div>
    );
  }

  return (
    <div className={`border ${colors.border} ${colors.bg} rounded-lg p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full ${colors.badge} flex items-center justify-center text-white font-bold`}>
            {colors.icon}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-200">
              AI Recommendation
            </h4>
            <p className="text-xs text-gray-400">
              Based on ticket analysis
            </p>
          </div>
        </div>
        
        {/* Confidence badge */}
        <div className={`px-2 py-1 rounded ${colors.badge} text-white text-xs font-bold`}>
          {confidencePercentage}%
        </div>
      </div>

      {/* Priority display */}
      <div className="border-l-4 border-gray-600 pl-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{priority.icon}</span>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Suggested Priority
            </p>
            <p className={`text-lg font-bold ${priority.color}`}>
              {priority.label}
            </p>
          </div>
        </div>
      </div>

      {/* Confidence meter */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Confidence Level</span>
          <span className={`font-semibold ${colors.text}`}>
            {confidenceLevel.toUpperCase()}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className={`${colors.badge} h-2 rounded-full transition-all duration-500`}
            style={{ width: `${confidencePercentage}%` }}
          />
        </div>
      </div>

      {/* Explanation toggle */}
      <button
        onClick={() => setShowExplanation(!showExplanation)}
        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
      >
        <span>{showExplanation ? '▼' : '▶'}</span>
        <span>Why this recommendation?</span>
      </button>

      {/* Explanation content */}
      {showExplanation && (
        <div className="bg-gray-800/50 rounded p-3 space-y-2 text-xs text-gray-300">
          {getExplanation().map((reason, idx) => (
            <p key={idx} className="flex items-start gap-2">
              <span className="text-gray-500 mt-0.5">•</span>
              <span>{reason}</span>
            </p>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {showActions && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={onAccept}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
          >
            Use AI Recommendation
          </button>
          <button
            onClick={onReject}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium py-2 px-4 rounded transition-colors"
          >
            Keep My Selection
          </button>
        </div>
      )}
    </div>
  );
};

PriorityRecommendation.propTypes = {
  aiPriority: PropTypes.oneOf(['critical', 'high', 'medium', 'low']).isRequired,
  aiConfidence: PropTypes.number.isRequired,
  userPriority: PropTypes.oneOf(['critical', 'high', 'medium', 'low']),
  onAccept: PropTypes.func,
  onReject: PropTypes.func,
  showActions: PropTypes.bool,
  compact: PropTypes.bool
};

export default PriorityRecommendation;
