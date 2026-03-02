import { useState } from 'react'

// FeedbackButtons – thumbs-up / thumbs-down shown on bot messages

export default function FeedbackButtons({ messageId, onFeedback }) {
  const [selected, setSelected] = useState(null) // 'up' | 'down' | null

  const handleClick = (value) => {
    if (selected) return // already voted
    setSelected(value)
    onFeedback(messageId, value === 'up')
  }

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <button
        onClick={() => handleClick('up')}
        disabled={!!selected}
        className={`p-0.5 rounded transition-colors ${
          selected === 'up' ? 'text-green-400' : 'text-gray-500 hover:text-green-400'
        } disabled:cursor-default`}
        aria-label="Helpful"
        title="Helpful"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
        </svg>
      </button>
      <button
        onClick={() => handleClick('down')}
        disabled={!!selected}
        className={`p-0.5 rounded transition-colors ${
          selected === 'down' ? 'text-red-400' : 'text-gray-500 hover:text-red-400'
        } disabled:cursor-default`}
        aria-label="Not helpful"
        title="Not helpful"
      >
        <svg className="w-3.5 h-3.5 rotate-180" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
        </svg>
      </button>
      {selected && (
        <span className="text-[10px] text-gray-500">Thanks for the feedback!</span>
      )}
    </div>
  )
}
