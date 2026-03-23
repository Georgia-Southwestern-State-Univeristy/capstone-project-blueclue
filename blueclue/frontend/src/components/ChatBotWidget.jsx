import { useState, useRef, useEffect, useCallback } from 'react'
import { sendChatMessage } from '../services/chatService'

const WELCOME_MESSAGE = {
  id: 1,
  sender: 'bot',
  text: "Hi! I'm the BlueClue Assistant. How can I help you today?",
  timestamp: new Date().toISOString(),
}

/**
 * ChatBotWidget — Inline mini-chat widget for the dashboard.
 * Uses the same backend chatbot (POST /api/chat/message) as the floating chat.
 * Provides a compact message list + input for quick conversations.
 */
export default function ChatBotWidget() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const messagesEndRef = useRef(null)

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isTyping) return

    const userMsg = { id: Date.now(), sender: 'user', text, timestamp: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    try {
      const data = await sendChatMessage(text, conversationId)
      setConversationId(data.conversationId ?? conversationId)
      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId ?? Date.now() + 1,
          sender: 'bot',
          text: data.response,
          timestamp: new Date().toISOString(),
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: 'bot', text: 'Sorry, something went wrong. Please try again.', timestamp: new Date().toISOString() },
      ])
    } finally {
      setIsTyping(false)
    }
  }, [input, isTyping, conversationId])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewConversation = () => {
    setMessages([{ ...WELCOME_MESSAGE, timestamp: new Date().toISOString() }])
    setConversationId(null)
    setInput('')
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-100 truncate">Chat Assistant</h3>
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
        </div>
        {messages.length > 1 && (
          <button
            onClick={handleNewConversation}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-800"
            title="Start new conversation"
          >
            New Chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-2 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-800 text-gray-300 rounded-bl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-400 px-3 py-2 rounded-lg rounded-bl-none text-xs flex items-center gap-1">
              <span className="w-1 h-1 rounded-full animate-bounce bg-current" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full animate-bounce bg-current" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full animate-bounce bg-current" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-gray-700/50">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 500))}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            disabled={isTyping}
            rows={1}
            className="flex-1 bg-gray-800 text-white text-xs rounded-lg px-3 py-1.5 placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors resize-none overflow-y-auto"
            style={{ maxHeight: '60px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:bg-gray-700 disabled:text-gray-500"
            aria-label="Send message"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
