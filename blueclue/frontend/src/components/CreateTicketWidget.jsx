import BaseWidget from './BaseWidget'
import TicketForm from './TicketForm'

/**
 * CreateTicketWidget — inline ticket creation form as a dashboard widget.
 * Wraps TicketForm inside a BaseWidget card so clients can submit tickets
 * directly from the dashboard without opening a modal.
 */
const FORM_ID = 'create-ticket-form'

export default function CreateTicketWidget({ onSubmit }) {
  const submitButton = (
    <button
      type="submit"
      form={FORM_ID}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      Submit Ticket
    </button>
  )

  return (
    <BaseWidget
      title="Create a Ticket"
      subtitle="Enter your ticket information below"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      }
      noPadding={false}
      className="ring-1 ring-blue-700/50"
      headerExtra={submitButton}
    >
      <TicketForm onSubmit={onSubmit} formId={FORM_ID} />
    </BaseWidget>
  )
}
