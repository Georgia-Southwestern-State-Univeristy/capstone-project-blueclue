import { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import QuickReplyButtons from './QuickReplyButtons';
import {
  playMessageSound,
  sendBrowserNotification,
} from '../utils/chatNotifications';

/**
 * ChatWindow — Collapsible chat panel for the BlueClue Assistant.
 *
 * Always rendered in the DOM (when the parent mounts it). Visibility is
 * controlled entirely via CSS transitions keyed off the `isOpen` prop so
 * we never need setState inside a useEffect.
 *
 * Desktop: fixed bottom-right, 20 px from edges, 340×440.
 * Mobile: full-screen overlay.
 * Smooth slide-up / fade-in on open, reverse on close.
 *
 * Props (all supplied by the parent via useChatStore):
 *  - isOpen: boolean
 *  - messages: Array<{ id, sender, text, timestamp }>
 *  - onSend: (text: string) => void
 *  - onClose: () => void
 *  - onMinimize: () => void
 *  - onFeedback: (messageId, rating) => void
 *  - isTyping: boolean
 */
function ChatWindow({
  isOpen,
  messages,
  onSend,
  onClose,
  onMinimize,
  onFeedback,
  isTyping = false,
}) {
  const messagesEndRef = useRef(null);
  const prevMessageCount = useRef(messages.length);

  // ── Auto-scroll to newest message ──────────────────────────────────
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  // ── Sound + browser notification on new bot message ────────────────
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      const latest = messages[messages.length - 1];
      if (latest?.sender === 'bot') {
        playMessageSound();
        sendBrowserNotification('BlueClue Assistant', latest.text);
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages]);

  // Show quick replies only before user's first message
  const showQuickReplies =
    messages.length === 1 && messages[0]?.sender === 'bot' && !isTyping;

  return (
    <div
      className={`fixed z-50 flex flex-col bg-gray-900 border border-gray-700 shadow-2xl
        transition-all duration-300 ease-in-out
        inset-0 sm:inset-auto sm:bottom-5 sm:right-5
        sm:w-[340px] sm:h-[440px] sm:rounded-xl
        ${isOpen
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
      role="dialog"
      aria-label="BlueClue Assistant chat"
      aria-hidden={!isOpen}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 sm:rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <h3 className="text-sm font-semibold text-white">BlueClue Assistant</h3>
        </div>

        <div className="flex items-center gap-1">
          {/* Minimize */}
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

          {/* Close */}
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

      {/* ── Messages area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={msg.id}
            className="animate-fade-in"
            style={{ animationDelay: `${idx === messages.length - 1 ? 0 : 0}ms` }}
          >
            <MessageBubble
              id={msg.id}
              sender={msg.sender}
              text={msg.text}
              timestamp={msg.timestamp}
              onFeedback={onFeedback}
            />
          </div>
        ))}

        {/* Quick reply chips */}
        {showQuickReplies && (
          <div className="animate-fade-in">
            <QuickReplyButtons onSelect={onSend} disabled={isTyping} />
          </div>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-start animate-fade-in">
            <div className="bg-gray-800 text-gray-400 px-3 py-2 rounded-lg rounded-bl-none text-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ───────────────────────────────────────────── */}
      <ChatInput onSend={onSend} disabled={isTyping} autoFocus={isOpen} />
    </div>
  );
}

export default ChatWindow;
