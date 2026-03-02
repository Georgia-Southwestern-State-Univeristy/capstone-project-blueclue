import { useState } from 'react';

/**
 * FeedbackButtons — Thumbs-up / thumbs-down rating for a bot message.
 *
 * Displays inline under a bot bubble. Once the user selects a rating the
 * choice is highlighted and the buttons become non-interactive.
 *
 * Props:
 *  - messageId: number | string — id of the message being rated
 *  - onFeedback: (messageId, rating: 'positive' | 'negative') => void
 */
function FeedbackButtons({ messageId, onFeedback }) {
  const [rating, setRating] = useState(null); // null | 'positive' | 'negative'

  const handleClick = (value) => {
    if (rating) return; // already rated
    setRating(value);
    if (onFeedback) onFeedback(messageId, value);
  };

  return (
    <div className="flex items-center gap-1 mt-1">
      {/* Thumbs up */}
      <button
        onClick={() => handleClick('positive')}
        disabled={rating !== null}
        className={`p-1 rounded transition-colors ${
          rating === 'positive'
            ? 'text-green-400'
            : rating === null
              ? 'text-gray-500 hover:text-green-400 hover:bg-gray-800'
              : 'text-gray-600 opacity-40'
        }`}
        aria-label="Helpful"
        title="Helpful"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"
          />
        </svg>
      </button>

      {/* Thumbs down */}
      <button
        onClick={() => handleClick('negative')}
        disabled={rating !== null}
        className={`p-1 rounded transition-colors ${
          rating === 'negative'
            ? 'text-red-400'
            : rating === null
              ? 'text-gray-500 hover:text-red-400 hover:bg-gray-800'
              : 'text-gray-600 opacity-40'
        }`}
        aria-label="Not helpful"
        title="Not helpful"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"
          />
        </svg>
      </button>

      {/* Confirmation text */}
      {rating && (
        <span className="text-[10px] text-gray-500 ml-1">
          Thanks for the feedback!
        </span>
      )}
    </div>
  );
}

export default FeedbackButtons;
