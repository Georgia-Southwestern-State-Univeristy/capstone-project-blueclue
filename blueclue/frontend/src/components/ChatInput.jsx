import { useState, useRef, useEffect, useCallback } from 'react';

const SLASH_COMMANDS = [
  { cmd: '/search',        hint: '/search <keywords>       — Search knowledge base' },
  { cmd: '/status',        hint: '/status <ticket-id>      — Check ticket status' },
  { cmd: '/assign',        hint: '/assign <id> <tech-name> — Assign ticket' },
  { cmd: '/close',         hint: '/close <id> [note]       — Close ticket' },
  { cmd: '/create-ticket', hint: '/create-ticket <desc>    — Create new ticket' },
  { cmd: '/my-tickets',    hint: '/my-tickets              — List your open tickets' },
];

/**
 * ChatInput — Auto-resizing textarea with send button, file upload, and
 *             slash-command autocomplete (tech mode only).
 *
 * Props:
 *  - onSend:       (text: string) => void
 *  - disabled:     boolean
 *  - autoFocus:    boolean
 *  - isTechMode:   boolean  — shows slash command suggestions
 *  - onFileUpload: (file: File) => void | undefined
 */
function ChatInput({ onSend, disabled = false, autoFocus = false, isTechMode = false, onFileUpload }) {
  const [value, setValue]             = useState('');
  const [showCmdMenu, setShowCmdMenu] = useState(false);
  const [filteredCmds, setFilteredCmds] = useState([]);
  const [cmdMenuIdx, setCmdMenuIdx]   = useState(0);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const MAX_LENGTH = 500;

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  useEffect(() => { autoResize(); }, [value, autoResize]);

  // Slash command filtering
  useEffect(() => {
    if (isTechMode && value.startsWith('/')) {
      const query = value.toLowerCase();
      const matched = SLASH_COMMANDS.filter(c => c.cmd.startsWith(query));
      setFilteredCmds(matched);
      setShowCmdMenu(matched.length > 0 && value.length < 30);
      setCmdMenuIdx(0);
    } else {
      setShowCmdMenu(false);
      setFilteredCmds([]);
    }
  }, [value, isTechMode]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    setShowCmdMenu(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const selectCommand = (cmd) => {
    setValue(cmd + ' ');
    setShowCmdMenu(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (showCmdMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCmdMenuIdx(i => Math.min(i + 1, filteredCmds.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCmdMenuIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        if (filteredCmds[cmdMenuIdx]) selectCommand(filteredCmds[cmdMenuIdx].cmd);
        return;
      }
      if (e.key === 'Escape') {
        setShowCmdMenu(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) onFileUpload(file);
    e.target.value = '';
  };

  return (
    <div className="border-t border-gray-700 px-3 py-2 relative">
      {/* Slash command autocomplete menu */}
      {showCmdMenu && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-gray-800 border border-emerald-800 rounded-lg shadow-lg overflow-hidden z-10">
          {filteredCmds.map((c, i) => (
            <button
              key={c.cmd}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectCommand(c.cmd); }}
              className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors
                ${i === cmdMenuIdx
                  ? 'bg-emerald-900/50 text-emerald-300'
                  : 'text-gray-300 hover:bg-gray-700'}`}
            >
              {c.hint}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File upload button */}
        {onFileUpload && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-400 hover:text-gray-200 transition-colors"
              title="Attach image or file"
              aria-label="Attach file"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,text/plain,text/csv"
              className="hidden"
              onChange={handleFileChange}
              aria-label="File attachment input"
            />
          </>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder={isTechMode ? 'Message or /command…' : 'Type a message…'}
          disabled={disabled}
          rows={1}
          maxLength={MAX_LENGTH}
          className={`flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 border
            focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors resize-none overflow-y-auto
            ${isTechMode ? 'border-emerald-900 focus:border-emerald-500' : 'border-gray-700'}`}
          aria-label="Chat message input"
          style={{ maxHeight: '96px' }}
        />

        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-white transition-colors
            disabled:bg-gray-700 disabled:text-gray-500
            ${isTechMode ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-blue-600 hover:bg-blue-500'}`}
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
