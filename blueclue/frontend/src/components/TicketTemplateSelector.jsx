import { useState, useCallback } from 'react'
import TemplateBrowser from './TemplateBrowser'

/**
 * TicketTemplateSelector — reusable, context-free component for selecting
 * and applying a ticket template.
 *
 * Props:
 *   onTemplateApplied(templateData) — called with the resolved template fields
 *   onTemplateClear()              — called when the user clears the applied template
 *   disabled — disables the trigger button
 *
 * templateData shape:
 *   { templateId, templateName, templateVersion, subject, description,
 *     priority, category, instructions }
 */
function TicketTemplateSelector({ onTemplateApplied, onTemplateClear, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [appliedTemplate, setAppliedTemplate] = useState(null)

  const handleSelect = useCallback((templateData) => {
    setAppliedTemplate({
      id: templateData.templateId,
      name: templateData.templateName,
      version: templateData.templateVersion,
      instructions: templateData.instructions,
    })
    if (onTemplateApplied) onTemplateApplied(templateData)
  }, [onTemplateApplied])

  const handleClear = useCallback(() => {
    setAppliedTemplate(null)
    if (onTemplateClear) onTemplateClear()
  }, [onTemplateClear])

  return (
    <div>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-left text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
      >
        <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-gray-300">Browse Templates</span>
      </button>

      {/* Browser modal */}
      <TemplateBrowser
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onTemplateSelect={handleSelect}
        disabled={disabled}
      />

      {/* Applied-template indicator */}
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
              onClick={handleClear}
              className="text-blue-400 hover:text-blue-300 text-xs"
            >
              Clear
            </button>
          </div>
          {appliedTemplate.instructions && (
            <p className="text-xs text-blue-400/70 mt-1">{appliedTemplate.instructions}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default TicketTemplateSelector
