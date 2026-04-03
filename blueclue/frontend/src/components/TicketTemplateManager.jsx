import { useState, useEffect, useCallback, useMemo } from 'react'
import LoadingSpinner from './LoadingSpinner'
import TemplateFormModal from './TemplateFormModal'
import TemplatePreviewModal from './TemplatePreviewModal'
import TemplateVersionHistoryModal from './TemplateVersionHistoryModal'
import { useToast } from '../hooks/useToast'
import {
  getAllTemplates,
  deleteTemplate,
  toggleTemplateStatus,
  getTemplateVersions,
  restoreTemplateVersion,
  TEMPLATE_CATEGORIES,
  PRIORITY_OPTIONS,
} from '../services/templateService'

/**
 * TicketTemplateManager — self-contained template CRUD panel.
 *
 * Renders inline (no page chrome) so it can be dropped into a sidebar,
 * settings panel, modal, or a full page equally.
 *
 * Props (all optional):
 *   compact  — when true, hides analytics/filters for tight spaces
 */
function TicketTemplateManager({ compact = false }) {
  const toast = useToast()

  const [templates, setTemplates] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [versions, setVersions] = useState([])
  const [editMode, setEditMode] = useState(false)

  // Data fetching
  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await getAllTemplates({ includeStats: true })
      setTemplates(data)
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  // Filtering
  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (categoryFilter !== 'all' && t.template_category !== categoryFilter) return false
      if (statusFilter === 'active' && !t.is_active) return false
      if (statusFilter === 'inactive' && t.is_active) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
      }
      return true
    })
  }, [templates, categoryFilter, statusFilter, searchQuery])

  // Handlers
  const handleCreate = () => { setSelected(null); setEditMode(false); setIsFormOpen(true) }
  const handleEdit = (t) => { setSelected(t); setEditMode(true); setIsFormOpen(true) }
  const handlePreview = (t) => { setSelected(t); setIsPreviewOpen(true) }

  const handleVersionHistory = async (t) => {
    try {
      setSelected(t)
      const v = await getTemplateVersions(t.id)
      setVersions(v)
      setIsVersionHistoryOpen(true)
    } catch (e) {
      toast.error(e.message || 'Failed to load version history')
    }
  }

  const handleRestore = async (versionNumber) => {
    await restoreTemplateVersion(selected.id, versionNumber, 'Restored from version history')
    toast.success(`Restored to version ${versionNumber}`)
    await fetchTemplates()
    const v = await getTemplateVersions(selected.id)
    setVersions(v)
  }

  const handleToggle = async (t) => {
    try {
      await toggleTemplateStatus(t.id)
      toast.success(`"${t.name}" ${t.is_active ? 'deactivated' : 'activated'}`)
      fetchTemplates()
    } catch (e) {
      toast.error(e.message || 'Failed to update status')
    }
  }

  const handleDelete = async (t) => {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return
    try {
      await deleteTemplate(t.id)
      toast.success(`"${t.name}" deleted`)
      fetchTemplates()
    } catch (e) {
      toast.error(e.message || 'Failed to delete template')
    }
  }

  const handleFormSuccess = () => {
    setIsFormOpen(false)
    toast.success(editMode ? 'Template updated' : 'Template created')
    fetchTemplates()
  }

  const categoryBadge = (cat) => {
    const c = TEMPLATE_CATEGORIES[cat] || TEMPLATE_CATEGORIES.other
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: `${c.color}20`, color: c.color }}
      >
        {c.icon} {c.label}
      </span>
    )
  }

  const priorityBadge = (pri) => {
    const p = PRIORITY_OPTIONS[pri] || PRIORITY_OPTIONS.medium
    return (
      <span
        className="px-2 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: `${p.color}20`, color: p.color }}
      >
        {p.label}
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-300">
          Templates ({templates.length})
        </h3>
        <button
          onClick={handleCreate}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New
        </button>
      </div>

      {/* Filters (hidden in compact mode) */}
      {!compact && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search templates…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-xs focus:outline-none"
            >
              <option value="all">All Categories</option>
              {Object.entries(TEMPLATE_CATEGORIES).map(([k, c]) => (
                <option key={k} value={k}>{c.icon} {c.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-xs focus:outline-none"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      )}

      {/* Template list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No templates found</p>
          <button onClick={handleCreate} className="mt-2 text-blue-400 hover:text-blue-300 text-sm">
            Create one
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id} className="bg-gray-800/60 rounded-lg border border-gray-700 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{t.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {categoryBadge(t.template_category)}
                    {priorityBadge(t.default_priority)}
                    <span className={`text-xs ${t.is_active ? 'text-green-400' : 'text-gray-500'}`}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {t.usage_count > 0 && (
                      <span className="text-xs text-gray-500">{t.usage_count}× used</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handlePreview(t)} className="p-1 text-gray-400 hover:text-white rounded" title="Preview">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button onClick={() => handleEdit(t)} className="p-1 text-gray-400 hover:text-white rounded" title="Edit">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleVersionHistory(t)} className="p-1 text-gray-400 hover:text-white rounded" title="History">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button onClick={() => handleToggle(t)} className="p-1 text-gray-400 hover:text-yellow-400 rounded" title={t.is_active ? 'Deactivate' : 'Activate'}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.is_active ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(t)} className="p-1 text-gray-400 hover:text-red-400 rounded" title="Delete">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modals */}
      <TemplateFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleFormSuccess}
        template={selected}
        editMode={editMode}
      />
      <TemplatePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        template={selected}
      />
      <TemplateVersionHistoryModal
        isOpen={isVersionHistoryOpen}
        onClose={() => setIsVersionHistoryOpen(false)}
        template={selected}
        versions={versions}
        onRestore={handleRestore}
      />
    </div>
  )
}

export default TicketTemplateManager
