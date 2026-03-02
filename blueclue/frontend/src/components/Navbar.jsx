import { Link, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { logout, isAuthenticated, getUser } from '../services/authService'
import NotificationBell from './NotificationBell'
import NotificationDropdown from './NotificationDropdown'
import NotificationPreferences from './NotificationPreferences'
import TicketDetailView from './TicketDetailView'
import logo from '../assets/EditedBlueClueLogo.png'

function Navbar() {
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [ticketDetailId, setTicketDetailId] = useState(null)
  const [ticketDetailOpen, setTicketDetailOpen] = useState(false)
  const dropdownRef = useRef(null)
  const notificationDropdownRef = useRef(null)
  const notificationBellRef = useRef(null)
  const authenticated = isAuthenticated()
  const user = getUser()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
       if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target)) {
        setNotificationDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
    setDropdownOpen(false)
  }

  const handleLogoClick = () => {
    if (authenticated) {
      navigate('/welcome')
    } else {
      navigate('/login')
    }
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-700 text-white px-4 md:px-6 py-3 md:py-4">
      <div className="flex items-center justify-between">
        {/* Logo + Desktop Nav */}
        <div className="flex items-center gap-4 md:gap-10">
          <button onClick={handleLogoClick} className="hover:opacity-80 transition-opacity bg-gray-200 rounded-lg p-1 flex-shrink-0">
            <img src={logo} alt="BlueClue Logo" className="h-10 md:h-16" />
          </button>
          <div className="hidden md:block h-8 w-px bg-gray-700"></div>
          <div className="hidden md:flex items-center gap-8">
            {authenticated && (
              <>
                {user?.role === 'customer' && (
                  <>
                    <Link to="/client-dashboard" className="text-gray-300 hover:text-white transition-colors">
                      Client Dashboard
                    </Link>
                    <Link to="/faq" className="text-gray-300 hover:text-white transition-colors">
                      Help Center
                    </Link>
                  </>
                )}
                {['technician', 'senior_technician', 'admin'].includes(user?.role) && (
                  <>
                    <Link to="/technician" className="text-gray-300 hover:text-white transition-colors">
                      All Tickets
                    </Link>
                    <Link to="/my-tickets" className="text-gray-300 hover:text-white transition-colors">
                      My Tickets
                    </Link>
                    <Link to="/knowledge-base" className="text-gray-300 hover:text-white transition-colors">
                      Knowledge Base
                    </Link>
                  </>
                )}
                {(user?.role === 'management' || user?.role === 'admin') && (
                  <>
                    <Link to="/management-dashboard" className="text-gray-300 hover:text-white transition-colors">
                      Management Dashboard
                    </Link>
                    <Link to="/knowledge-base" className="text-gray-300 hover:text-white transition-colors">
                      Knowledge Base
                    </Link>
                    <Link to="/template-manager" className="text-gray-300 hover:text-white transition-colors">
                      Templates
                    </Link>
                  </>
                )}
                {['technician', 'senior_technician', 'management', 'admin'].includes(user?.role) && (
                  <Link to="/analytics" className="text-gray-300 hover:text-white transition-colors">
                    Analytics
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {authenticated ? (
            <>
              {/* Logged In User Info */}
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-300">
                <span>{user?.firstName || user?.fullName || user?.username || 'User'}</span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400 capitalize">{user?.role || 'User'}</span>
              </div>

            {/* Notification Bell & Dropdown */}
              <div className="relative" ref={notificationDropdownRef}>
                <NotificationBell 
                  ref={notificationBellRef}
                  onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)} 
                />
                <NotificationDropdown 
                  isOpen={notificationDropdownOpen}
                  onClose={() => setNotificationDropdownOpen(false)}
                  onNotificationUpdate={() => {
                    // Refresh the bell's unread count
                    if (notificationBellRef.current?.refresh) {
                      notificationBellRef.current.refresh();
                    }
                  }}
                  onTicketClick={(ticketId) => {
                    setTicketDetailId(ticketId);
                    setTicketDetailOpen(true);
                  }}
                />
              </div>

              {/* Account Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                    <button
                      onClick={() => {
                        setPreferencesOpen(true)
                        setDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors whitespace-nowrap"
                    >
                      🔔 Notification Settings
                    </button>
                    <Link
                      to="/change-password"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      🔒 Change Password
                    </Link>
                    <hr className="border-gray-700" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-950 transition-colors rounded-b-lg"
                    >
                      🚪 Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Login Button */
            <Link
              to="/login"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Sign In
            </Link>
          )}

          {/* Mobile Hamburger Button */}
          {authenticated && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {authenticated && mobileMenuOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-gray-700 flex flex-col gap-2">
          {/* User Info */}
          <div className="px-3 py-2 text-sm">
            <div className="text-white font-medium">{user?.firstName || user?.fullName || user?.username || 'User'}</div>
            <div className="text-gray-400 capitalize">{user?.role || 'Guest'}</div>
          </div>
          
          {(user?.role === 'customer' || user?.role === 'guest') && (
            <>
              <Link
                to="/client-dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
              >
                Client Dashboard
              </Link>
              <Link
                to="/faq"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
              >
                ❓ Help Center
              </Link>
            </>
          )}
          {['technician', 'senior_technician', 'admin'].includes(user?.role) && (
            <>
              <Link
                to="/technician"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
              >
                All Tickets
              </Link>
              <Link
                to="/my-tickets"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
              >
                My Tickets
              </Link>
            </>
          )}
          {(user?.role === 'management' || user?.role === 'admin') && (
            <>
              <Link
                to="/management-dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
              >
                Management Dashboard
              </Link>
              <Link
                to="/template-manager"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
              >
                Templates
              </Link>
            </>
          )}
          {['technician', 'senior_technician', 'management', 'admin'].includes(user?.role) && (
            <Link
              to="/analytics"
              onClick={() => setMobileMenuOpen(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
            >
              Analytics
            </Link>
          )}
          
          {!user?.isGuest && (
            <Link
              to="/change-password"
              onClick={() => setMobileMenuOpen(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
            >
              🔒 Change Password
            </Link>
          )}
          
          <button
            onClick={handleLogout}
            className="text-left text-red-400 hover:bg-red-950 transition-colors px-3 py-2 rounded-lg"
          >
            🚪 Logout
          </button>
        </div>
      )}
       {/* Notification Preferences Modal */}
      {preferencesOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800">
              <h2 className="text-2xl font-bold text-white">Notification Preferences</h2>
              <button
                onClick={() => setPreferencesOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <NotificationPreferences />
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail View - opened from notification clicks */}
      <TicketDetailView
        ticketId={ticketDetailId}
        isOpen={ticketDetailOpen}
        onClose={() => setTicketDetailOpen(false)}
      />
    </nav>
  )
}

export default Navbar
