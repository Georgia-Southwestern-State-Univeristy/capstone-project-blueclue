// MessageBubble – renders a single chat message (user or bot)
// If the message is from the bot, an optional FeedbackButtons row is shown.

import FeedbackButtons from './FeedbackButtons'

export default function MessageBubble({ id, sender, text, timestamp, onFeedback }) {
  const isBot = sender === 'bot'

  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} animate-fade-in`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isBot
            ? 'bg-gray-700 text-gray-100 rounded-bl-none'
            : 'bg-blue-600 text-white rounded-br-none'
        }`}
      >
        {text}

        {/* Timestamp */}
        {timestamp && (
          <div className={`text-[10px] mt-1 ${isBot ? 'text-gray-400' : 'text-blue-200'}`}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

        {/* Feedback for bot messages */}
        {isBot && onFeedback && id !== 'welcome' && (
          <FeedbackButtons messageId={id} onFeedback={onFeedback} />
        )}
      </div>
    </div>
  )
}
