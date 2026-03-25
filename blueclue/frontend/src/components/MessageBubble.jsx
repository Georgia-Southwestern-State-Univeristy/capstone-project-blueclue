import { Link } from 'react-router-dom';
import FeedbackButtons from './FeedbackButtons';
import { formatTime as _fmtTime } from '../utils/dateFormatter';

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
 *  - articleLinks: Array<{id, title, slug, category, excerpt}> — optional KB articles
 *  - actionButtons: Array<{id, label, primary}> — optional action buttons
 *  - onActionButton: (buttonId) => void — called when an action button is clicked
 */
function MessageBubble({ id, sender, text, timestamp, onFeedback, articleLinks, actionButtons, onActionButton }) {
  const isUser = sender === 'user';

  const formatTimestamp = (date) =>
    _fmtTime(date, { hour: '2-digit', minute: '2-digit' });

  const hasArticles = !isUser && articleLinks && articleLinks.length > 0;
  const hasActions  = !isUser && actionButtons && actionButtons.length > 0;

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Bubble */}
      <div
        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none'
            : 'bg-gray-800 text-gray-200 rounded-bl-none'
        }`}
      >
        {text}
      </div>

      {/* Article links (bot only) */}
      {hasArticles && (
        <div className="mt-2 max-w-[80%] space-y-1.5">
          {articleLinks.map((article) => (
            <Link
              key={article.id}
              to={`/faq/article/${article.id}`}
              className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-900/30 border border-blue-700/40
                         hover:bg-blue-800/40 hover:border-blue-500/60 transition-colors group"
            >
              <span className="mt-0.5 text-blue-400 shrink-0"></span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-300 group-hover:text-blue-200 truncate">
                  {article.title}
                </p>
                {article.excerpt && (
                  <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">
                    {article.excerpt}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Action buttons (bot only) */}
      {hasActions && (
        <div className="mt-2 max-w-[80%] flex flex-wrap gap-2">
          {actionButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => onActionButton && onActionButton(btn.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                btn.primary
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

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

