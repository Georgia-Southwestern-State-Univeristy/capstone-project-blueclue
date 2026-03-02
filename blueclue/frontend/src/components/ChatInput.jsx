import { useState } from 'react'

// ChatInput – text field + send button at the bottom of the chat window

export default function ChatInput({ onSend, disabled = false }) {
  const [text, setText] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t border-gray-700">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message…"
        disabled={disabled}
        className="flex-1 bg-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        maxLength={2000}
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Send message"
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </form>
  )
}
