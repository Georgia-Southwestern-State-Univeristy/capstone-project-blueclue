import { useState } from 'react'

// Validation constants
const TITLE_MIN = 5
const TITLE_MAX = 255
const DESCRIPTION_MIN = 10
const DESCRIPTION_MAX = 2000

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

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState({
    title: '',
    description: ''
  })

  // Track which fields have been touched (for showing errors only after interaction)
  const [touched, setTouched] = useState({
    title: false,
    description: false
  })

  // Validate a single field
  const validateField = (name, value) => {
    switch (name) {
      case 'title':
        if (value.length === 0) {
          return 'Title is required'
        }
        if (value.length < TITLE_MIN) {
          return `Title must be at least ${TITLE_MIN} characters`
        }
        if (value.length > TITLE_MAX) {
          return `Title must be less than ${TITLE_MAX} characters`
        }
        return ''
      case 'description':
        if (value.length === 0) {
          return 'Description is required'
        }
        if (value.length < DESCRIPTION_MIN) {
          return `Description must be at least ${DESCRIPTION_MIN} characters`
        }
        if (value.length > DESCRIPTION_MAX) {
          return `Description must be less than ${DESCRIPTION_MAX} characters`
        }
        return ''
      default:
        return ''
    }
  }

  // Validate entire form
  const validateForm = () => {
    const errors = {
      title: validateField('title', formData.title),
      description: validateField('description', formData.description)
    }
    setValidationErrors(errors)
    return !errors.title && !errors.description
  }

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Validate on change if field has been touched
    if (touched[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: validateField(name, value)
      }))
    }
  }

  // Handle field blur (mark as touched and validate)
  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched(prev => ({
      ...prev,
      [name]: true
    }))
    setValidationErrors(prev => ({
      ...prev,
      [name]: validateField(name, value)
    }))
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Mark all fields as touched to show any validation errors
    setTouched({
      title: true,
      description: true
    })

    // Validate form before submission
    if (!validateForm()) {
      return // Don't submit if validation fails
    }

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
          onBlur={handleBlur}
          placeholder="Enter a brief title for your issue"
          disabled={isLoading}
          aria-required="true"
          aria-invalid={touched.title && !!validationErrors.title}
          aria-describedby="title-error title-counter"
          maxLength={TITLE_MAX}
        />
        <div>
          {/* Character counter */}
          <span id="title-counter">
            {formData.title.length}/{TITLE_MAX}
          </span>
        </div>
        {/* Inline error message */}
        {touched.title && validationErrors.title && (
          <div id="title-error" role="alert">
            {validationErrors.title}
          </div>
        )}
      </div>

      {/* Description field */}
      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={6}
          placeholder="Describe your issue in detail..."
          disabled={isLoading}
          aria-required="true"
          aria-invalid={touched.description && !!validationErrors.description}
          aria-describedby="description-error description-counter"
          maxLength={DESCRIPTION_MAX}
        />
        <div>
          {/* Character counter */}
          <span id="description-counter">
            {formData.description.length}/{DESCRIPTION_MAX}
          </span>
        </div>
        {/* Inline error message */}
        {touched.description && validationErrors.description && (
          <div id="description-error" role="alert">
            {validationErrors.description}
          </div>
        )}
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
