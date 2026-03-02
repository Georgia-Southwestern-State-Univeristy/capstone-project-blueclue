import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * ChatInput — Auto-resizing textarea with send button for the chat panel.
 *
 * Enter sends the message. Shift+Enter inserts a newline.
 * Max character limit: 500 (per Issue #116 spec).
 *
 * Props:
 *  - onSend: (text: string) => void — called with the trimmed message
 *  - disabled: boolean              — disables input + button (e.g. while bot is typing)
 *  - autoFocus: boolean             — focus the textarea on mount / when toggled true
 */
function ChatInput({ onSend, disabled = false, autoFocus = false }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  const MAX_LENGTH = 500;

  // Auto-focus when requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea to fit content (1–4 rows)
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`; // max ~4 rows
  }, []);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-700 px-3 py-2">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          disabled={disabled}
          rows={1}
          maxLength={MAX_LENGTH}
          className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors resize-none overflow-y-auto"
          aria-label="Chat message input"
          style={{ maxHeight: '96px' }}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors"
          aria-label="Send message"
          title="Send"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
          </svg>
        </button>
      </div>
      {value.length > MAX_LENGTH * 0.9 && (
        <div className="text-[10px] text-gray-500 mt-1 text-right">
          {value.length}/{MAX_LENGTH}
        </div>
      )}
    </div>
  );
}

export default ChatInput;
