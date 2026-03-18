import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import LoadingSpinner from './LoadingSpinner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  getAllTemplates,
  applyTemplate,
  TEMPLATE_CATEGORIES,
} from '../services/templateService'

/**
 * TemplateBrowser — full-screen modal with a scrollable template list.
 * Each template can be expanded to preview its contents, then applied.
 */
export default function TemplateBrowser({ isOpen, onClose, onTemplateSelect, disabled }) {
  const [templates, setTemplates] = useState([])
  const [filteredTemplates, setFilteredTemplates] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [applyingId, setApplyingId] = useState(null)

  const modalRef = useRef(null)
  const searchInputRef = useRef(null)

  // Fetch templates when the modal opens
  useEffect(() => {
    if (isOpen && templates.length === 0) {
      fetchTemplates()
    }
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 150)
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter when category / search changes
  useEffect(() => {
    let filtered = templates
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.template_category === selectedCategory)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        t =>
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q),
      )
    }
    setFilteredTemplates(filtered)
  }, [templates, selectedCategory, searchQuery])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await getAllTemplates()
      setTemplates(data)
      setFilteredTemplates(data)
    } catch {
      setError('Failed to load templates')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = async (template) => {
    try {
      setApplyingId(template.id)
      const result = await applyTemplate(template.id)
      onTemplateSelect({
        templateId: result.template_id,
        templateName: result.template_name,
        templateVersion: result.template_version,
        subject: result.subject,
        description: result.description,
        priority: result.priority,
        category: result.category,
        instructions: result.instructions,
      })
      onClose()
    } catch {
      setError('Failed to apply template')
    } finally {
      setApplyingId(null)
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) onClose()
  }

  const categoryBadge = (category) => {
    const cat = TEMPLATE_CATEGORIES[category] || TEMPLATE_CATEGORIES.other
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
      >
        <span>{cat.icon}</span>
        {cat.label}
      </span>
    )
  }

  if (!isOpen) return null

  return createPortal(
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
    >
      <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Template Browser
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Search & Category Filter ───────────────────────── */}
        <div className="shrink-0 px-6 py-3 border-b border-gray-800 space-y-2">
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
              className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              All
            </button>
            {Object.entries(TEMPLATE_CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(key)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                  selectedCategory === key
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700'
                }`}
                style={selectedCategory === key ? { backgroundColor: cat.color } : undefined}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Template List (scrollable) ─────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner size="md" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-red-400 mb-3">{error}</p>
              <button
                onClick={fetchTemplates}
                className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              {searchQuery || selectedCategory !== 'all'
                ? 'No templates match your filters'
                : 'No templates available'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {filteredTemplates.map((template) => {
                const isExpanded = expandedId === template.id
                return (
                  <li key={template.id}>
                    {/* Row — click to expand/collapse */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : template.id)}
                      className={`w-full text-left px-6 py-3 hover:bg-gray-800/60 transition-colors ${
                        isExpanded ? 'bg-gray-800/40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Expand chevron */}
                        <svg
                          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>

                        {categoryBadge(template.template_category)}

                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-white">{template.name}</span>
                          {template.description && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">{template.description}</p>
                          )}
                        </div>

                        {template.usage_count > 0 && (
                          <span className="text-xs text-gray-500 shrink-0">{template.usage_count}× used</span>
                        )}
                      </div>
                    </button>

                    {/* Expanded preview panel */}
                    {isExpanded && (
                      <div className="px-6 pb-4 pt-1 bg-gray-800/30 border-t border-gray-800">
                        {/* Subject preview */}
                        {template.subject && (
                          <div className="mb-3">
                            <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Subject</span>
                            <p className="text-sm text-gray-200 mt-0.5">{template.subject}</p>
                          </div>
                        )}

                        {/* Description / body preview */}
                        {template.description_template && (
                          <div className="mb-3">
                            <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Description</span>
                            <div className="mt-1 text-sm text-gray-300 bg-gray-900/60 rounded-lg px-4 py-3 border border-gray-700 max-h-52 overflow-y-auto prose-sm">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}
                                components={{
                                  p:  ({node, ...p}) => <p className="text-gray-300 mb-2 last:mb-0" {...p} />,
                                  ul: ({node, ...p}) => <ul className="list-disc list-inside text-gray-300 mb-2 space-y-0.5 pl-2" {...p} />,
                                  ol: ({node, ...p}) => <ol className="list-decimal list-inside text-gray-300 mb-2 space-y-0.5 pl-2" {...p} />,
                                  strong: ({node, ...p}) => <strong className="font-semibold text-white" {...p} />,
                                  code: ({node, ...p}) => <code className="bg-gray-700 text-blue-300 rounded px-1 py-0.5 font-mono text-xs" {...p} />,
                                }}
                              >
                                {template.description_template}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}

                        {/* Instructions */}
                        {template.instructions && (
                          <div className="mb-3">
                            <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Instructions</span>
                            <p className="text-xs text-gray-400 mt-0.5">{template.instructions}</p>
                          </div>
                        )}

                        {/* Priority / category tags */}
                        <div className="flex items-center gap-3 mb-4">
                          {template.priority && (
                            <span className="text-xs text-gray-400">
                              Priority: <span className="text-gray-200 font-medium capitalize">{template.priority}</span>
                            </span>
                          )}
                          {template.category && (
                            <span className="text-xs text-gray-400">
                              Category: <span className="text-gray-200 font-medium capitalize">{template.category}</span>
                            </span>
                          )}
                        </div>

                        {/* Apply button */}
                        <button
                          type="button"
                          onClick={() => handleApply(template)}
                          disabled={disabled || applyingId === template.id}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {applyingId === template.id ? (
                            <>
                              <LoadingSpinner size="xs" />
                              Applying…
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Use This Template
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
