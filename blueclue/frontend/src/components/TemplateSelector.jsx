import { useState, useEffect, useRef } from 'react'
import LoadingSpinner from './LoadingSpinner'
import {
    getAllTemplates,
    applyTemplate,
    TEMPLATE_CATEGORIES
} from '../services/templateService'

function TemplateSelector({ onTemplateSelect, disabled }) {
    const [isOpen, setIsOpen] = useState(false)
    const [templates, setTemplates] = useState([])
    const [filteredTemplates, setFilteredTemplates] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedTemplate, setSelectedTemplate] = useState(null)
    const [isApplying, setIsApplying] = useState(false)
    
    const dropdownRef = useRef(null)
    const searchInputRef = useRef(null)
    
    // Fetch templates when dropdown opens
    useEffect(() => {
        if (isOpen && templates.length === 0) {
            fetchTemplates()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])
    
    // Filter templates when category or search changes
    useEffect(() => {
        let filtered = templates
        
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(t => t.template_category === selectedCategory)
        }
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(t =>
                t.name.toLowerCase().includes(query) ||
                t.description?.toLowerCase().includes(query)
            )
        }
        
        setFilteredTemplates(filtered)
    }, [templates, selectedCategory, searchQuery])
    
    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false)
            }
        }
        
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            // Focus search input when dropdown opens
            setTimeout(() => searchInputRef.current?.focus(), 100)
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])
    
    const fetchTemplates = async () => {
        try {
            setIsLoading(true)
            setError(null)
            const data = await getAllTemplates()
            setTemplates(data)
            setFilteredTemplates(data)
        } catch (err) {
            setError('Failed to load templates')
            console.error('Failed to fetch templates:', err)
        } finally {
            setIsLoading(false)
        }
    }
    
    const handleTemplateClick = (template) => {
        setSelectedTemplate(template)
    }
    
    const handleApplyTemplate = async () => {
        if (!selectedTemplate) return
        
        try {
            setIsApplying(true)
            const result = await applyTemplate(selectedTemplate.id)
            
            const templateData = {
                templateId: result.template_id,
                templateName: result.template_name,
                templateVersion: result.template_version,
                subject: result.subject,
                description: result.description,
                priority: result.priority,
                category: result.category,
                instructions: result.instructions
            }
            
            onTemplateSelect(templateData)
            
            setIsOpen(false)
            setSelectedTemplate(null)
        } catch (err) {
            setError('Failed to apply template')
            console.error('Apply template error:', err)
        } finally {
            setIsApplying(false)
        }
    }
    
    const renderCategoryBadge = (category) => {
        const cat = TEMPLATE_CATEGORIES[category] || TEMPLATE_CATEGORIES.other
        return (
            <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
                style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
            >
                <span>{cat.icon}</span>
            </span>
        )
    }
    
    return (
        <div ref={dropdownRef} className="relative">
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-left text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between transition-colors"
            >
                <span className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-gray-300">Use a Template</span>
                </span>
                <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            
            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute z-50 mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-96 flex flex-col">
                    {/* Search and Filter */}
                    <div className="p-3 border-b border-gray-700 space-y-2">
                        {/* Search */}
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search templates..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        
                        {/* Category Filter */}
                        <div className="flex flex-wrap gap-1">
                            <button
                                type="button"
                                onClick={() => setSelectedCategory('all')}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                    selectedCategory === 'all'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                All
                            </button>
                            {Object.entries(TEMPLATE_CATEGORIES).map(([key, cat]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setSelectedCategory(key)}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${
                                        selectedCategory === key
                                            ? 'text-white'
                                            : 'text-gray-300 hover:bg-gray-600'
                                    }`}
                                    style={selectedCategory === key ? { backgroundColor: cat.color } : { backgroundColor: 'rgb(55, 65, 81)' }}
                                >
                                    {cat.icon}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Templates List */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <LoadingSpinner size="sm" />
                            </div>
                        ) : error ? (
                            <div className="p-4 text-center text-red-400">{error}</div>
                        ) : filteredTemplates.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                {searchQuery || selectedCategory !== 'all'
                                    ? 'No templates match your filters'
                                    : 'No templates available'}
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-700">
                                {filteredTemplates.map((template) => (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => handleTemplateClick(template)}
                                        className={`w-full px-3 py-2 text-left hover:bg-gray-700/50 transition-colors ${
                                            selectedTemplate?.id === template.id ? 'bg-blue-600/20 border-l-2 border-blue-500' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            {renderCategoryBadge(template.template_category)}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-white truncate">
                                                    {template.name}
                                                </div>
                                                {template.description && (
                                                    <div className="text-xs text-gray-500 truncate">
                                                        {template.description}
                                                    </div>
                                                )}
                                            </div>
                                            {template.usage_count > 0 && (
                                                <span className="text-xs text-gray-500">
                                                    {template.usage_count}×
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Selected Template Preview & Apply */}
                    {selectedTemplate && (
                        <div className="border-t border-gray-700 p-3 bg-gray-900/50">
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-white text-sm">{selectedTemplate.name}</div>
                                    {selectedTemplate.instructions && (
                                        <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                                            {selectedTemplate.instructions}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleApplyTemplate}
                                    disabled={isApplying}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                    {isApplying && <LoadingSpinner size="xs" />}
                                    Apply
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default TemplateSelector
