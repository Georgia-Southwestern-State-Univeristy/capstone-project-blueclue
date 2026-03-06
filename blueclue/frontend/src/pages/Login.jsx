import { useState, useEffect, useContext } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { login as loginService, resendVerification, isAuthenticated, getUser } from '../services/authService'
import { ThemeContext } from '../context/ThemeContext'
import logo from '../assets/EditedBlueClueLogo.png'

/** Map a user role to their home dashboard */
function getRoleHome(role) {
  switch (role) {
    case 'management':
    case 'admin':
      return '/management-dashboard'
    case 'technician':
    case 'senior_technician':
      return '/technician'
    case 'customer':
    case 'guest':
    default:
      return '/client-dashboard'
  }
}

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { reloadFromServer } = useContext(ThemeContext)
  const [loginType, setLoginType] = useState('customer') // 'customer', 'technician', 'management'
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showResendVerification, setShowResendVerification] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState('')

  // ── If already authenticated, redirect to appropriate dashboard ─────────
  useEffect(() => {
    if (isAuthenticated()) {
      const user = getUser()
      const destination = location.state?.from || getRoleHome(user?.role)
      navigate(destination, { replace: true })
    }
  }, [navigate, location.state])

  // Check for messages from navigation state (e.g., from registration)
  useEffect(() => {
    if (location.state?.message) {
      if (location.state.type === 'verification-required') {
        setSuccessMessage(location.state.message)
        setUnverifiedEmail(location.state.email || '')
      } else {
        setSuccessMessage(location.state.message)
      }
      // Clear the message after displaying
      window.history.replaceState({}, document.title)
    }
  }, [location])

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('') // Clear error when user types
    setSuccessMessage('') // Clear success message when user types
    setShowResendVerification(false) // Hide resend button when user types
  }

  const handleResendVerification = async () => {
    setResendingEmail(true)
    setError('')
    setSuccessMessage('')

    try {
      await resendVerification(unverifiedEmail)
      setSuccessMessage('Verification email sent! Please check your inbox.')
      setShowResendVerification(false)
    } catch (err) {
      setError(err.message || 'Failed to resend verification email.')
    } finally {
      setResendingEmail(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setShowResendVerification(false)
    setLoading(true)

    try {
      let credentials = {}

      if (loginType === 'technician' || loginType === 'management') {
        credentials = {
          username: formData.username,
          password: formData.password
        }
      } else if (loginType === 'customer') {
        credentials = {
          email: formData.email,
          password: formData.password
        }
      }

      const response = await loginService(credentials)

      // Check if technician needs to change password
      if (response.user?.forcePasswordChange) {
        navigate('/change-password', { 
          state: { 
            message: 'You must change your password before continuing.',
            firstLogin: true 
          } 
        })
        return
      }

      // Reload theme from server for the newly signed-in user
      reloadFromServer()
      // Redirect all users to welcome page after login
      navigate('/welcome')

    } catch (err) {
      const errorMessage = err.message || 'Login failed. Please try again.'
      
      // Check if error is due to unverified email
      if (errorMessage.includes('verify your email')) {
        setError(errorMessage)
        setShowResendVerification(true)
        setUnverifiedEmail(formData.email)
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="BlueClue Logo" className="h-24 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to BlueClue</h1>
          <p className="text-gray-400">Sign in to access your support portal</p>
        </div>

        {/* Login Type Selector */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-1 mb-6 grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => setLoginType('customer')}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginType === 'customer'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => setLoginType('technician')}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginType === 'technician'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Technician
          </button>
          <button
            type="button"
            onClick={() => setLoginType('management')}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginType === 'management'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Management
          </button>
        </div>

        {/* Login Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Success Message */}
            {successMessage && (
              <div className="bg-green-900/20 border border-green-500 text-green-400 px-4 py-3 rounded-lg">
                {successMessage}
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
                <p>{error}</p>
                {showResendVerification && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendingEmail}
                    className="mt-3 w-full bg-red-700 hover:bg-red-600 text-white font-medium py-2 px-4 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resendingEmail ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                )}
              </div>
            )}

            {/* Technician & Management Login Fields */}
            {(loginType === 'technician' || loginType === 'management') && (
              <>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    placeholder={loginType === 'management' ? 'manager' : 'tnewc, cmcgo, or jwill'}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your password"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {/* Customer Login Fields */}
            {loginType === 'customer' && (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    placeholder="you@example.com"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your password"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>

            {/* Register Link (for customers only) */}
            {loginType === 'customer' && (
              <div className="text-center text-sm text-gray-400 pt-4 border-t border-gray-800">
                Don't have an account?{' '}
                <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
                  Create Account
                </Link>
              </div>
            )}
          </form>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>
            {loginType === 'technician' 
              ? 'Technicians: Use your assigned username and password'
              : loginType === 'management'
              ? 'Management: Contact your administrator for login credentials'
              : loginType === 'guest'
              ? 'Guest sessions expire after 24 hours of inactivity'
              : 'Protected by industry-standard encryption'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
