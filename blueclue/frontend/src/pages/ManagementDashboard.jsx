import { useState, useEffect, useCallback } from 'react'
import LoadingSpinner from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import { getAllTickets } from '../services/ticketService'

/**
 * Management Dashboard
 * Main management interface for viewing and managing tickets, technicians, and analytics
 */
function ManagementDashboard() {
  // State management
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tickets, setTickets] = useState([])
  const [activeTab, setActiveTab] = useState('overview')

  // Summary statistics
  const [stats, setStats] = useState({
    totalTickets: 0,
    openTickets: 0,
    assignedTickets: 0,
    unassignedTickets: 0,
    overdueTickets: 0
  })

  // Fetch tickets on component mount
  useEffect(() => {
    fetchTickets()
  }, [])

  // Recalculate stats when tickets change
  useEffect(() => {
    if (tickets.length > 0) {
      calculateStats()
    }
  }, [tickets, calculateStats])

  const fetchTickets = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getAllTickets()
      setTickets(response.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load tickets')
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = useCallback(() => {
    const now = new Date()
    
    const openTickets = tickets.filter(t => t.status === 'open').length
    const assignedTickets = tickets.filter(t => t.assigned_to_name && t.assigned_to_name !== 'null').length
    const unassignedTickets = tickets.length - assignedTickets
    
    const overdueTickets = tickets.filter(t => {
      if (!t.due_date) return false
      const dueDate = new Date(t.due_date)
      return dueDate < now && t.status !== 'resolved' && t.status !== 'closed'
    }).length

    setStats({
      totalTickets: tickets.length,
      openTickets,
      assignedTickets,
      unassignedTickets,
      overdueTickets
    })
  }, [tickets])

  // Tab navigation items
  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'tickets', label: 'Ticket Management', icon: '🎫' },
    { id: 'team', label: 'Team Management', icon: '👥' },
    { id: 'analytics', label: 'Analytics', icon: '📈' }
  ]

  // Render summary stat card
  const StatCard = ({ title, value, subtitle, bgColor = 'bg-gray-800' }) => (
    <div className={`${bgColor} rounded-lg p-4 border border-gray-700 shadow-sm`}>
      <h3 className="text-gray-400 text-sm font-medium mb-2">{title}</h3>
      <p className="text-3xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-gray-500 text-xs mt-2">{subtitle}</p>}
    </div>
  )

  // Render loading state
  if (loading && tickets.length === 0) {
    return (
      <div className="p-4 md:p-8 bg-gray-950 min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Management Dashboard</h1>
        <p className="text-gray-400">
          Monitor and manage all support tickets, technician assignments, and system analytics.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6">
          <Alert 
            type="error" 
            message={error}
            onClose={() => setError(null)}
          />
        </div>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard 
          title="Total Tickets" 
          value={stats.totalTickets}
          bgColor="bg-blue-900 bg-opacity-30 border-blue-700"
        />
        <StatCard 
          title="Open Tickets" 
          value={stats.openTickets}
          bgColor="bg-yellow-900 bg-opacity-30 border-yellow-700"
        />
        <StatCard 
          title="Assigned" 
          value={stats.assignedTickets}
          bgColor="bg-green-900 bg-opacity-30 border-green-700"
        />
        <StatCard 
          title="Unassigned" 
          value={stats.unassignedTickets}
          bgColor="bg-orange-900 bg-opacity-30 border-orange-700"
        />
        <StatCard 
          title="Overdue" 
          value={stats.overdueTickets}
          bgColor="bg-red-900 bg-opacity-30 border-red-700"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="mb-8 border-b border-gray-700 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content area */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6 min-h-96">
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Dashboard Overview</h2>
                <p className="text-gray-400 mb-6">
                  This is the overview tab. Real-time widgets and analytics will be displayed here.
                </p>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-gray-300">📊 Widget placeholder for analytics</p>
                  </div>
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-gray-300">📈 Widget placeholder for trends</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tickets' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Ticket Management</h2>
                <p className="text-gray-400 mb-6">
                  Assign tickets to technicians, view unassigned queue, and manage ticket assignments.
                </p>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-gray-300">🎫 Unassigned Tickets Widget</p>
                  </div>
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-gray-300">📋 Assignment Widget</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'team' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Team Management</h2>
                <p className="text-gray-400 mb-6">
                  View technician workload, performance metrics, and manage team assignments.
                </p>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-gray-300">👥 Team Workload Widget</p>
                  </div>
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-gray-300">⭐ Performance Metrics Widget</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Analytics & Reporting</h2>
                <p className="text-gray-400 mb-6">
                  Comprehensive analytics, trends, and performance reports.
                </p>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-gray-300">📊 Advanced Analytics Widget</p>
                  </div>
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-gray-300">📈 Reporting Widget</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick action sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6">
            <h3 className="text-xl font-bold text-white mb-4">Quick Actions</h3>
            
            <div className="space-y-3">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                ➕ Assign Ticket
              </button>
              
              <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                👥 Add Technician
              </button>
              
              <button className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                📄 Generate Report
              </button>
              
              <button className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                🔧 System Settings
              </button>
            </div>

            {/* Additional Info */}
            <div className="mt-8 pt-6 border-t border-gray-700">
              <h4 className="text-sm font-bold text-gray-400 mb-3">System Status</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Backend:</span>
                  <span className="text-green-400">● Online</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Database:</span>
                  <span className="text-green-400">● Connected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">AI Service:</span>
                  <span className="text-green-400">● Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagementDashboard
