import { useState, useEffect, useRef } from 'react'

/**
 * QuickActionsPanel
 * A collapsible panel that sticks to the right edge of the viewport.
 * Expands on click to reveal quick-action buttons and system status.
 */
function QuickActionsPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen])

  return (
    <div ref={panelRef} className="fixed right-0 top-20 z-50 flex items-start">
      {/* Expanded panel */}
      <div
        className={`
          bg-gray-900 border border-gray-700 rounded-l-xl shadow-2xl
          transition-all duration-300 ease-in-out overflow-hidden
          ${isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 border-0'}
        `}
      >
        <div className="p-5 min-w-[18rem]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-white">Quick Actions</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
              aria-label="Close quick actions"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 mb-6">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center gap-3 text-sm">
              <span className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-xs font-bold">+</span>
              <span>Assign Ticket</span>
            </button>

            <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center gap-3 text-sm">
              <span className="w-6 h-6 bg-purple-500 rounded flex items-center justify-center text-xs font-bold">#</span>
              <span>Add Technician</span>
            </button>

            <button className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center gap-3 text-sm">
              <span className="w-6 h-6 bg-green-500 rounded flex items-center justify-center text-xs font-bold">⬇</span>
              <span>Generate Report</span>
            </button>

            <button className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center gap-3 text-sm">
              <span className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center text-xs font-bold">⚙</span>
              <span>Settings</span>
            </button>
          </div>

          {/* System Status */}
          <div className="pt-4 border-t border-gray-700">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">System Status</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                <span className="text-gray-400">Backend</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-green-400 text-xs">Online</span>
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                <span className="text-gray-400">Database</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-green-400 text-xs">Connected</span>
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                <span className="text-gray-400">AI Service</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-green-400 text-xs">Active</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab handle — always visible on the right edge */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`
          flex items-center justify-center
          bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600
          text-white shadow-lg
          transition-all duration-200
          ${isOpen ? 'rounded-r-lg' : 'rounded-l-lg'}
          w-8 py-6
          group
        `}
        aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
        title="Quick Actions"
      >
        <div className="flex flex-col items-center gap-1">
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
            Actions
          </span>
        </div>
      </button>
    </div>
  )
}

export default QuickActionsPanel
