import { Link } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import logo from '../assets/EditedBlueClueLogo.png'

function Navbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

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

  return (
    <nav className="bg-gray-900 border-b border-gray-700 text-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="hover:opacity-80 transition-opacity bg-gray-200 rounded-lg p-1">
            <img src={logo} alt="BlueClue Logo" className="h-16" />
          </Link>
          <div className="h-8 w-px bg-gray-700"></div>
          <div className="flex items-center gap-8">
            <Link to="/customer" className="text-gray-300 hover:text-white transition-colors">Ticket Submission</Link>
            <Link to="/client-dashboard" className="text-gray-300 hover:text-white transition-colors">Client Dashboard</Link>
            <Link to="/technician" className="text-gray-300 hover:text-white transition-colors">Technician Dashboard</Link>
          </div>
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
              <a
                href="#"
                className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors rounded-t-lg"
              >
                👤 Account Settings
              </a>
              <a
                href="#"
                className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                ⚙️ Preferences
              </a>
              <a
                href="#"
                className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                ❓ Help
              </a>
              <hr className="border-gray-700" />
              <a
                href="#"
                className="block px-4 py-2 text-sm text-red-400 hover:bg-red-950 transition-colors rounded-b-lg"
              >
                🚪 Logout
              </a>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar