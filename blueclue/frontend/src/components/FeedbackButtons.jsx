import { useState, useRef, useEffect } from 'react';

/**
 * FeedbackButtons — Thumbs-up / thumbs-down rating for a bot message.
 *
 * When the user clicks thumbs-down a small panel slides open asking:
 *   • "What went wrong?" dropdown (required)
 *   • "Tell us more…" optional free-text
 *
 * Props:
 *  - messageId  : number | string
 *  - onFeedback : (messageId, rating: 'positive' | 'negative', details?: { reason, text }) => void
 */

const FAILURE_REASONS = [
  { value: 'no_answer',       label: "Didn't answer my question" },
  { value: 'wrong_info',      label: 'Wrong information'          },
  { value: 'unhelpful_tone',  label: 'Unhelpful tone'             },
  { value: 'too_slow',        label: 'Too slow'                   },
  { value: 'other',           label: 'Other'                      },
];

function FeedbackButtons({ messageId, onFeedback }) {
  const [rating,       setRating]       = useState(null);   // null | 'positive' | 'negative'
  const [showPanel,    setShowPanel]    = useState(false);  // thumbs-down detail panel
  const [reason,       setReason]       = useState('');
  const [details,      setDetails]      = useState('');
  const [submitted,    setSubmitted]    = useState(false);
  const textRef = useRef(null);

  // Auto-focus text area when panel opens
  useEffect(() => {
    if (showPanel && textRef.current) textRef.current.focus();
  }, [showPanel]);

  const handleThumbsUp = () => {
    if (rating) return;
    setRating('positive');
    setSubmitted(true);
    if (onFeedback) onFeedback(messageId, 'positive');
  };

  const handleThumbsDown = () => {
    if (rating) return;
    setRating('negative');
    setShowPanel(true);
  };

  const submitNegative = () => {
    if (!reason) return;                    // reason is required
    setShowPanel(false);
    setSubmitted(true);
    if (onFeedback) onFeedback(messageId, 'negative', { reason, text: details.trim() });
  };

  const cancelNegative = () => {
    // User opened panel but cancelled — clear the pending rating
    setRating(null);
    setShowPanel(false);
    setReason('');
    setDetails('');
  };

  return (
    <div className="mt-1 space-y-1">
      {/* ── Row: thumb buttons + confirmation ─────────────────────── */}
      <div className="flex items-center gap-1">
        {/* Thumbs up */}
        <button
          onClick={handleThumbsUp}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
          </svg>
        </button>

        {/* Thumbs down */}
        <button
          onClick={handleThumbsDown}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
          </svg>
        </button>

        {submitted && (
          <span className="text-[10px] text-gray-500 ml-1">Thanks for the feedback!</span>
        )}
      </div>

      {/* ── Thumbs-down detail panel ───────────────────────────────── */}
      {showPanel && (
        <div className="ml-0.5 p-2 rounded-lg bg-gray-850 border border-gray-700 text-xs space-y-2 w-56">
          <p className="text-gray-300 font-medium">What went wrong?</p>

          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-200
                       focus:outline-none focus:border-blue-500 text-xs"
            aria-label="Failure reason"
          >
            <option value="">Select a reason…</option>
            {FAILURE_REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <textarea
            ref={textRef}
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder="Tell us more… (optional)"
            rows={2}
            maxLength={500}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-200
                       placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 text-xs"
            aria-label="Additional feedback details"
          />

          <div className="flex gap-2">
            <button
              onClick={submitNegative}
              disabled={!reason}
              className="flex-1 py-1 rounded bg-red-700 hover:bg-red-600 text-white disabled:opacity-40
                         disabled:cursor-not-allowed transition-colors"
            >
              Submit
            </button>
            <button
              onClick={cancelNegative}
              className="flex-1 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeedbackButtons;
