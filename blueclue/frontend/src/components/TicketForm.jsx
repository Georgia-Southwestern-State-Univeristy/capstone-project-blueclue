import { useState, useRef, useEffect, useCallback } from 'react'
import LoadingSpinner from './LoadingSpinner'
import TemplateSelector from './TemplateSelector'
import { recordTemplateUsage } from '../services/templateService'
import { suggestArticles } from '../services/chatService'
import ArticleSuggestionCard from './ArticleSuggestionCard'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const SUGGESTION_WORD_THRESHOLD = 20
const SUGGESTION_DEBOUNCE_MS    = 1200

// Validation constants
const TITLE_MIN = 5
const TITLE_MAX = 255
const DESCRIPTION_MIN = 10
const DESCRIPTION_MAX = 2000

// Image attachment limits
const MAX_IMAGES = 5
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

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
  // Ref for hidden file input
  const fileInputRef = useRef(null)

  // Image attachments state
  const [images, setImages] = useState([])
  const [imageError, setImageError] = useState('')

  // Proactive article suggestion state
  const [suggestedArticles, setSuggestedArticles]  = useState([])
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false)
  const suggestionTimerRef = useRef(null)

  // Description display mode: 'edit' | 'preview'
  const [descriptionMode, setDescriptionMode] = useState('edit')

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
    setImages([])           // Clear image attachments
    setImageError('')
    setDescriptionMode('edit')
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

    // Switch to preview mode so the markdown renders immediately
    setDescriptionMode('preview')
    
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

  // Proactive article suggestion: debounced fetch after 20+ words in description
  useEffect(() => {
    clearTimeout(suggestionTimerRef.current)

    const wordCount = formData.description.trim().split(/\s+/).filter(Boolean).length
    if (wordCount < SUGGESTION_WORD_THRESHOLD || suggestionDismissed) {
      return
    }

    suggestionTimerRef.current = setTimeout(async () => {
      try {
        setIsFetchingSuggestions(true)
        const result = await suggestArticles(formData.description)
        if (result?.articles?.length > 0) {
          setSuggestedArticles(result.articles)
        }
      } catch {
        // Non-blocking: fail silently
      } finally {
        setIsFetchingSuggestions(false)
      }
    }, SUGGESTION_DEBOUNCE_MS)

    return () => clearTimeout(suggestionTimerRef.current)
  }, [formData.description, suggestionDismissed])

  // Convert File objects to base64 attachment objects
  const handleImageFiles = (files) => {
    setImageError('')
    const incoming = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (incoming.length === 0) return

    const oversized = incoming.filter(f => f.size > MAX_IMAGE_SIZE_BYTES)
    if (oversized.length > 0) {
      setImageError(`File too large (max 5 MB): ${oversized.map(f => f.name).join(', ')}`)
      return
    }

    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) {
      setImageError(`Maximum ${MAX_IMAGES} images allowed`)
      return
    }

    const toAdd = incoming.slice(0, remaining)
    toAdd.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setImages(prev => {
          if (prev.length >= MAX_IMAGES) return prev
          return [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            dataUrl: ev.target.result,
            name: file.name,
            size: file.size
          }]
        })
      }
      reader.readAsDataURL(file)
    })
  }

  // Handle paste event on the description textarea
  const handleDescriptionPaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'))
    if (imageItems.length === 0) return
    // Prevent pasting image data as garbled text
    e.preventDefault()
    const files = imageItems.map(item => item.getAsFile()).filter(Boolean)
    handleImageFiles(files)
  }

  // Handle file input change
  const handleFileChange = (e) => {
    handleImageFiles(e.target.files)
    // Reset input so same file can be re-added after removal
    e.target.value = ''
  }

  // Remove an image by id
  const handleRemoveImage = (id) => {
    setImages(prev => prev.filter(img => img.id !== id))
    setImageError('')
  }

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Reset suggestions when description changes significantly
    if (name === 'description') {
      setSuggestedArticles([])
      setSuggestionDismissed(false)
    }

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
        templateId: appliedTemplate?.id || null,
        attachments: images.map(img => ({ dataUrl: img.dataUrl, name: img.name, size: img.size }))
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
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-300"
          >
            Description <span className="text-red-400">*</span>
          </label>
          {formData.description.length > 0 && (
            <button
              type="button"
              onClick={() => setDescriptionMode(m => m === 'edit' ? 'preview' : 'edit')}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {descriptionMode === 'edit' ? 'Preview' : 'Edit'}
            </button>
          )}
        </div>

        {descriptionMode === 'preview' && formData.description ? (
          <div
            className={`
              w-full min-h-[9rem] px-4 py-3 border rounded-lg
              bg-gray-800 text-sm leading-relaxed break-words cursor-text
              ${touched.description && validationErrors.description
                ? 'border-red-500'
                : 'border-gray-600'
              }
            `}
            onClick={() => setDescriptionMode('edit')}
            title="Click to edit"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mt-3 mb-2 first:mt-0" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-lg font-semibold text-white mt-3 mb-1 first:mt-0" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-base font-semibold text-gray-200 mt-2 mb-1 first:mt-0" {...props} />,
                p:  ({node, ...props}) => <p  className="text-gray-300 mb-2 last:mb-0" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc list-inside text-gray-300 mb-2 space-y-0.5 pl-2" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal list-inside text-gray-300 mb-2 space-y-0.5 pl-2" {...props} />,
                li: ({node, ...props}) => <li className="text-gray-300" {...props} />,
                strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                em: ({node, ...props}) => <em className="italic text-gray-400" {...props} />,
                code: ({node, className, children, ...props}) => {
                  const isBlock = className?.startsWith('language-')
                  return isBlock
                    ? <code className="block text-blue-300 font-mono text-xs overflow-x-auto" {...props}>{children}</code>
                    : <code className="bg-gray-700 text-blue-300 rounded px-1 py-0.5 font-mono text-xs" {...props}>{children}</code>
                },
                pre: ({node, ...props}) => <pre className="bg-gray-700 rounded-lg p-3 overflow-x-auto mb-2 text-blue-300 font-mono text-xs" {...props} />,
                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-600 pl-4 italic text-gray-400 my-2" {...props} />,
                hr: ({node, ...props}) => <hr className="border-gray-600 my-3" {...props} />,
                a: ({node, ...props}) => <a className="text-blue-400 underline hover:text-blue-300" target="_blank" rel="noopener noreferrer" {...props} />,
              }}
            >
              {formData.description}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            onBlur={handleBlur}
            onPaste={handleDescriptionPaste}
            rows={6}
            placeholder="Describe your issue in detail... (you can also paste a screenshot here)"
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
        )}
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

      {/* Image Attachments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-300">
            Attachments
            <span className="ml-2 text-xs text-gray-500">(optional · up to {MAX_IMAGES} images · max 5 MB each)</span>
          </label>
          <button
            type="button"
            disabled={isLoading || images.length >= MAX_IMAGES}
            onClick={() => fileInputRef.current?.click()}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border
              border-gray-600 text-gray-300 bg-gray-800 hover:bg-gray-700
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors
            "
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Attach Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {imageError && (
          <div role="alert" className="text-red-400 text-xs mb-2">{imageError}</div>
        )}

        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {images.map(img => (
              <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-600 bg-gray-800">
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="w-full h-28 object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gray-900/80 px-2 py-1 truncate text-xs text-gray-300">
                  {img.name}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(img.id)}
                  aria-label={`Remove ${img.name}`}
                  className="
                    absolute top-1 right-1 rounded-full w-6 h-6
                    bg-gray-900/70 hover:bg-red-700 text-white
                    flex items-center justify-center opacity-0 group-hover:opacity-100
                    transition-opacity text-sm leading-none
                  "
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {images.length === 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Tip: you can also paste a screenshot directly into the description box (Ctrl+V / ⌘+V)
          </p>
        )}
      </div>
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

      {/* Proactive article suggestions */}
      {suggestedArticles.length > 0 && !suggestionDismissed && (
        <ArticleSuggestionCard
          articles={suggestedArticles}
          description={formData.description}
          onDismiss={() => setSuggestionDismissed(true)}
          onCancel={() => {
            setSuggestionDismissed(true)
            resetForm()
          }}
        />
      )}

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
