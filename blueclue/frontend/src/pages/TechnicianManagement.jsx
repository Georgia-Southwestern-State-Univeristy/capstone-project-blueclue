import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../hooks/useToast'
import InviteTechnicianForm from '../components/InviteTechnicianForm'
import LoadingSpinner from '../components/LoadingSpinner'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

/**
 * TechnicianManagement Component
 * Displays list of technicians and allows managers/admins to invite new ones
 */
function TechnicianManagement() {
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const toast = useToast()

  const fetchTechnicians = useCallback(async () => {
    try {
      const token = localStorage.getItem('blueclue_token')
      const response = await axios.get(`${API_BASE_URL}/api/admin/technicians`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setTechnicians(response.data.data || [])
    } catch (err) {
      console.error('Failed to fetch technicians:', err)
      toast.error('Failed to load technician list')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchTechnicians()
  }, [fetchTechnicians])

  const handleInviteSuccess = (newTechnician) => {
    setTechnicians(prev => [newTechnician, ...prev])
    setShowInviteForm(false)
    fetchTechnicians() // Refresh the list
  }

  const formatRole = (role) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-red-900 text-red-200 border-red-700'
      case 'management':
        return 'bg-purple-900 text-purple-200 border-purple-700'
      case 'senior_technician':
        return 'bg-blue-900 text-blue-200 border-blue-700'
      case 'technician':
        return 'bg-green-900 text-green-200 border-green-700'
      default:
        return 'bg-gray-900 text-gray-200 border-gray-700'
    }
  }

  // Filter technicians based on search and role filter
  const filteredTechnicians = technicians.filter(tech => {
    const matchesSearch = 
      tech.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tech.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tech.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tech.username?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesRole = roleFilter === 'all' || tech.role === roleFilter

    return matchesSearch && matchesRole
  })

  if (loading) {
    return <LoadingSpinner message="Loading technicians..." />
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Technician Management</h1>
          <p className="text-gray-400 mt-2">Manage team members and invite new technicians</p>
        </div>
        {!showInviteForm && (
          <button
            onClick={() => setShowInviteForm(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite Technician
          </button>
        )}
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <InviteTechnicianForm
          onSuccess={handleInviteSuccess}
          onCancel={() => setShowInviteForm(false)}
        />
      )}

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
            <div className="relative">
              <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Role Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="technician">Technician</option>
              <option value="senior_technician">Senior Technician</option>
              <option value="management">Management</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Technician List */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Username</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Last Login</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredTechnicians.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                    {searchQuery || roleFilter !== 'all' ? (
                      <>
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        No technicians found matching your filters
                      </>
                    ) : (
                      <>
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        No technicians yet. Click "Invite Technician" to get started.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredTechnicians.map((tech) => (
                  <tr key={tech.id} className="hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{tech.first_name} {tech.last_name}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{tech.email}</td>
                    <td className="px-6 py-4">
                      <span className="text-gray-400 font-mono text-sm">{tech.username || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(tech.role)}`}>
                        {formatRole(tech.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {tech.is_active ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-900 text-green-200 border border-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {tech.last_login ? formatDate(tech.last_login) : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {formatDate(tech.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Total Team Members</div>
          <div className="text-2xl font-bold text-white mt-1">{technicians.length}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Technicians</div>
          <div className="text-2xl font-bold text-white mt-1">
            {technicians.filter(t => t.role === 'technician').length}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Senior Technicians</div>
          <div className="text-2xl font-bold text-white mt-1">
            {technicians.filter(t => t.role === 'senior_technician').length}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Management</div>
          <div className="text-2xl font-bold text-white mt-1">
            {technicians.filter(t => t.role === 'management' || t.role === 'admin').length}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TechnicianManagement
