import { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import QuickReplyButtons from './QuickReplyButtons';
import {
  playMessageSound,
  sendBrowserNotification,
} from '../utils/chatNotifications';

const TECH_ROLES = new Set(['technician', 'senior_technician', 'management', 'admin']);

/**
 * ChatWindow — Collapsible chat panel for the BlueClue Assistant.
 *
 * Props:
 *  - isOpen:         boolean
 *  - messages:       Array<{id, sender, text, timestamp, attachmentUrl?}>
 *  - onSend:         (text: string) => void
 *  - onClose:        () => void
 *  - onMinimize:     () => void
 *  - onFeedback:     (messageId, rating) => void
 *  - isTyping:       boolean
 *  - suggestions:    Array<{label, value}> | undefined
 *  - onActionButton: (buttonId) => void
 *  - chatMode:       'customer' | 'tech'
 *  - onToggleMode:   () => void   — only called for tech-role users
 *  - userRole:       string       — to decide if mode toggle is shown
 *  - onHandoff:       () => void   — customer requests a human tech
 *  - onFileUpload:    (file: File) => void
 *  - handoffStatus:   null | 'requested' | 'claimed'
 *  - onCreateTicket:  () => void   — opens TicketFromChatModal (shown when handoffStatus=claimed)
 */
function ChatWindow({
  isOpen,
  messages,
  onSend,
  onClose,
  onMinimize,
  onFeedback,
  isTyping = false,
  suggestions,
  onActionButton,
  chatMode = 'customer',
  onToggleMode,
  userRole = 'customer',
  onHandoff,
  onFileUpload,
  handoffStatus = null,
  onCreateTicket,
}) {
  const messagesEndRef   = useRef(null);
  const prevMessageCount = useRef(messages.length);
  const isTech           = TECH_ROLES.has(userRole);
  const isTechMode       = chatMode === 'tech';

  // ── Auto-scroll ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  // ── Sound + browser notification ────────────────────────────────────
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

  const showQuickReplies =
    (messages.length === 1 && messages[0]?.sender === 'bot' && !isTyping) ||
    (suggestions && !isTyping);

  // ── Theme ────────────────────────────────────────────────────────────
  const themePanel  = isTechMode ? 'bg-gray-950 border-emerald-800' : 'bg-gray-900 border-gray-700';
  const themeHeader = isTechMode ? 'bg-gray-900 border-emerald-800' : 'bg-gray-800 border-gray-700';

  return (
    <div
      className={`fixed z-50 flex flex-col border shadow-2xl
        transition-all duration-300 ease-in-out
        inset-0 sm:inset-auto sm:bottom-5 sm:right-5
        sm:w-[360px] sm:h-[500px] sm:rounded-xl
        ${themePanel}
        ${isOpen
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'}`}
      role="dialog"
      aria-label="BlueClue Assistant chat"
      aria-hidden={!isOpen}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between px-4 py-3 border-b sm:rounded-t-xl ${themeHeader}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isTechMode ? 'bg-emerald-400' : 'bg-green-500'}`} />
          <div className="min-w-0">
            <h3 className={`text-sm font-semibold truncate ${isTechMode ? 'text-emerald-400' : 'text-white'}`}>
              {isTechMode ? '👨‍💻 Tech Mode' : 'BlueClue Assistant'}
            </h3>
            {isTechMode && (
              <p className="text-[10px] text-emerald-600 leading-tight">Internal KB + commands active</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Mode toggle (tech roles only) */}
          {isTech && onToggleMode && (
            <button
              onClick={onToggleMode}
              className={`flex items-center gap-0.5 px-2 py-1 rounded text-[10px] font-semibold transition-colors
                ${isTechMode
                  ? 'bg-emerald-900 hover:bg-emerald-800 text-emerald-300'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
              title={isTechMode ? 'Switch to Customer Mode' : 'Switch to Tech Mode'}
            >
              {isTechMode ? '👤 Customer' : '👨‍💻 Tech'}
            </button>
          )}

          {/* Handoff button (customer mode) */}
          {!isTechMode && onHandoff && handoffStatus === null && (
            <button
              onClick={onHandoff}
              className="flex items-center gap-0.5 px-2 py-1 rounded text-[10px] font-medium bg-gray-700 hover:bg-blue-700 text-gray-300 hover:text-white transition-colors"
              title="Talk to a human technician"
            >
              🧑‍💼 Talk to Tech
            </button>
          )}
          {handoffStatus === 'requested' && (
            <span className="text-[10px] text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded font-medium">⏳ Connecting…</span>
          )}
          {handoffStatus === 'claimed' && (
            <>
              {onCreateTicket && (
                <button
                  onClick={onCreateTicket}
                  className="flex items-center gap-0.5 px-2 py-1 rounded text-[10px] font-medium bg-blue-900/50 hover:bg-blue-800 text-blue-300 hover:text-white transition-colors"
                  title="Create a ticket from this chat"
                >
                  🎫 Ticket
                </button>
              )}
              <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded font-medium">✅ Tech joined</span>
            </>
          )}

          {/* Minimize */}
          <button
            onClick={onMinimize || onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
            aria-label="Minimize chat" title="Minimize"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
            aria-label="Close chat" title="Close"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Messages ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className="animate-fade-in">
            <MessageBubble
              id={msg.id}
              sender={msg.sender}
              text={msg.text}
              timestamp={msg.timestamp}
              onFeedback={onFeedback}
              articleLinks={msg.articleLinks}
              actionButtons={msg.actionButtons}
              onActionButton={onActionButton}
              attachmentUrl={msg.attachmentUrl}
              attachmentType={msg.attachmentType}
              isTechMode={isTechMode}
            />
          </div>
        ))}

        {showQuickReplies && (
          <div className="animate-fade-in">
            <QuickReplyButtons options={suggestions} onSelect={onSend} disabled={isTyping} />
          </div>
        )}

        {isTyping && (
          <div className="flex items-start animate-fade-in">
            <div className={`px-3 py-2 rounded-lg rounded-bl-none text-sm flex items-center gap-1
              ${isTechMode ? 'bg-gray-800 text-emerald-400/60' : 'bg-gray-800 text-gray-400'}`}>
              <span className="w-1.5 h-1.5 rounded-full animate-bounce bg-current" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce bg-current" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce bg-current" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Tech command reference strip ─────────────────────────── */}
      {isTechMode && (
        <div className="px-3 py-1.5 border-t border-emerald-900/40 bg-gray-900/60">
          <p className="text-[10px] text-emerald-700 font-mono truncate">
            /search · /status · /assign · /close · /create-ticket · /my-tickets
          </p>
        </div>
      )}

      {/* ── Input ─────────────────────────────────────────────────── */}
      <ChatInput
        onSend={onSend}
        disabled={isTyping}
        autoFocus={isOpen}
        isTechMode={isTechMode}
        onFileUpload={onFileUpload}
      />
    </div>
  );
}

export default ChatWindow;
