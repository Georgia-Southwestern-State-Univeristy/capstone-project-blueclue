import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { changePassword as changePasswordService } from '../services/authService'
import logo from '../assets/EditedBlueClueLogo.png'
import { useToast } from '../hooks/useToast'

function ChangePassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const firstLogin = location.state?.firstLogin || false
  const message = location.state?.message || ''

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState('')
  const toast = useToast()

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })

    // Check password strength for new password
    if (name === 'newPassword') {
      checkPasswordStrength(value)
    }
  }

  const checkPasswordStrength = (password) => {
    if (password.length === 0) {
      setPasswordStrength('')
    } else if (password.length < 8) {
      setPasswordStrength('weak')
    } else if (password.length >= 8 && password.length < 12) {
      setPasswordStrength('medium')
    } else if (password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      setPasswordStrength('strong')
    } else {
      setPasswordStrength('medium')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match.')
      return
    }

    if (formData.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.')
      return
    }

    if (!firstLogin && formData.currentPassword === formData.newPassword) {
      toast.error('New password must be different from current password.')
      return
    }

    setLoading(true)

    try {
      await changePasswordService(
        firstLogin ? undefined : formData.currentPassword,
        formData.newPassword
      )

      // Password changed successfully - redirect to login
      navigate('/login', {
        state: { message: 'Password changed successfully. Please login with your new password.' }
      })

    } catch (err) {
      toast.error(err.message || 'Password change failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak':
        return 'bg-red-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'strong':
        return 'bg-green-500'
      default:
        return 'bg-gray-700'
    }
  }

  const getPasswordStrengthWidth = () => {
    switch (passwordStrength) {
      case 'weak':
        return 'w-1/3'
      case 'medium':
        return 'w-2/3'
      case 'strong':
        return 'w-full'
      default:
        return 'w-0'
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="BlueClue Logo" className="h-20 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Change Password</h1>
          <p className="text-gray-400">
            {firstLogin ? 'Create a new secure password' : 'Update your account password'}
          </p>
        </div>

        {/* Change Password Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          {/* Info Message */}
          {message && (
            <div className="bg-yellow-900/20 border border-yellow-500 text-yellow-300 px-4 py-3 rounded-lg mb-6">
              {message}
            </div>
          )}

          {firstLogin && (
            <div className="bg-blue-900/20 border border-blue-500/50 text-blue-300 px-4 py-3 rounded-lg mb-6 text-sm">
              <strong>First Time Login:</strong> You must change your default password before continuing.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Current Password (only if not first login) */}
            {!firstLogin && (
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-2">
                  Current Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter current password"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
                New Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                required
                placeholder="Minimum 8 characters"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {/* Password Strength Indicator */}
              {formData.newPassword && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">Password Strength:</span>
                    <span className={`text-xs font-medium ${
                      passwordStrength === 'strong' ? 'text-green-400' :
                      passwordStrength === 'medium' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {passwordStrength.charAt(0).toUpperCase() + passwordStrength.slice(1)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full ${getPasswordStrengthColor()} ${getPasswordStrengthWidth()} transition-all duration-300`}></div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm New Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                placeholder="Re-enter new password"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Password Requirements */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-300 mb-2">Password Requirements:</p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li className="flex items-center">
                  <span className={formData.newPassword.length >= 8 ? 'text-green-400' : 'text-gray-500'}>
                    {formData.newPassword.length >= 8 ? '✓' : '○'}
                  </span>
                  <span className="ml-2">At least 8 characters long</span>
                </li>
                <li className="flex items-center">
                  <span className={/[A-Z]/.test(formData.newPassword) ? 'text-green-400' : 'text-gray-500'}>
                    {/[A-Z]/.test(formData.newPassword) ? '✓' : '○'}
                  </span>
                  <span className="ml-2">Contains uppercase letter (recommended)</span>
                </li>
                <li className="flex items-center">
                  <span className={/[0-9]/.test(formData.newPassword) ? 'text-green-400' : 'text-gray-500'}>
                    {/[0-9]/.test(formData.newPassword) ? '✓' : '○'}
                  </span>
                  <span className="ml-2">Contains number (recommended)</span>
                </li>
              </ul>
            </div>

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
                  Changing password...
                </span>
              ) : (
                'Change Password'
              )}
            </button>
          </form>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Your password will be encrypted and stored securely</p>
        </div>
      </div>
    </div>
  )
}

export default ChangePassword
