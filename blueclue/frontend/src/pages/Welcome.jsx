import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getUser } from '../services/authService'

function Welcome() {
  const navigate = useNavigate()
  const [user] = useState(() => getUser())

  // Redirect management users to management dashboard
  useEffect(() => {
    if (user?.role === 'management') {
      navigate('/management-dashboard', { replace: true })
    }
  }, [user, navigate])

  if (!user) {
    return null
  }

  const isCustomer = user?.role === 'customer' || user?.role === 'guest'
  const isTechnician = user?.role === 'technician'
  const isManagement = user?.role === 'management'

  const userName = user?.firstName || user?.fullName || user?.username || 'User'

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-12 md:py-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">Welcome back, {userName}</h1>
          <p className="text-blue-100 text-lg">
            {isCustomer && "Manage your support tickets and track their progress in real-time"}
            {isTechnician && "View and manage assigned tickets to keep things running smoothly"}
            {isManagement && "Oversee operations and drive organizational efficiency"}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Quick Navigation - Featured */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isCustomer && (
              <Link
                to="/client-dashboard"
                className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-6 rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg flex items-center gap-3"
              >
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>My Support Tickets</span>
              </Link>
            )}
            {isTechnician && (
              <>
                <Link
                  to="/technician"
                  className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-6 rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg flex items-center gap-3"
                >
                  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>All Tickets</span>
                </Link>
                <Link
                  to="/my-tickets"
                  className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-6 rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg flex items-center gap-3"
                >
                  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7 12a5 5 0 1110 0A5 5 0 017 12z" />
                  </svg>
                  <span>My Assigned Tickets</span>
                </Link>
              </>
            )}
            {isManagement && (
              <Link
                to="/management-dashboard"
                className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-6 rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg flex items-center gap-3"
              >
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Management Dashboard</span>
              </Link>
            )}
          </div>
        </div>

        {/* User Info Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 mb-8 shadow-lg">
          <h2 className="text-xl font-semibold mb-6">Account Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-2">Name</p>
              <p className="text-lg font-medium">{userName}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-2">Account Type</p>
              <p className="text-lg font-medium capitalize">{user?.role || 'Guest'}</p>
            </div>
            {user?.email && (
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-2">Email</p>
                <p className="text-lg font-medium text-blue-400">{user.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Features/Benefits */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Platform Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-600 transition-colors">
              <svg className="w-8 h-8 mb-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <h3 className="font-semibold mb-2">Real-time Tracking</h3>
              <p className="text-gray-400 text-sm">Monitor ticket status updates instantly</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-600 transition-colors">
              <svg className="w-8 h-8 mb-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="font-semibold mb-2">Communication</h3>
              <p className="text-gray-400 text-sm">Stay connected with support teams</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-600 transition-colors">
              <svg className="w-8 h-8 mb-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="font-semibold mb-2">Management</h3>
              <p className="text-gray-400 text-sm">Efficiently manage and organize tickets</p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Ready to Get Started?</h2>
          <p className="text-gray-300 mb-6">
            {isCustomer && "Create a new support ticket or check the status of your existing requests to get the help you need."}
            {isTechnician && "Access your ticket queue to stay on top of pending issues and provide excellent customer support."}
            {isManagement && "Access your management dashboard to oversee operations, manage teams, and drive organizational efficiency."}
          </p>
          {isCustomer && (
            <Link
              to="/client-dashboard"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Go to Dashboard →
            </Link>
          )}
          {isTechnician && (
            <Link
              to="/my-tickets"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              View My Tickets →
            </Link>
          )}
          {isManagement && (
            <Link
              to="/management-dashboard"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Go to Management Dashboard →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default Welcome
