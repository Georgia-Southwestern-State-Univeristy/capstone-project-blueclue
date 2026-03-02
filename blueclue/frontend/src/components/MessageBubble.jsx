import FeedbackButtons from './FeedbackButtons';

/**
 * MessageBubble — Renders a single chat message with alignment,
 * styling, and timestamp based on the sender.
 *
 * Props:
 *  - id: number | string      — unique message id (passed to FeedbackButtons)
 *  - sender: 'user' | 'bot'   — determines bubble colour & alignment
 *  - text: string              — message content
 *  - timestamp: Date | string  — when the message was sent
 *  - onFeedback: (messageId, rating) => void — optional feedback handler
 */
function MessageBubble({ id, sender, text, timestamp, onFeedback }) {
  const isUser = sender === 'user';

  const formatTimestamp = (date) =>
    new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Bubble */}
      <div
        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none'
            : 'bg-gray-800 text-gray-200 rounded-bl-none'
        }`}
      >
        {text}
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-gray-500 mt-1 px-1">
        {formatTimestamp(timestamp)}
      </span>

      {/* Feedback — bot messages only */}
      {!isUser && (
        <FeedbackButtons messageId={id} onFeedback={onFeedback} />
      )}
    </div>
  );
}

export default MessageBubble;
