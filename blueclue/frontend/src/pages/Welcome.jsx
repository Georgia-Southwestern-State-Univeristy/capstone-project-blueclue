import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getUser } from '../services/authService'

function Welcome() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const currentUser = getUser()
    setUser(currentUser)
  }, [])

  if (!user) {
    return null
  }

  const isCustomer = user?.role === 'customer' || user?.role === 'guest'
  const isTechnician = user?.role === 'technician'

  const userName = user?.firstName || user?.fullName || user?.username || 'User'

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Welcome back, {userName}!</h1>
          <p className="text-blue-100 text-lg">
            {isCustomer && "Manage your support tickets and track their progress"}
            {isTechnician && "View and manage assigned tickets"}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* User Info Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-gray-400 text-sm mb-1">Name</p>
              <p className="text-lg font-medium">{userName}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Account Type</p>
              <p className="text-lg font-medium capitalize">{user?.role || 'Guest'}</p>
            </div>
            {user?.email && (
              <div>
                <p className="text-gray-400 text-sm mb-1">Email</p>
                <p className="text-lg font-medium">{user.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6">Quick Navigation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isCustomer && (
              <Link
                to="/client-dashboard"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
              >
                My Support Tickets
              </Link>
            )}
            {isTechnician && (
              <>
                <Link
                  to="/technician"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
                >
                  All Tickets
                </Link>
                <Link
                  to="/my-tickets"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
                >
                  My Assigned Tickets
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Additional Information */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-3">Need Help?</h2>
          <p className="text-gray-300">
            {isCustomer && "Click on 'My Support Tickets' to view, create, or track your support requests."}
            {isTechnician && "Use the navigation above to view all tickets or focus on your assigned tickets."}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Welcome
