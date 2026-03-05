import { useRef, useEffect } from 'react'
import {
    TEMPLATE_CATEGORIES,
    PRIORITY_OPTIONS,
    TICKET_CATEGORIES
} from '../services/templateService'

function TemplatePreviewModal({ isOpen, onClose, template }) {
    const modalRef = useRef(null)
    
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
    
    if (!isOpen || !template) return null
    
    const templateCat = TEMPLATE_CATEGORIES[template.template_category] || TEMPLATE_CATEGORIES.other
    const priority = PRIORITY_OPTIONS[template.default_priority] || PRIORITY_OPTIONS.medium
    const ticketCategory = TICKET_CATEGORIES[template.category] || 'General'
    
    // Format description with syntax highlighting for placeholders
    const formatDescription = (text) => {
        if (!text) return null
        
        // Replace placeholders with styled spans
        const parts = text.split(/(\{\{[^}]+\}\})/g)
        
        return parts.map((part, index) => {
            if (part.match(/^\{\{[^}]+\}\}$/)) {
                return (
                    <span key={index} className="bg-blue-600/30 text-blue-300 px-1 rounded">
                        {part}
                    </span>
                )
            }
            // Preserve line breaks and formatting
            return part.split('\n').map((line, lineIndex, arr) => (
                <span key={`${index}-${lineIndex}`}>
                    {line}
                    {lineIndex < arr.length - 1 && <br />}
                </span>
            ))
        })
    }
    
    return (
        <div
            ref={modalRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        >
            <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between rounded-t-lg">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{templateCat.icon}</span>
                        <div>
                            <h2 className="text-xl font-bold text-white">{template.name}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span
                                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{ backgroundColor: `${templateCat.color}20`, color: templateCat.color }}
                                >
                                    {templateCat.label}
                                </span>
                                {!template.is_active && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">
                                        Inactive
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-300 transition-colors text-xl leading-none"
                        aria-label="Close modal"
                    >
                        X
                    </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Description */}
                    {template.description && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-400 mb-2">Description</h3>
                            <p className="text-gray-300">{template.description}</p>
                        </div>
                    )}
                    
                    {/* Instructions */}
                    {template.instructions && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-400 mb-2">When to Use</h3>
                            <p className="text-gray-300">{template.instructions}</p>
                        </div>
                    )}
                    
                    {/* Defaults */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-400 mb-2">Default Settings</h3>
                        <div className="flex flex-wrap gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-sm">Priority:</span>
                                <span
                                    className="px-2 py-0.5 rounded text-xs font-medium"
                                    style={{ backgroundColor: `${priority.color}20`, color: priority.color }}
                                >
                                    {priority.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-sm">Category:</span>
                                <span className="text-gray-300 text-sm">{ticketCategory}</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Pre-filled Subject */}
                    {template.pre_filled_subject && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-400 mb-2">Pre-filled Subject</h3>
                            <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                                <p className="text-gray-300">{formatDescription(template.pre_filled_subject)}</p>
                            </div>
                        </div>
                    )}
                    
                    {/* Pre-filled Description */}
                    {template.pre_filled_description && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-400 mb-2">Pre-filled Description</h3>
                            <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 max-h-80 overflow-y-auto">
                                <pre className="text-gray-300 whitespace-pre-wrap font-sans text-sm">
                                    {formatDescription(template.pre_filled_description)}
                                </pre>
                            </div>
                        </div>
                    )}
                    
                    {/* Tags */}
                    {template.common_tags && template.common_tags.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-400 mb-2">Common Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {template.common_tags.map(tag => (
                                    <span
                                        key={tag}
                                        className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-sm"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Custom Placeholders */}
                    {template.custom_placeholders && template.custom_placeholders.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-400 mb-2">Custom Placeholders</h3>
                            <div className="space-y-2">
                                {template.custom_placeholders.map(p => (
                                    <div key={p.name} className="flex items-start gap-2">
                                        <code className="text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded">
                                            {`{{${p.name}}}`}
                                        </code>
                                        {p.description && (
                                            <span className="text-gray-400 text-sm">- {p.description}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Metadata */}
                    <div className="pt-4 border-t border-gray-700">
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                            <div>
                                <span>Version:</span>
                                <span className="ml-1 text-gray-400">{template.version || 1}</span>
                            </div>
                            <div>
                                <span>Usage Count:</span>
                                <span className="ml-1 text-gray-400">{template.usage_count || 0}</span>
                            </div>
                            {template.created_by_name && (
                                <div>
                                    <span>Created by:</span>
                                    <span className="ml-1 text-gray-400">{template.created_by_name}</span>
                                </div>
                            )}
                            {template.last_used_at && (
                                <div>
                                    <span>Last used:</span>
                                    <span className="ml-1 text-gray-400">
                                        {new Date(template.last_used_at).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Footer */}
                <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-4 flex justify-end rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

export default TemplatePreviewModal
