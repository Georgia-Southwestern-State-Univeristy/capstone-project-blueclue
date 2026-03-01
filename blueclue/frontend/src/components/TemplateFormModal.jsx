import { useState, useEffect, useRef } from 'react'
import LoadingSpinner from './LoadingSpinner'
import {
    createTemplate,
    updateTemplate,
    TEMPLATE_CATEGORIES,
    PRIORITY_OPTIONS,
    TICKET_CATEGORIES
} from '../services/templateService'

function TemplateFormModal({ isOpen, onClose, onSuccess, template, editMode }) {
    const modalRef = useRef(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [activeTab, setActiveTab] = useState('basic')
    
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        template_category: 'general',
        category: 'general',
        description: '',
        instructions: '',
        default_priority: 'medium',
        pre_filled_subject: '',
        pre_filled_description: '',
        common_tags: [],
        field_requirements: {},
        custom_placeholders: [],
        is_active: true,
        sort_order: 0
    })
    
    // Tag input state
    const [tagInput, setTagInput] = useState('')
    
    // Placeholder input state
    const [placeholderName, setPlaceholderName] = useState('')
    const [placeholderDescription, setPlaceholderDescription] = useState('')
    
    // Reset form when modal opens/closes or template changes
    useEffect(() => {
        if (isOpen) {
            if (editMode && template) {
                setFormData({
                    name: template.name || '',
                    template_category: template.template_category || 'general',
                    category: template.category || 'general',
                    description: template.description || '',
                    instructions: template.instructions || '',
                    default_priority: template.default_priority || 'medium',
                    pre_filled_subject: template.pre_filled_subject || '',
                    pre_filled_description: template.pre_filled_description || '',
                    common_tags: template.common_tags || [],
                    field_requirements: template.field_requirements || {},
                    custom_placeholders: template.custom_placeholders || [],
                    is_active: template.is_active ?? true,
                    sort_order: template.sort_order || 0
                })
            } else {
                setFormData({
                    name: '',
                    template_category: 'general',
                    category: 'general',
                    description: '',
                    instructions: '',
                    default_priority: 'medium',
                    pre_filled_subject: '',
                    pre_filled_description: '',
                    common_tags: [],
                    field_requirements: {},
                    custom_placeholders: [],
                    is_active: true,
                    sort_order: 0
                })
            }
            setActiveTab('basic')
            setError(null)
            setTagInput('')
            setPlaceholderName('')
            setPlaceholderDescription('')
        }
    }, [isOpen, editMode, template])
    
    // Handle escape key and click outside
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        
        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden'
        }
        
        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, onClose])
    
    const handleBackdropClick = (e) => {
        if (e.target === modalRef.current) {
            onClose()
        }
    }
    
    // Handle input changes
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }))
    }
    
    // Handle tag addition
    const handleAddTag = () => {
        if (tagInput.trim() && !formData.common_tags.includes(tagInput.trim().toLowerCase())) {
            setFormData(prev => ({
                ...prev,
                common_tags: [...prev.common_tags, tagInput.trim().toLowerCase()]
            }))
            setTagInput('')
        }
    }
    
    // Handle tag removal
    const handleRemoveTag = (tag) => {
        setFormData(prev => ({
            ...prev,
            common_tags: prev.common_tags.filter(t => t !== tag)
        }))
    }
    
    // Handle placeholder addition
    const handleAddPlaceholder = () => {
        if (placeholderName.trim()) {
            const newPlaceholder = {
                name: placeholderName.trim().replace(/\s+/g, '_').toLowerCase(),
                description: placeholderDescription.trim() || ''
            }
            
            // Check for duplicates
            if (!formData.custom_placeholders.some(p => p.name === newPlaceholder.name)) {
                setFormData(prev => ({
                    ...prev,
                    custom_placeholders: [...prev.custom_placeholders, newPlaceholder]
                }))
            }
            
            setPlaceholderName('')
            setPlaceholderDescription('')
        }
    }
    
    // Handle placeholder removal
    const handleRemovePlaceholder = (name) => {
        setFormData(prev => ({
            ...prev,
            custom_placeholders: prev.custom_placeholders.filter(p => p.name !== name)
        }))
    }
    
    // Handle field requirement change
    const handleFieldRequirementChange = (field, isRequired) => {
        setFormData(prev => ({
            ...prev,
            field_requirements: {
                ...prev.field_requirements,
                [field]: isRequired ? 'required' : 'optional'
            }
        }))
    }
    
    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        
        try {
            // Validate
            if (!formData.name.trim()) {
                throw new Error('Template name is required')
            }
            
            if (editMode && template) {
                await updateTemplate(template.id, formData)
            } else {
                await createTemplate(formData)
            }
            
            onSuccess()
        } catch (err) {
            setError(err.message || 'Failed to save template')
        } finally {
            setIsLoading(false)
        }
    }
    
    // Insert placeholder at cursor position
    const insertPlaceholder = (textareaName, placeholder) => {
        const textarea = document.querySelector(`textarea[name="${textareaName}"]`)
        if (textarea) {
            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const value = formData[textareaName]
            const newValue = value.substring(0, start) + `{{${placeholder}}}` + value.substring(end)
            setFormData(prev => ({
                ...prev,
                [textareaName]: newValue
            }))
            // Focus and set cursor position after the inserted placeholder
            setTimeout(() => {
                textarea.focus()
                const newPos = start + placeholder.length + 4 // +4 for the {{ }}
                textarea.setSelectionRange(newPos, newPos)
            }, 0)
        }
    }
    
    if (!isOpen) return null
    
    const tabs = [
        { id: 'basic', label: 'Basic Info' },
        { id: 'content', label: 'Content' },
        { id: 'tags', label: 'Tags & Placeholders' },
        { id: 'advanced', label: 'Advanced' }
    ]
    
    // Built-in placeholders
    const builtInPlaceholders = [
        { name: 'user_name', description: 'Current user name' },
        { name: 'user_email', description: 'Current user email' },
        { name: 'user_phone', description: 'Current user phone' },
        { name: 'date', description: 'Current date' },
        { name: 'time', description: 'Current time' },
        { name: 'datetime', description: 'Current date and time' }
    ]
    
    return (
        <div
            ref={modalRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        >
            <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between rounded-t-lg">
                    <h2 className="text-xl font-bold text-white">
                        {editMode ? 'Edit Template' : 'Create Template'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-300 transition-colors text-xl leading-none"
                        aria-label="Close modal"
                    >
                        ✕
                    </button>
                </div>
                
                {/* Tabs */}
                <div className="border-b border-gray-700">
                    <nav className="flex -mb-px px-4">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-blue-500 text-blue-400'
                                        : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
                
                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
                    {error && (
                        <div className="mb-4 p-3 bg-red-950 border border-red-700 text-red-300 rounded-lg">
                            {error}
                        </div>
                    )}
                    
                    {/* Basic Info Tab */}
                    {activeTab === 'basic' && (
                        <div className="space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Template Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="e.g., Password Reset Request"
                                    maxLength={200}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            
                            {/* Template Category */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Template Category
                                </label>
                                <select
                                    name="template_category"
                                    value={formData.template_category}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {Object.entries(TEMPLATE_CATEGORIES).map(([key, cat]) => (
                                        <option key={key} value={key}>{cat.icon} {cat.label}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Ticket Category */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Default Ticket Category
                                </label>
                                <select
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {Object.entries(TICKET_CATEGORIES).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Default Priority */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Default Priority
                                </label>
                                <select
                                    name="default_priority"
                                    value={formData.default_priority}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {Object.entries(PRIORITY_OPTIONS).map(([key, pri]) => (
                                        <option key={key} value={key}>{pri.label}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Description
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows={2}
                                    placeholder="Brief description of what this template is for"
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                />
                            </div>
                            
                            {/* Instructions */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Usage Instructions
                                </label>
                                <textarea
                                    name="instructions"
                                    value={formData.instructions}
                                    onChange={handleChange}
                                    rows={2}
                                    placeholder="Instructions for when to use this template"
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                />
                            </div>
                        </div>
                    )}
                    
                    {/* Content Tab */}
                    {activeTab === 'content' && (
                        <div className="space-y-4">
                            {/* Placeholder Help */}
                            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                                <p className="text-sm text-gray-400 mb-2">
                                    Click a placeholder to insert it at the cursor position:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {builtInPlaceholders.map(p => (
                                        <button
                                            key={p.name}
                                            type="button"
                                            onClick={() => insertPlaceholder('pre_filled_description', p.name)}
                                            className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded hover:bg-blue-600/30 transition-colors"
                                            title={p.description}
                                        >
                                            {`{{${p.name}}}`}
                                        </button>
                                    ))}
                                    {formData.custom_placeholders.map(p => (
                                        <button
                                            key={p.name}
                                            type="button"
                                            onClick={() => insertPlaceholder('pre_filled_description', p.name)}
                                            className="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded hover:bg-purple-600/30 transition-colors"
                                            title={p.description}
                                        >
                                            {`{{${p.name}}}`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Pre-filled Subject */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Pre-filled Subject/Title
                                </label>
                                <input
                                    type="text"
                                    name="pre_filled_subject"
                                    value={formData.pre_filled_subject}
                                    onChange={handleChange}
                                    placeholder="e.g., Password Reset Request for {{user_name}}"
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            
                            {/* Pre-filled Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Pre-filled Description
                                </label>
                                <textarea
                                    name="pre_filled_description"
                                    value={formData.pre_filled_description}
                                    onChange={handleChange}
                                    rows={12}
                                    placeholder="Enter the template content with placeholders like {{user_name}}, {{date}}, etc."
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Supports Markdown formatting. Use [brackets] for fields users need to fill in.
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {/* Tags & Placeholders Tab */}
                    {activeTab === 'tags' && (
                        <div className="space-y-6">
                            {/* Common Tags */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Common Tags
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                        placeholder="Add a tag"
                                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddTag}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.common_tags.map(tag => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-300 rounded text-sm"
                                        >
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveTag(tag)}
                                                className="text-gray-400 hover:text-red-400"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                    {formData.common_tags.length === 0 && (
                                        <span className="text-gray-500 text-sm">No tags added</span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Custom Placeholders */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Custom Placeholders
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={placeholderName}
                                        onChange={(e) => setPlaceholderName(e.target.value)}
                                        placeholder="Name (e.g., employee_id)"
                                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                        type="text"
                                        value={placeholderDescription}
                                        onChange={(e) => setPlaceholderDescription(e.target.value)}
                                        placeholder="Description (optional)"
                                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddPlaceholder}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {formData.custom_placeholders.map(p => (
                                        <div
                                            key={p.name}
                                            className="flex items-center justify-between p-2 bg-gray-800 rounded-lg"
                                        >
                                            <div>
                                                <code className="text-purple-400">{`{{${p.name}}}`}</code>
                                                {p.description && (
                                                    <span className="text-gray-500 text-sm ml-2">- {p.description}</span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePlaceholder(p.name)}
                                                className="text-gray-400 hover:text-red-400"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    {formData.custom_placeholders.length === 0 && (
                                        <span className="text-gray-500 text-sm">No custom placeholders added</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Advanced Tab */}
                    {activeTab === 'advanced' && (
                        <div className="space-y-4">
                            {/* Active Status */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    name="is_active"
                                    checked={formData.is_active}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-gray-300">
                                    Template is active and visible to users
                                </label>
                            </div>
                            
                            {/* Sort Order */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Sort Order
                                </label>
                                <input
                                    type="number"
                                    name="sort_order"
                                    value={formData.sort_order}
                                    onChange={handleChange}
                                    min={0}
                                    className="w-32 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Lower numbers appear first. Templates with the same order are sorted by popularity.
                                </p>
                            </div>
                            
                            {/* Field Requirements */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Field Requirements
                                </label>
                                <p className="text-xs text-gray-500 mb-2">
                                    Define which fields are required when using this template (for documentation purposes).
                                </p>
                                <div className="space-y-2">
                                    {['subject', 'description', 'priority', 'category'].map(field => (
                                        <label key={field} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={formData.field_requirements[field] === 'required'}
                                                onChange={(e) => handleFieldRequirementChange(field, e.target.checked)}
                                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-gray-300 capitalize">{field}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </form>
                
                {/* Footer */}
                <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-4 flex justify-end gap-3 rounded-b-lg">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isLoading && <LoadingSpinner size="sm" />}
                        {editMode ? 'Update Template' : 'Create Template'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default TemplateFormModal
