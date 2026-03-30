import { useState, useEffect, useMemo } from 'react'
import { getDirectory } from '../services/userService'
import ProfileDetailView from '../components/ProfileDetailView'

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'management', label: 'Management' },
  { value: 'senior_technician', label: 'Senior Technician' },
  { value: 'technician', label: 'Technician' },
  { value: 'customer', label: 'Customer' },
]

const ROLE_COLORS = {
  admin: 'bg-red-500/20 text-red-400',
  management: 'bg-purple-500/20 text-purple-400',
  senior_technician: 'bg-blue-500/20 text-blue-400',
  technician: 'bg-cyan-500/20 text-cyan-400',
  customer: 'bg-green-500/20 text-green-400',
  guest: 'bg-gray-500/20 text-gray-400',
}

const formatRole = (role) => {
  return role?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown'
}

export default function AccountDirectory() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getDirectory({ role: roleFilter || undefined })
        setUsers(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [roleFilter])

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users
    const term = search.toLowerCase()
    return users.filter(u =>
      u.first_name?.toLowerCase().includes(term) ||
      u.last_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.username?.toLowerCase().includes(term) ||
      u.company?.toLowerCase().includes(term)
    )
  }, [users, search])

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Staff / Client Directory</h1>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, username, or company..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {ROLE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Count */}
        <p className="text-sm text-gray-400 mb-4">
          {filteredUsers.length} account{filteredUsers.length !== 1 ? 's' : ''} found
        </p>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 text-red-400">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          /* Table */
          <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-gray-300 text-left">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Username</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Company</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        No accounts found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => (
                      <tr key={user.id} onClick={() => setSelectedUser(user)} className="hover:bg-gray-800/50 transition-colors cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{user.first_name} {user.last_name}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{user.email}</td>
                        <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{user.username}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || ROLE_COLORS.guest}`}>
                            {formatRole(user.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{user.company || '—'}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${user.is_active ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                          <span className={user.is_active ? 'text-green-400' : 'text-gray-500'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ProfileDetailView
        user={selectedUser}
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  )
}
