import { useState, useEffect, useCallback, useMemo } from 'react'
import LoadingSpinner from '../components/LoadingSpinner'
import TemplateFormModal from '../components/TemplateFormModal'
import TemplatePreviewModal from '../components/TemplatePreviewModal'
import { useToast } from '../hooks/useToast'
import {
    getAllTemplates,
    deleteTemplate,
    toggleTemplateStatus,
    exportTemplate,
    importTemplate,
    getTemplateAnalytics,
    TEMPLATE_CATEGORIES,
    PRIORITY_OPTIONS
} from '../services/templateService'

function TemplateManager() {
    const toast = useToast()
    
    // State management
    const [templates, setTemplates] = useState([])
    const [analytics, setAnalytics] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    
    // Filters
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all') // all, active, inactive
    const [searchQuery, setSearchQuery] = useState('')
    
    // Modals
    const [isFormModalOpen, setIsFormModalOpen] = useState(false)
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
    const [selectedTemplate, setSelectedTemplate] = useState(null)
    const [editMode, setEditMode] = useState(false)
    
    // Fetch templates and analytics
    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true)
            const [templatesData, analyticsData] = await Promise.all([
                getAllTemplates({ includeStats: true }),
                getTemplateAnalytics()
            ])
            setTemplates(templatesData)
            setAnalytics(analyticsData)
        } catch (error) {
            console.error('Failed to fetch data:', error)
            toast.error('Failed to load templates. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }, [])
    
    useEffect(() => {
        fetchData()
    }, [fetchData])
    
    // Filter templates
    const filteredTemplates = useMemo(() => {
        return templates.filter(template => {
            // Category filter
            if (categoryFilter !== 'all' && template.template_category !== categoryFilter) {
                return false
            }
            
            // Status filter
            if (statusFilter === 'active' && !template.is_active) return false
            if (statusFilter === 'inactive' && template.is_active) return false
            
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                return (
                    template.name.toLowerCase().includes(query) ||
                    template.description?.toLowerCase().includes(query) ||
                    template.category?.toLowerCase().includes(query)
                )
            }
            
            return true
        })
    }, [templates, categoryFilter, statusFilter, searchQuery])
    
    // Handlers
    const handleCreateTemplate = () => {
        setSelectedTemplate(null)
        setEditMode(false)
        setIsFormModalOpen(true)
    }
    
    const handleEditTemplate = (template) => {
        setSelectedTemplate(template)
        setEditMode(true)
        setIsFormModalOpen(true)
    }
    
    const handlePreviewTemplate = (template) => {
        setSelectedTemplate(template)
        setIsPreviewModalOpen(true)
    }
    
    const handleToggleStatus = async (template) => {
        try {
            await toggleTemplateStatus(template.id)
            toast.success(`Template "${template.name}" ${template.is_active ? 'deactivated' : 'activated'} successfully`)
            fetchData()
        } catch (error) {
            toast.error(error.message || 'Failed to update template status')
        }
    }
    
    const handleDeleteTemplate = async (template) => {
        if (!confirm(`Are you sure you want to delete "${template.name}"? This action cannot be undone.`)) {
            return
        }
        
        try {
            await deleteTemplate(template.id)
            toast.success(`Template "${template.name}" deleted successfully`)
            fetchData()
        } catch (error) {
            toast.error(error.message || 'Failed to delete template')
        }
    }
    
    const handleExportTemplate = async (template) => {
        try {
            const exportData = await exportTemplate(template.id)
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `template-${template.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            
            toast.success(`Template "${template.name}" exported successfully`)
        } catch (error) {
            toast.error(error.message || 'Failed to export template')
        }
    }
    
    const handleImportTemplate = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        
        input.onchange = async (e) => {
            const file = e.target.files[0]
            if (!file) return
            
            try {
                const text = await file.text()
                const templateData = JSON.parse(text)
                await importTemplate(templateData)
                toast.success('Template imported successfully')
                fetchData()
            } catch (error) {
                toast.error(error.message || 'Failed to import template. Please check the file format.')
            }
        }
        
        input.click()
    }
    
    const handleFormSuccess = () => {
        setIsFormModalOpen(false)
        toast.success(editMode ? 'Template updated successfully' : 'Template created successfully')
        fetchData()
    }
    
    // Render category badge
    const renderCategoryBadge = (category) => {
        const cat = TEMPLATE_CATEGORIES[category] || TEMPLATE_CATEGORIES.other
        return (
            <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
            >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
            </span>
        )
    }
    
    // Render priority badge
    const renderPriorityBadge = (priority) => {
        const pri = PRIORITY_OPTIONS[priority] || PRIORITY_OPTIONS.medium
        return (
            <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: `${pri.color}20`, color: pri.color }}
            >
                {pri.label}
            </span>
        )
    }
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-950">
                <LoadingSpinner size="lg" />
            </div>
        )
    }
    
    return (
        <div className="p-4 md:p-8 bg-gray-950 min-h-screen">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">Template Manager</h1>
                    <p className="text-gray-400 mt-1">
                        Create and manage ticket templates for common issues
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleImportTemplate}
                        className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Import
                    </button>
                    <button
                        onClick={handleCreateTemplate}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Template
                    </button>
                </div>
            </div>
            
            {/* Analytics Summary */}
            {analytics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="text-2xl font-bold text-white">{analytics.summary?.total_templates || 0}</div>
                        <div className="text-sm text-gray-400">Total Templates</div>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="text-2xl font-bold text-green-400">{analytics.summary?.active_templates || 0}</div>
                        <div className="text-sm text-gray-400">Active Templates</div>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="text-2xl font-bold text-blue-400">{analytics.summary?.total_usage || 0}</div>
                        <div className="text-sm text-gray-400">Total Usage</div>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="text-2xl font-bold text-purple-400">
                            {analytics.summary?.avg_resolution_hours ? `${parseFloat(analytics.summary.avg_resolution_hours).toFixed(1)}h` : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-400">Avg. Resolution Time</div>
                    </div>
                </div>
            )}
            
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                {/* Search */}
                <div className="flex-1">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                
                {/* Category Filter */}
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Categories</option>
                    {Object.entries(TEMPLATE_CATEGORIES).map(([key, cat]) => (
                        <option key={key} value={key}>{cat.icon} {cat.label}</option>
                    ))}
                </select>
                
                {/* Status Filter */}
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Status</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                </select>
            </div>
            
            {/* Templates List */}
            {filteredTemplates.length === 0 ? (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                    <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-xl font-medium text-white mb-2">No Templates Found</h3>
                    <p className="text-gray-400 mb-4">
                        {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
                            ? 'Try adjusting your filters or search query.'
                            : 'Get started by creating your first template.'}
                    </p>
                    {!searchQuery && categoryFilter === 'all' && statusFilter === 'all' && (
                        <button
                            onClick={handleCreateTemplate}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Create Template
                        </button>
                    )}
                </div>
            ) : (
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-900/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Template</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400 hidden md:table-cell">Category</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400 hidden lg:table-cell">Default Priority</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400 hidden lg:table-cell">Usage</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredTemplates.map((template) => (
                                <tr key={template.id} className="hover:bg-gray-700/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium">{template.name}</span>
                                            <span className="text-sm text-gray-500 truncate max-w-xs">
                                                {template.description || 'No description'}
                                            </span>
                                            <span className="md:hidden mt-1">
                                                {renderCategoryBadge(template.template_category)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        {renderCategoryBadge(template.template_category)}
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        {renderPriorityBadge(template.default_priority)}
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        <span className="text-gray-300">{template.usage_count || 0}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => handleToggleStatus(template)}
                                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                template.is_active
                                                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                                    : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                                            }`}
                                        >
                                            {template.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handlePreviewTemplate(template)}
                                                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                                title="Preview"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleEditTemplate(template)}
                                                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                                title="Edit"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleExportTemplate(template)}
                                                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                                title="Export"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTemplate(template)}
                                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            {/* Template Form Modal */}
            <TemplateFormModal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                onSuccess={handleFormSuccess}
                template={selectedTemplate}
                editMode={editMode}
            />
            
            {/* Template Preview Modal */}
            <TemplatePreviewModal
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                template={selectedTemplate}
            />
          </div>
        </div>
    )
}

export default TemplateManager
