import { useState } from 'react';

/**
 * ConversationSurveyModal — End-of-conversation quality survey.
 *
 * Shown when the user closes the chat window (if conversation had ≥1 bot message).
 * Collects:
 *  1. Star rating 1-5  ("How was your experience?")
 *  2. solved           ("Did the chatbot solve your problem?")
 *  3. wouldUseAgain    ("Would you use the chatbot again?")
 *  4. npsScore  0-10   ("How likely are you to recommend…")
 *  5. feedbackText     (free-form)
 *
 * Props:
 *  - onSubmit  : (data: SurveyData) => void   — called with completed data
 *  - onSkip    : () => void                   — called when user skips
 */

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(null);
  const display = hovered ?? value;

  const labels = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-1"
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            className={`text-2xl transition-transform hover:scale-110 ${
              display >= star ? 'text-yellow-400' : 'text-gray-600'
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {display > 0 && (
        <span className="text-xs text-gray-400">{labels[display]}</span>
      )}
    </div>
  );
}

function NpsSlider({ value, onChange }) {
  const category =
    value === null   ? null :
    value >= 9       ? { label: 'Promoter',  color: 'text-green-400' } :
    value >= 7       ? { label: 'Passive',   color: 'text-yellow-400' } :
                       { label: 'Detractor', color: 'text-red-400' };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] text-gray-500">
        <span>Not likely (0)</span>
        <span>(10) Extremely likely</span>
      </div>
      <div className="flex gap-1 flex-wrap justify-center">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`w-7 h-7 rounded text-xs font-semibold transition-colors ${
              value === i
                ? i >= 9
                  ? 'bg-green-600 text-white'
                  : i >= 7
                    ? 'bg-yellow-600 text-white'
                    : 'bg-red-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            aria-label={`NPS score ${i}`}
          >
            {i}
          </button>
        ))}
      </div>
      {category && (
        <p className={`text-xs text-center font-medium ${category.color}`}>
          {category.label}
        </p>
      )}
    </div>
  );
}

function YesNoButtons({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {['Yes', 'No'].map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt === 'Yes')}
          className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors ${
            value === (opt === 'Yes')
              ? opt === 'Yes'
                ? 'bg-green-700 text-white'
                : 'bg-red-800 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function ConversationSurveyModal({ onSubmit, onSkip }) {
  const [step,         setStep]         = useState(1);  // 1 = rating, 2 = NPS + text
  const [rating,       setRating]       = useState(0);
  const [solved,       setSolved]       = useState(null);
  const [wouldUse,     setWouldUse]     = useState(null);
  const [nps,          setNps]          = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  const handleNext = () => {
    if (rating === 0) return; // star rating required before advancing
    setStep(2);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        rating:         rating || null,
        solved,
        wouldUseAgain:  wouldUse,
        npsScore:       nps,
        feedbackText:   feedbackText.trim() || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="survey-title"
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-5">

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h2 id="survey-title" className="text-base font-semibold text-gray-100">
              Rate your experience
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Your feedback helps us improve the assistant. Takes &lt;30 seconds.
            </p>
          </div>
          <button
            onClick={onSkip}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none ml-3 flex-shrink-0"
            aria-label="Skip survey"
          >
            ×
          </button>
        </div>

        {/* Consent notice */}
        <p className="text-[10px] text-gray-600">
          Your conversation may be recorded for quality assurance.
          See our privacy policy for details.
        </p>

        {/* ── Step 1: Stars + solved + would-use ────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">How was your experience? *</label>
              <StarRating value={rating} onChange={setRating} />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Did the chatbot solve your problem?</label>
              <YesNoButtons value={solved} onChange={setSolved} />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Would you use the chatbot again?</label>
              <YesNoButtons value={wouldUse} onChange={setWouldUse} />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleNext}
                disabled={rating === 0}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm
                           font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
              <button
                onClick={onSkip}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: NPS + free text ────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-gray-400">
                How likely are you to recommend our support system? (0 = not likely, 10 = extremely likely)
              </label>
              <NpsSlider value={nps} onChange={setNps} />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Anything else you&apos;d like to share? (optional)
              </label>
              <textarea
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                placeholder="Tell us more about your experience…"
                rows={3}
                maxLength={1000}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                           text-gray-200 placeholder-gray-500 resize-none
                           focus:outline-none focus:border-blue-500"
                aria-label="Additional feedback"
              />
              <p className="text-[10px] text-gray-600 text-right">{feedbackText.length}/1000</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm
                           font-medium disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit feedback'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConversationSurveyModal;
