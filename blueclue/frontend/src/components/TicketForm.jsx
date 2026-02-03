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
        <div>
          {error}
        </div>
      )}

      {/* Title field placeholder */}
      <div>
        <label htmlFor="title">Title</label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
        />
      </div>

      {/* Description field placeholder */}
      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
        />
      </div>

      {/* Priority field placeholder */}
      <div>
        <label htmlFor="priority">Priority</label>
        <select
          id="priority"
          name="priority"
          value={formData.priority}
          onChange={handleChange}
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
