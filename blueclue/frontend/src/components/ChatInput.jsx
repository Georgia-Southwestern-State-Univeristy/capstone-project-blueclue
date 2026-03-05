import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

const SLASH_COMMANDS = [
  { cmd: '/search',        hint: '/search <keywords>       — Search knowledge base' },
  { cmd: '/tickets',       hint: '/tickets <keywords>      — Search past ticket solutions' },
  { cmd: '/status',        hint: '/status <ticket-id>      — Check ticket status' },
  { cmd: '/assign',        hint: '/assign <id> <tech-name> — Assign ticket' },
  { cmd: '/close',         hint: '/close <id> [note]       — Close ticket' },
  { cmd: '/create-ticket', hint: '/create-ticket <desc>    — Create new ticket' },
  { cmd: '/my-tickets',    hint: '/my-tickets              — List your open tickets' },
];

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/csv'];

/**
 * ChatInput — Auto-resizing textarea with send, file upload, drag-and-drop +
 *             image preview, and slash-command autocomplete (tech mode only).
 *
 * Props:
 *  - onSend:       (text: string) => void
 *  - disabled:     boolean
 *  - autoFocus:    boolean
 *  - isTechMode:   boolean  — shows slash command suggestions
 *  - onFileUpload: (file: File) => void | undefined
 */
function ChatInput({ onSend, disabled = false, autoFocus = false, isTechMode = false, onFileUpload }) {
  const [value, setValue]               = useState('');
  const [cmdMenuIdx, setCmdMenuIdx]     = useState(0);
  const [pendingFile, setPendingFile]   = useState(null);   // { file, previewUrl }
  const [isDragOver, setIsDragOver]     = useState(false);
  const textareaRef  = useRef(null);
  const fileInputRef = useRef(null);
  const dragCountRef = useRef(0); // track nested dragenter/dragleave
  const [cmdMenuDismissed, setCmdMenuDismissed] = useState(false);

  const MAX_LENGTH = 500;

  useEffect(() => {
    if (autoFocus && textareaRef.current) textareaRef.current.focus();
  }, [autoFocus]);

  // Cleanup object URL when file changes
  useEffect(() => {
    return () => {
      if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    };
  }, [pendingFile]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  useEffect(() => { autoResize(); }, [value, autoResize]);

  // Slash command filtering — fully derived, no effects needed
  const filteredCmds = useMemo(() => {
    if (!isTechMode || !value.startsWith('/')) return [];
    const query = value.toLowerCase();
    return SLASH_COMMANDS.filter(c => c.cmd.startsWith(query));
  }, [value, isTechMode]);

  const showCmdMenu = filteredCmds.length > 0 && value.length < 30 && !cmdMenuDismissed;
  const safeMenuIdx = Math.min(cmdMenuIdx, Math.max(filteredCmds.length - 1, 0));

  const attachFile = useCallback((file) => {
    if (!file || !onFileUpload) return;
    if (!ALLOWED_TYPES.includes(file.type)) return;
    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : null;
    setPendingFile({ file, previewUrl, isImage });
    textareaRef.current?.focus();
  }, [onFileUpload]);

  const removePendingFile = useCallback(() => {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  }, [pendingFile]);

  const handleSend = () => {
    const trimmed = value.trim();
    if ((!trimmed && !pendingFile) || disabled) return;
    setCmdMenuDismissed(false);
    if (pendingFile) {
      onFileUpload(pendingFile.file);
      removePendingFile();
    }
    if (trimmed) {
      onSend(trimmed);
      setValue('');
      setCmdMenuDismissed(false);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const selectCommand = (cmd) => {
    setValue(cmd + ' ');
    setCmdMenuDismissed(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (showCmdMenu) {
      if (e.key === 'ArrowDown')  { e.preventDefault(); setCmdMenuIdx(i => Math.min(i + 1, filteredCmds.length - 1)); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setCmdMenuIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        if (filteredCmds[safeMenuIdx]) selectCommand(filteredCmds[safeMenuIdx].cmd);
        return;
      }
      if (e.key === 'Escape') { setCmdMenuDismissed(true); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) attachFile(file);
    e.target.value = '';
  };

  // ── Drag and drop ────────────────────────────────────────────────────────
  const handleDragEnter = (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCountRef.current++;
    if (!isDragOver) setIsDragOver(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current <= 0) { dragCountRef.current = 0; setIsDragOver(false); }
  };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCountRef.current = 0;
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) attachFile(file);
  };

  return (
    <div
      className={`border-t px-3 py-2 relative transition-colors
        ${isDragOver ? 'border-blue-500 bg-blue-950/30' : 'border-gray-700'}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay indicator */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-950/60 rounded z-20 pointer-events-none">
          <span className="text-blue-300 text-sm font-medium">Drop to attach</span>
        </div>
      )}

      {/* Slash command autocomplete menu */}
      {showCmdMenu && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-gray-800 border border-emerald-800 rounded-lg shadow-lg overflow-hidden z-10">
          {filteredCmds.map((c, i) => (
            <button
              key={c.cmd}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectCommand(c.cmd); }}
              className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors
                ${i === safeMenuIdx
                  ? 'bg-emerald-900/50 text-emerald-300'
                  : 'text-gray-300 hover:bg-gray-700'}`}
            >
              {c.hint}
            </button>
          ))}
        </div>
      )}

      {/* Pending file preview */}
      {pendingFile && (
        <div className="mb-2 flex items-start gap-2 bg-gray-800 rounded-lg p-2 border border-gray-600">
          {pendingFile.isImage && pendingFile.previewUrl ? (
            <img
              src={pendingFile.previewUrl}
              alt="attachment preview"
              className="h-16 w-16 object-cover rounded flex-shrink-0 border border-gray-600"
            />
          ) : (
            <div className="h-10 w-10 flex items-center justify-center bg-gray-700 rounded flex-shrink-0">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-300 truncate">{pendingFile.file.name}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {(pendingFile.file.size / 1024).toFixed(0)} KB · {pendingFile.file.type}
            </p>
          </div>
          <button
            type="button"
            onClick={removePendingFile}
            className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
            title="Remove attachment"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
              title="Attach image or file (or drag &amp; drop)"
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
          onChange={(e) => { setCmdMenuDismissed(false); setValue(e.target.value.slice(0, MAX_LENGTH)); }}
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
          disabled={(!value.trim() && !pendingFile) || disabled}
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
