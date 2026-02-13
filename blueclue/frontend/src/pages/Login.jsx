import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login as loginService } from '../services/authService'
import logo from '../assets/EditedBlueClueLogo.png'

function Login() {
  const navigate = useNavigate()
  const [loginType, setLoginType] = useState('customer') // 'customer', 'technician', 'guest'
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    fullName: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('') // Clear error when user types
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let credentials = {}

      if (loginType === 'technician') {
        credentials = {
          username: formData.username,
          password: formData.password
        }
      } else if (loginType === 'customer') {
        credentials = {
          email: formData.email,
          password: formData.password
        }
      } else if (loginType === 'guest') {
        credentials = {
          email: formData.email,
          fullName: formData.fullName,
          isGuest: true
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

      // Redirect all users to welcome page after login
      navigate('/welcome')

    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
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
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-1 mb-6 flex gap-1">
          <button
            type="button"
            onClick={() => setLoginType('customer')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
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
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginType === 'technician'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Technician
          </button>
          <button
            type="button"
            onClick={() => setLoginType('guest')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginType === 'guest'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Guest
          </button>
        </div>

        {/* Login Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Technician Login Fields */}
            {loginType === 'technician' && (
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
                    placeholder="tnewc, cmcgo, or jwill"
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
                    placeholder="Default: admin123"
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

            {/* Guest Login Fields */}
            {loginType === 'guest' && (
              <>
                <div className="bg-blue-900/20 border border-blue-500/50 text-blue-300 px-4 py-3 rounded-lg text-sm">
                  <strong>Guest Access:</strong> Submit tickets without creating an account. Your session lasts 24 hours.
                </div>
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    placeholder="John Doe"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
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
              ? 'Technicians: Use your assigned username and default password admin123'
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
