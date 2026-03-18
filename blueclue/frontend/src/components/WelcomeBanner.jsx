import { useState } from 'react'

const DISMISS_KEY = 'blueclue_welcome_dismissed'

/**
 * WelcomeBanner — guided onboarding banner for new client users.
 * Shows a clear visual hierarchy with numbered steps so users
 * know exactly what to do first. Dismissible via localStorage.
 */
export default function WelcomeBanner({ ticketCount = 0, onScrollToCreate }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === 'true'
  )

  if (dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  const isNewUser = ticketCount === 0

  return (
    <div className="relative mb-6 rounded-xl border border-blue-800/40 bg-gradient-to-br from-blue-950/60 via-gray-900 to-gray-900 p-6 shadow-lg overflow-hidden">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors z-10"
        title="Dismiss"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Decorative glow */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hero */}
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-white mb-1">
          {isNewUser ? 'Welcome to BlueClue Support!' : 'Welcome back!'}
        </h2>
        <p className="text-gray-400 text-sm max-w-lg">
          {isNewUser
            ? 'Get help fast — follow these steps to submit and track your first support request.'
            : 'Here\'s a quick reminder of how to get the most out of your dashboard.'}
        </p>
      </div>

      {/* Guided steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Step 1 */}
        <div className="flex items-start gap-3 bg-gray-800/60 rounded-lg p-4 border border-gray-700/50">
          <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
            1
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white mb-0.5">Create a Ticket</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Describe your issue using the form at the top of the dashboard, or pick a template.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-3 bg-gray-800/60 rounded-lg p-4 border border-gray-700/50">
          <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-600 text-white text-sm font-bold">
            2
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white mb-0.5">Track Progress</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Watch your ticket move through statuses in the timeline and ticket list below.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex items-start gap-3 bg-gray-800/60 rounded-lg p-4 border border-gray-700/50">
          <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-600 text-white text-sm font-bold">
            3
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white mb-0.5">Get Resolved</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              A technician will respond. You'll be notified of updates in real time.
            </p>
          </div>
        </div>
      </div>

      {/* CTA for new users */}
      {isNewUser && (
        <div className="mt-5">
          <button
            onClick={onScrollToCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Ticket
          </button>
        </div>
      )}
    </div>
  )
}
