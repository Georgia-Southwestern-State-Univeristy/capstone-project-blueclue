import { useState, useRef } from 'react'
import LoadingSpinner from './LoadingSpinner'
import TemplateSelector from './TemplateSelector'
import { recordTemplateUsage } from '../services/templateService'

// Validation constants
const TITLE_MIN = 5
const TITLE_MAX = 255
const DESCRIPTION_MIN = 10
const DESCRIPTION_MAX = 2000

function TicketForm({ onSubmit }) {
  // Form data state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: '' // Empty allows AI to classify
  })
  
  // Template tracking state
  const [appliedTemplate, setAppliedTemplate] = useState(null)

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

  // Ref for title input (to focus after reset)
  const titleRef = useRef(null)

  // Reset form to initial state
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: '' // Empty allows AI to classify
    })
    setValidationErrors({
      title: '',
      description: ''
    })
    setTouched({
      title: false,
      description: false
    })
    setError(null)
    setAppliedTemplate(null) // Clear template tracking
    // Focus the title field
    titleRef.current?.focus()
  }
  
  // Handle template selection
  const handleTemplateSelect = (templateData) => {
    // Update form fields with template data
    setFormData(prev => ({
      ...prev,
      title: templateData.subject || prev.title,
      description: templateData.description || prev.description,
      priority: templateData.priority || prev.priority
    }))
    
    // Track which template was applied
    setAppliedTemplate({
      id: templateData.templateId,
      name: templateData.templateName,
      version: templateData.templateVersion,
      instructions: templateData.instructions
    })
    
    // Mark fields as touched so validation runs
    setTouched({
      title: true,
      description: true
    })
    
    // Validate form after template is applied
    setTimeout(() => {
      setValidationErrors({
        title: validateField('title', templateData.subject || ''),
        description: validateField('description', templateData.description || '')
      })
    }, 0)
  }
  
  // Clear applied template
  const clearTemplate = () => {
    setAppliedTemplate(null)
    // Optionally clear the form too
    resetForm()
  }

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
      // Prepare submission data, including template info if applicable
      const submissionData = {
        ...formData,
        templateId: appliedTemplate?.id || null
      }
      
      // Call the onSubmit callback if provided
      if (onSubmit) {
        const result = await onSubmit(submissionData)
        
        // Record template usage if a template was applied
        if (appliedTemplate?.id && result?.ticket?.id) {
          try {
            await recordTemplateUsage(appliedTemplate.id, result.ticket.id)
          } catch (usageErr) {
            // Don't fail the submission if usage recording fails
            console.warn('Failed to record template usage:', usageErr)
          }
        }
      }
      
      // Reset form after successful submission
      resetForm()
    } catch (err) {
      // Only set local error if no onSubmit handler (parent handles the error display)
      if (!onSubmit) {
        setError(err.message || 'An error occurred while submitting the ticket')
      }
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
          className="bg-red-950 border border-red-700 text-red-300 px-4 py-3 rounded-lg"
        >
          {error}
        </div>
      )}
      
      {/* Template Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Quick Start
        </label>
        <TemplateSelector
          onTemplateSelect={handleTemplateSelect}
          disabled={isLoading}
        />
        {appliedTemplate && (
          <div className="mt-2 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-blue-300">
                  Template applied: <span className="font-medium">{appliedTemplate.name}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={clearTemplate}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Clear
              </button>
            </div>
            {appliedTemplate.instructions && (
              <p className="mt-2 text-xs text-gray-400 border-t border-blue-800 pt-2">
                <span className="font-medium text-gray-300">Instructions:</span> {appliedTemplate.instructions}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Title field */}
      <div>
        <label 
          htmlFor="title"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          Title <span className="text-red-400">*</span>
        </label>
        <input
          ref={titleRef}
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
            bg-gray-800 text-white placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500
            transition-colors duration-200
            ${touched.title && validationErrors.title 
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-600'
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
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          Description <span className="text-red-400">*</span>
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
            bg-gray-800 text-white placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500
            transition-colors duration-200
            ${touched.description && validationErrors.description 
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-600'
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
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          Priority <span className="text-gray-500 text-xs">(optional - AI will suggest if not selected)</span>
        </label>
        <select
          id="priority"
          name="priority"
          value={formData.priority}
          onChange={handleChange}
          disabled={isLoading}
          className="
            w-full px-4 py-2 border border-gray-600 rounded-lg shadow-sm
            bg-gray-800 text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500
            transition-colors duration-200
          "
        >
          <option value="">Let AI determine priority</option>
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
