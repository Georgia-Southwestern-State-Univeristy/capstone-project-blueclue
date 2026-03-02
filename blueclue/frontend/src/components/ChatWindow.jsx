import { useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'
import QuickReplyButtons from './QuickReplyButtons'

// ============================================================================
// ChatWindow
// ============================================================================
// Fully controlled – all state lives in the parent (Navbar → useChatStore).
// Uses CSS-only transitions so we avoid setState-in-useEffect lint issues.

export default function ChatWindow({
  isOpen,
  messages,
  onSend,
  onClose,
  onFeedback,
  isTyping,
  suggestions,
}) {
  const bottomRef = useRef(null)

  // Auto-scroll when messages change or typing indicator appears
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Only user messages count (for showing / hiding quick replies)
  const userMessageCount = messages.filter((m) => m.sender === 'user').length

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed z-50 flex flex-col bg-gray-800 shadow-2xl border border-gray-700
        inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[380px] sm:h-[500px] sm:rounded-xl
        transition-all duration-300 ease-in-out
        ${isOpen
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
    >
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900 sm:rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <h3 className="text-sm font-semibold text-white">BlueClue Assistant</h3>
        </div>

        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-700 transition-colors"
          aria-label="Close chat"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ─── Messages ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            id={msg.id}
            sender={msg.sender}
            text={msg.text}
            timestamp={msg.timestamp}
            onFeedback={onFeedback}
          />
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-gray-700 rounded-xl rounded-bl-none px-4 py-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ─── Quick replies (shown until user sends first message) ─── */}
      {userMessageCount === 0 && (
        <QuickReplyButtons
          options={suggestions || undefined}
          onSelect={onSend}
          disabled={isTyping}
        />
      )}

      {/* ─── Input ─── */}
      <ChatInput onSend={onSend} disabled={isTyping} />
    </div>
  )
}
