import { Link, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { logout, isAuthenticated, getUser } from '../services/authService'
import logo from '../assets/EditedBlueClueLogo.png'

function Navbar() {
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef(null)
  const authenticated = isAuthenticated()
  const user = getUser()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
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

  return (
    <nav className="bg-gray-900 border-b border-gray-700 text-white px-4 md:px-6 py-3 md:py-4">
      <div className="flex items-center justify-between">
        {/* Logo + Desktop Nav */}
        <div className="flex items-center gap-4 md:gap-10">
          <Link to="/login" className="hover:opacity-80 transition-opacity bg-gray-200 rounded-lg p-1 flex-shrink-0">
            <img src={logo} alt="BlueClue Logo" className="h-10 md:h-16" />
          </Link>
          <div className="hidden md:block h-8 w-px bg-gray-700"></div>
          <div className="hidden md:flex items-center gap-8">
            {authenticated && (
              <>
                {(user?.role === 'customer' || user?.role === 'guest') && (
                  <Link to="/client-dashboard" className="text-gray-300 hover:text-white transition-colors">
                    Client Dashboard
                  </Link>
                )}
                {user?.role === 'technician' && (
                  <>
                    <Link to="/technician" className="text-gray-300 hover:text-white transition-colors">
                      All Tickets
                    </Link>
                    <Link to="/my-tickets" className="text-gray-300 hover:text-white transition-colors">
                      My Tickets
                    </Link>
                  </>
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
                <span className="text-gray-400 capitalize">{user?.role || 'Guest'}</span>
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
                    {!user?.isGuest && (
                      <>
                        <Link
                          to="/change-password"
                          onClick={() => setDropdownOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors rounded-t-lg"
                        >
                          🔒 Change Password
                        </Link>
                        <hr className="border-gray-700" />
                      </>
                    )}
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
            <Link
              to="/client-dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-800 transition-colors px-3 py-2 rounded-lg"
            >
              Client Dashboard
            </Link>
          )}
          {user?.role === 'technician' && (
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
    </nav>
  )
}

export default Navbar
