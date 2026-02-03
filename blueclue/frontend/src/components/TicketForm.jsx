import { useState } from 'react'
import LoadingSpinner from './LoadingSpinner'

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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error display */}
      {error && (
        <div 
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg"
        >
          {error}
        </div>
      )}

      {/* Title field */}
      <div>
        <label 
          htmlFor="title"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Title <span className="text-red-500">*</span>
        </label>
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
          className={`
            w-full px-4 py-2 border rounded-lg shadow-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            transition-colors duration-200
            ${touched.title && validationErrors.title 
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-300'
            }
          `}
        />
        <div className="flex justify-end mt-1">
          {/* Character counter */}
          <span 
            id="title-counter"
            className={`text-xs ${
              formData.title.length > TITLE_MAX * 0.9 
                ? 'text-orange-500' 
                : 'text-gray-500'
            }`}
          >
            {formData.title.length}/{TITLE_MAX}
          </span>
        </div>
        {/* Inline error message */}
        {touched.title && validationErrors.title && (
          <div id="title-error" role="alert" className="text-red-500 text-sm mt-1">
            {validationErrors.title}
          </div>
        )}
      </div>

      {/* Description field */}
      <div>
        <label 
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description <span className="text-red-500">*</span>
        </label>
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
          className={`
            w-full px-4 py-2 border rounded-lg shadow-sm resize-y
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            transition-colors duration-200
            ${touched.description && validationErrors.description 
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-300'
            }
          `}
        />
        <div className="flex justify-end mt-1">
          {/* Character counter */}
          <span 
            id="description-counter"
            className={`text-xs ${
              formData.description.length > DESCRIPTION_MAX * 0.9 
                ? 'text-orange-500' 
                : 'text-gray-500'
            }`}
          >
            {formData.description.length}/{DESCRIPTION_MAX}
          </span>
        </div>
        {/* Inline error message */}
        {touched.description && validationErrors.description && (
          <div id="description-error" role="alert" className="text-red-500 text-sm mt-1">
            {validationErrors.description}
          </div>
        )}
      </div>

      {/* Priority field */}
      <div>
        <label 
          htmlFor="priority"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Priority
        </label>
        <select
          id="priority"
          name="priority"
          value={formData.priority}
          onChange={handleChange}
          disabled={isLoading}
          className="
            w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            transition-colors duration-200
            bg-white
          "
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {/* Submit button */}
      <button 
        type="submit" 
        disabled={isLoading}
        className="
          w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md
          hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          disabled:bg-blue-400 disabled:cursor-not-allowed
          transition-colors duration-200
          flex items-center justify-center gap-2
        "
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" />
            <span>Submitting...</span>
          </>
        ) : (
          'Submit Ticket'
        )}
      </button>
    </form>
  )
}

export default TicketForm
