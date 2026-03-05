/**
 * QuickReplyButtons — Predefined quick-action chips displayed in the chat.
 *
 * Shown after the bot's welcome message (or any message that offers quick
 * actions) so the user can tap a common intent instead of typing.
 *
 * Props:
 *  - options: Array<{ label: string, value: string }> — buttons to display
 *  - onSelect: (value: string) => void — called with the selected option's value
 *  - disabled: boolean — disables all buttons (e.g. while bot is typing)
 */

const DEFAULT_OPTIONS = [
  { label: 'Help Making a Ticket', value: 'I want to create a new ticket' },
  { label: 'Check ticket status', value: 'I want to check my ticket status' },
  { label: 'Technical support', value: 'I need technical support' },
  { label: 'FAQs', value: 'Show me frequently asked questions' },
];

function QuickReplyButtons({
  options = DEFAULT_OPTIONS,
  onSelect,
  disabled = false,
}) {
  return (
    <div className="flex flex-wrap gap-2 px-1 py-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          disabled={disabled}
          className="text-xs px-3 py-1.5 rounded-full border border-blue-500/40 text-blue-400 
            hover:bg-blue-600/20 hover:text-blue-300 hover:border-blue-400
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors whitespace-nowrap"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default QuickReplyButtons;
