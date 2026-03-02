import { useState, useRef, useEffect } from 'react';

/**
 * ChatInput — Text input bar with send button for the chat panel.
 *
 * Manages its own input value and fires `onSend(text)` with the trimmed
 * message. Supports Enter-to-send (Shift+Enter for future multi-line).
 *
 * Props:
 *  - onSend: (text: string) => void — called with the trimmed message
 *  - disabled: boolean              — disables input + button (e.g. while bot is typing)
 *  - autoFocus: boolean             — focus the input on mount / when toggled true
 */
function ChatInput({ onSend, disabled = false, autoFocus = false }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  // Auto-focus when requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-700 px-3 py-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          disabled={disabled}
          className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
          aria-label="Chat message input"
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
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
  );
}

export default ChatInput;
