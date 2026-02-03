import { useState } from 'react'

function TicketForm() {
  // Form data state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium'
  })

  // Loading state
  const [isLoading, setIsLoading] = useState(false)

  // Error state
  const [error, setError] = useState(null)

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // TODO: API call will be implemented in a later part
      console.log('Form submitted:', formData)
    } catch (err) {
      setError(err.message || 'An error occurred while submitting the ticket')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Error display */}
      {error && (
        <div role="alert">
          {error}
        </div>
      )}

      {/* Title field */}
      <div>
        <label htmlFor="title">Title</label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
          placeholder="Enter a brief title for your issue"
          disabled={isLoading}
          aria-required="true"
        />
      </div>

      {/* Description field */}
      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          required
          rows={6}
          placeholder="Describe your issue in detail..."
          disabled={isLoading}
          aria-required="true"
        />
      </div>

      {/* Priority field */}
      <div>
        <label htmlFor="priority">Priority</label>
        <select
          id="priority"
          name="priority"
          value={formData.priority}
          onChange={handleChange}
          disabled={isLoading}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {/* Submit button */}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Submitting...' : 'Submit Ticket'}
      </button>
    </form>
  )
}

export default TicketForm
