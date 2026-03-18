import BaseWidget from './BaseWidget'
import TicketForm from './TicketForm'

/**
 * CreateTicketWidget — inline ticket creation form as a dashboard widget.
 * Wraps TicketForm inside a BaseWidget card so clients can submit tickets
 * directly from the dashboard without opening a modal.
 */
export default function CreateTicketWidget({ onSubmit }) {
  return (
    <BaseWidget
      title="Create a Ticket"
      icon="✏️"
      noPadding={false}
    >
      <TicketForm onSubmit={onSubmit} />
    </BaseWidget>
  )
}
