import { useState, useEffect, useRef } from 'react'
import { useToast } from '../hooks/useToast'
import TemplatePreviewModal from './TemplatePreviewModal'
import { TEMPLATE_CATEGORIES, PRIORITY_OPTIONS } from '../services/templateService'
import { formatTime as _fmtTime, formatDate as _fmtDate, formatDateTime as _fmtDateTime } from '../utils/dateFormatter'

function TemplateVersionHistoryModal({ isOpen, onClose, template, versions, onRestore }) {
    const modalRef = useRef(null)
    const toast = useToast()
    const [selectedVersion, setSelectedVersion] = useState(null)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [isRestoring, setIsRestoring] = useState(false)
    
    // Handle escape key and click outside
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen && !isPreviewOpen) {
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
    }, [isOpen, isPreviewOpen, onClose])
    
    const handleBackdropClick = (e) => {
        if (e.target === modalRef.current && !isPreviewOpen) {
            onClose()
        }
    }
    
    const handlePreview = (version) => {
        // Convert version data to template format for preview
        const versionAsTemplate = {
            id: template.id,
            name: version.name,
            template_category: version.template_category,
            category: version.category,
            description: version.description,
            instructions: version.instructions,
            default_priority: version.default_priority,
            pre_filled_subject: version.pre_filled_subject,
            pre_filled_description: version.pre_filled_description,
            common_tags: version.common_tags,
            field_requirements: version.field_requirements,
            field_mappings: version.field_mappings,
            custom_placeholders: version.custom_placeholders,
            is_active: true, // For preview purposes
            version: version.version,
            created_at: version.changed_at,
            created_by_name: version.changed_by_name
        }
        setSelectedVersion(versionAsTemplate)
        setIsPreviewOpen(true)
    }
    
    const handleRestore = async (version) => {
        const confirmed = confirm(
            `Are you sure you want to restore this template to version ${version.version}?\n\n` +
            `This will replace the current template content with the content from ${_fmtDateTime(version.changed_at)}.\n\n` +
            `A new version will be created with the restored content.`
        )
        
        if (!confirmed) return
        
        try {
            setIsRestoring(true)
            await onRestore(version.version)
            toast.success(`Template restored to version ${version.version} successfully`)
            onClose()
        } catch (error) {
            toast.error(error.message || 'Failed to restore template version')
        } finally {
            setIsRestoring(false)
        }
    }
    
    const formatDate = (dateString) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now - date
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        
        if (diffDays === 0) {
            return `Today at ${_fmtTime(dateString, { hour: '2-digit', minute: '2-digit' })}`
        } else if (diffDays === 1) {
            return `Yesterday at ${_fmtTime(dateString, { hour: '2-digit', minute: '2-digit' })}`
        } else if (diffDays < 7) {
            return `${diffDays} days ago`
        } else {
            return _fmtDate(dateString)
        }
    }
    
    if (!isOpen || !template) return null
    
    const currentVersion = template.version
    const sortedVersions = [...(versions || [])].sort((a, b) => b.version - a.version)
    
    return (
        <>
            <div
                ref={modalRef}
                onClick={handleBackdropClick}
                className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            >
                <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                    {/* Header */}
                    <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between rounded-t-lg">
                        <div>
                            <h2 className="text-xl font-bold text-white">Version History</h2>
                            <p className="text-sm text-gray-400 mt-1">
                                {template.name} (Current: v{currentVersion})
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-300 transition-colors text-xl leading-none"
                            aria-label="Close modal"
                        >
                            ✕
                        </button>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {sortedVersions.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-400 text-sm">No version history available</p>
                                <p className="text-gray-500 text-xs mt-1">
                                    Versions are created automatically when templates are updated
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sortedVersions.map((version) => {
                                    const isCurrent = version.version === currentVersion
                                    const templateCat = TEMPLATE_CATEGORIES[version.template_category] || TEMPLATE_CATEGORIES.other
                                    const priority = PRIORITY_OPTIONS[version.default_priority] || PRIORITY_OPTIONS.medium
                                    
                                    return (
                                        <div
                                            key={version.version}
                                            className={`bg-gray-800 rounded-lg border p-4 transition-all ${
                                                isCurrent
                                                    ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                                                    : 'border-gray-700 hover:border-gray-600'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    {/* Version header */}
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-lg font-bold text-white">
                                                            v{version.version}
                                                        </span>
                                                        {isCurrent && (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">
                                                                Current
                                                            </span>
                                                        )}
                                                        <span
                                                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                                                            style={{
                                                                backgroundColor: `${templateCat.color}20`,
                                                                color: templateCat.color
                                                            }}
                                                        >
                                                            {templateCat.label}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Template name */}
                                                    <h3 className="text-white font-medium mb-1 truncate">
                                                        {version.name}
                                                    </h3>
                                                    
                                                    {/* Description preview */}
                                                    {version.description && (
                                                        <p className="text-sm text-gray-400 line-clamp-2 mb-2">
                                                            {version.description}
                                                        </p>
                                                    )}
                                                    
                                                    {/* Metadata */}
                                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                                        <span>
                                                            Modified {formatDate(version.changed_at)}
                                                        </span>
                                                        {version.changed_by_name && (
                                                            <>
                                                                <span>•</span>
                                                                <span>by {version.changed_by_name}</span>
                                                            </>
                                                        )}
                                                        {version.change_reason && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="italic">{version.change_reason}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Additional metadata */}
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span
                                                            className="px-2 py-0.5 rounded text-xs font-medium"
                                                            style={{
                                                                backgroundColor: `${priority.color}20`,
                                                                color: priority.color
                                                            }}
                                                        >
                                                            {priority.label}
                                                        </span>
                                                        {version.common_tags && version.common_tags.length > 0 && (
                                                            <span className="text-xs text-gray-500">
                                                                {version.common_tags.length} tag{version.common_tags.length > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Action buttons */}
                                                <div className="flex flex-col gap-2">
                                                    <button
                                                        onClick={() => handlePreview(version)}
                                                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors whitespace-nowrap"
                                                    >
                                                        Preview
                                                    </button>
                                                    {!isCurrent && (
                                                        <button
                                                            onClick={() => handleRestore(version)}
                                                            disabled={isRestoring}
                                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded transition-colors whitespace-nowrap"
                                                        >
                                                            {isRestoring ? 'Restoring...' : 'Restore'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    
                    {/* Footer */}
                    <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-4 rounded-b-lg">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500">
                                {sortedVersions.length} version{sortedVersions.length !== 1 ? 's' : ''} available
                            </p>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Preview Modal */}
            {selectedVersion && (
                <TemplatePreviewModal
                    isOpen={isPreviewOpen}
                    onClose={() => {
                        setIsPreviewOpen(false)
                        setSelectedVersion(null)
                    }}
                    template={selectedVersion}
                />
            )}
        </>
    )
}

export default TemplateVersionHistoryModal
