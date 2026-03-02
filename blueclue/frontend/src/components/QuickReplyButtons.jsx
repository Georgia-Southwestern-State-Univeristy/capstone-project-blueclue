// QuickReplyButtons – predefined quick-action chips shown before the user
// sends their first message.

const DEFAULT_OPTIONS = [
  'Create a ticket',
  'Check ticket status',
  'Technical support',
  'FAQs',
]

export default function QuickReplyButtons({ options = DEFAULT_OPTIONS, onSelect, disabled = false }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3">
      {options.map((label) => (
        <button
          key={label}
          onClick={() => onSelect(label)}
          disabled={disabled}
          className="text-xs px-3 py-1.5 rounded-full border border-blue-500/40 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {label}
        </button>
      ))}
    </div>
  )
}
