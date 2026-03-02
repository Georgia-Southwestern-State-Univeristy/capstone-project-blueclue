// ChatWidgetButton – floating toggle button in the Navbar
// Shows an unread badge + "new message" pulse when the chat is closed.

export default function ChatWidgetButton({ onClick, unreadCount = 0, hasNewMessage = false }) {
  return (
    <button
      onClick={onClick}
      className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
      aria-label="Toggle chat"
      title="Chat with BlueClue"
    >
      {/* Chat bubble icon */}
      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}

      {/* New-message pulse ring */}
      {hasNewMessage && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 animate-ping pointer-events-none" />
      )}
    </button>
  )
}
