import { useState } from 'react'
import { useToast } from '../hooks/useToast'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

/**
 * InviteTechnicianForm Component
 * Form for managers/admins to create new technician accounts
 */
function InviteTechnicianForm({ onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'technician'
  })
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Client-side validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('First name and last name are required')
      return
    }

    if (!formData.email.trim()) {
      toast.error('Email address is required')
      return
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address')
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem('blueclue_token')
      const response = await axios.post(
        `${API_BASE_URL}/api/admin/technicians`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      toast.success(`Technician account created successfully! Welcome email sent to ${formData.email}`)
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        role: 'technician'
      })

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(response.data.data)
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create technician account'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Invite Technician</h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-300 transition-colors"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 mb-2">
              First Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              required
              placeholder="John"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 mb-2">
              Last Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              required
              placeholder="Doe"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email Address <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            placeholder="john.doe@example.com"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Role Selection */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-2">
            Role Assignment <span className="text-red-400">*</span>
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="technician">Technician</option>
            <option value="senior_technician">Senior Technician</option>
            <option value="management">Management</option>
          </select>
          <p className="mt-2 text-sm text-gray-400">
            Select the appropriate role for this team member
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-950 border border-blue-800 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-blue-200">
              <p className="font-medium mb-1">What happens next:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-300">
                <li>A temporary password will be generated automatically</li>
                <li>Welcome email with login credentials will be sent immediately</li>
                <li>The new technician must change their password on first login</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Account...
              </span>
            ) : (
              '✉️ Create & Send Invitation'
            )}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default InviteTechnicianForm
