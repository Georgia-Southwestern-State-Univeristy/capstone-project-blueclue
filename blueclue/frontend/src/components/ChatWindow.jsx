import { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';

/**
 * ChatWindow — Collapsible chat panel for the BlueClue Assistant.
 *
 * Renders a fixed-position panel (bottom-right) with:
 *  - Header: title, minimize, close buttons
 *  - Scrollable message history area
 *  - Typing indicator
 *  - Text input area with send button
 *
 * Props:
 *  - isOpen: boolean       — controls panel visibility
 *  - onClose: () => void   — called when the close (×) button is pressed
 *  - onMinimize: () => void — called when the minimize (—) button is pressed
 */
function ChatWindow({ isOpen, onClose, onMinimize }) {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Hi! I\'m the BlueClue Assistant. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to newest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    // Simulate bot typing then responding
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: 'Thanks for your message! This is a placeholder response. The AI backend will be integrated soon.',
          timestamp: new Date(),
        },
      ]);
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col bg-gray-900 border border-gray-700 rounded-xl shadow-2xl
        w-[calc(100vw-2rem)] h-[calc(100vh-6rem)]
        sm:w-[340px] sm:h-[440px]
        transition-all duration-300 ease-in-out"
      role="dialog"
      aria-label="BlueClue Assistant chat"
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 rounded-t-xl">
        <div className="flex items-center gap-2">
          {/* Bot avatar dot */}
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <h3 className="text-sm font-semibold text-white">BlueClue Assistant</h3>
        </div>

        <div className="flex items-center gap-1">
          {/* Minimize button */}
          <button
            onClick={onMinimize || onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
            aria-label="Minimize chat"
            title="Minimize"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
            aria-label="Close chat"
            title="Close"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Messages area ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            sender={msg.sender}
            text={msg.text}
            timestamp={msg.timestamp}
          />
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-start">
            <div className="bg-gray-800 text-gray-400 px-3 py-2 rounded-lg rounded-bl-none text-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Invisible anchor for auto-scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ─────────────────────────────────────────────── */}
      <div className="border-t border-gray-700 px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
            aria-label="Chat message input"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors"
            aria-label="Send message"
            title="Send"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;
