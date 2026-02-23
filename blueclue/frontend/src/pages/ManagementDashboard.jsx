import { useState, useEffect, useCallback } from 'react'
import LoadingSpinner from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import ManagementNav from '../components/ManagementNav'
import TicketControlWidget from '../components/TicketControlWidget'
import TicketTimeline from '../components/TicketTimeline'
import TicketDetailView from '../components/TicketDetailView'
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
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const handleTicketClick = (ticketId) => {
    setSelectedTicketId(ticketId)
    setIsDetailOpen(true)
  }

  // Summary statistics
  const [stats, setStats] = useState({
    totalTickets: 0,
    openTickets: 0,
    assignedTickets: 0,
    unassignedTickets: 0,
    overdueTickets: 0
  })

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

  // Fetch tickets on component mount
  useEffect(() => {
    fetchTickets()
  }, [])

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

  // Recalculate stats when tickets change
  useEffect(() => {
    if (tickets.length > 0) {
      calculateStats()
    }
  }, [tickets, calculateStats])

  // Tab navigation items
  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'O' },
    { id: 'tickets', label: 'Ticket Management', icon: 'T' },
    { id: 'team', label: 'Team Management', icon: 'M' },
    { id: 'analytics', label: 'Analytics', icon: 'A' }
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

      {/* Summary Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
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

      {/* Submission Timeline + Assignment Activity */}
      <div className="mb-8">
        <TicketTimeline tickets={tickets} onRefresh={fetchTickets} isRefreshing={loading} onTicketClick={handleTicketClick} />
      </div>

      {/* Ticket Control Widget */}
      <div className="mb-8">
        <TicketControlWidget tickets={tickets} onRefresh={fetchTickets} />
      </div>

      {/* Main Content Grid - Charts and Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column - Main Widgets (2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6">
              <h3 className="text-lg font-bold text-white mb-4">📊 Assignment Status</h3>
              <div className="h-48 flex items-center justify-center bg-gray-800 rounded border border-gray-700">
                <p className="text-gray-400">Chart Widget Placeholder</p>
              </div>
            </div>
            
            <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6">
              <h3 className="text-lg font-bold text-white mb-4">📈 Priority Breakdown</h3>
              <div className="h-48 flex items-center justify-center bg-gray-800 rounded border border-gray-700">
                <p className="text-gray-400">Chart Widget Placeholder</p>
              </div>
            </div>
          </div>

          {/* Tab Navigation - Using ManagementNav Component */}
          <ManagementNav activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />

          {/* Tab Content Section */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6">
            {activeTab === 'overview' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Dashboard Overview</h2>
                  <p className="text-gray-400">
                    Real-time view of system status, ticket metrics, and key performance indicators.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg border border-blue-700">
                    <p className="text-blue-300 font-medium mb-3">
                      Ticket Status Distribution
                    </p>
                    <p className="text-2xl font-bold text-white mb-2">{stats.openTickets}</p>
                    <p className="text-blue-200 text-sm">Open tickets requiring attention</p>
                    <div className="mt-3 w-full bg-blue-700 rounded h-1"></div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-purple-900 to-purple-800 rounded-lg border border-purple-700">
                    <p className="text-purple-300 font-medium mb-3">
                      Assignment Status
                    </p>
                    <p className="text-2xl font-bold text-white mb-2">{stats.assignedTickets} / {stats.totalTickets}</p>
                    <p className="text-purple-200 text-sm">Tickets assigned to technicians</p>
                    <div className="mt-3 w-full bg-purple-700 rounded h-1" style={{width: stats.totalTickets > 0 ? `${(stats.assignedTickets / stats.totalTickets) * 100}%` : '0%'}}></div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-red-900 to-red-800 rounded-lg border border-red-700">
                    <p className="text-red-300 font-medium mb-3">
                      Overdue Tickets
                    </p>
                    <p className="text-2xl font-bold text-white mb-2">{stats.overdueTickets}</p>
                    <p className="text-red-200 text-sm">Tickets past their due date</p>
                    <div className="mt-3 h-1 bg-red-700 rounded"></div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-green-900 to-green-800 rounded-lg border border-green-700">
                    <p className="text-green-300 font-medium mb-3">
                      System Health
                    </p>
                    <p className="text-2xl font-bold text-white mb-2">100%</p>
                    <p className="text-green-200 text-sm">All systems operational</p>
                    <div className="mt-3 w-full bg-green-700 rounded h-1"></div>
                  </div>
                </div>

                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <h3 className="font-bold text-white mb-3">Recent Activity</h3>
                  <p className="text-gray-400 text-sm">Activity log and recent changes will appear here</p>
                </div>
              </div>
            )}

            {activeTab === 'tickets' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Ticket Management</h2>
                  <p className="text-gray-400">
                    Manage ticket assignments, view unassigned queue, handle escalations, and track assignment activity.
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-orange-900 to-orange-800 rounded-lg border border-orange-700">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-orange-300 font-medium mb-1">
                          Bulk Assignment
                        </p>
                        <p className="text-gray-300 text-sm">Assign multiple tickets at once to technicians</p>
                      </div>
                    </div>
                    <button className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm font-medium">Start Bulk Assignment</button>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-purple-900 to-purple-800 rounded-lg border border-purple-700">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-purple-300 font-medium mb-1">
                          Reassignment Requests
                        </p>
                        <p className="text-gray-300 text-sm">Tickets flagged for reassignment review</p>
                      </div>
                      <span className="bg-purple-700 text-white px-3 py-1 rounded-full font-bold">0</span>
                    </div>
                    <button className="text-purple-200 hover:text-purple-100 text-sm font-medium">View Requests →</button>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-red-900 to-red-800 rounded-lg border border-red-700">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-red-300 font-medium mb-1">
                          Escalations
                        </p>
                        <p className="text-gray-300 text-sm">High-priority tickets requiring immediate attention</p>
                      </div>
                      <span className="bg-red-700 text-white px-3 py-1 rounded-full font-bold">0</span>
                    </div>
                    <button className="text-red-200 hover:text-red-100 text-sm font-medium">Review Escalations →</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'team' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Team Management</h2>
                  <p className="text-gray-400">
                    Monitor technician workload, performance metrics, and team capacity.
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <h3 className="font-bold text-white mb-4">
                      Technician Workload
                    </h3>
                    <p className="text-gray-400 mb-4">Total assigned: {stats.assignedTickets} tickets across team</p>
                    
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-700 rounded border border-gray-600">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-300">Technician workload heatmap</span>
                          <span className="text-xs text-gray-400">Widget placeholder</span>
                        </div>
                        <div className="h-20 bg-gray-600 rounded flex items-center justify-center text-gray-400">Chart area</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <h3 className="font-bold text-white mb-4">
                      Performance Metrics
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-gray-700 rounded border border-gray-600">
                        <p className="text-gray-300 text-sm mb-2">Avg Resolution Time</p>
                        <p className="text-lg font-bold text-white">-- hours</p>
                      </div>
                      <div className="p-3 bg-gray-700 rounded border border-gray-600">
                        <p className="text-gray-300 text-sm mb-2">Avg First Response</p>
                        <p className="text-lg font-bold text-white">-- minutes</p>
                      </div>
                      <div className="p-3 bg-gray-700 rounded border border-gray-600">
                        <p className="text-gray-300 text-sm mb-2">Satisfaction Rating</p>
                        <p className="text-lg font-bold text-white">-- / 5.0</p>
                      </div>
                      <div className="p-3 bg-gray-700 rounded border border-gray-600">
                        <p className="text-gray-300 text-sm mb-2">Tickets Resolved</p>
                        <p className="text-lg font-bold text-white">-- (30 days)</p>
                      </div>
                    </div>
                  </div>

                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                    View Detailed Team Report
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Analytics & Reporting</h2>
                  <p className="text-gray-400">
                    Comprehensive analytics, trends, performance reports, and business insights.
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <select className="px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm">
                      <option>Last 7 Days</option>
                      <option>Last 30 Days</option>
                      <option>Last 90 Days</option>
                      <option>This Year</option>
                      <option>Custom Range</option>
                    </select>
                    <button className="px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors">
                      📅 Custom Date
                    </button>
                  </div>

                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <h3 className="font-bold text-white mb-4">Ticket Volume Trends</h3>
                    <div className="h-48 bg-gray-700 rounded flex items-center justify-center text-gray-400">
                      Line chart placeholder - Ticket volume over time
                    </div>
                  </div>

                  <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <h3 className="font-bold text-white mb-4">Resolution Time Trends</h3>
                    <div className="h-48 bg-gray-700 rounded flex items-center justify-center text-gray-400">
                      Line chart placeholder - Average resolution time
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                      <h3 className="font-bold text-white mb-4">Tickets by Category</h3>
                      <div className="h-48 bg-gray-700 rounded flex items-center justify-center text-gray-400">
                        Pie chart placeholder
                      </div>
                    </div>

                    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                      <h3 className="font-bold text-white mb-4">Tickets by Status</h3>
                      <div className="h-48 bg-gray-700 rounded flex items-center justify-center text-gray-400">
                        Bar chart placeholder
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                      Export Report (PDF)
                    </button>
                    <button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                      Export Data (CSV)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Actions Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm p-6 sticky top-20">
            <h3 className="text-xl font-bold text-white mb-4">Quick Actions</h3>
            
            <div className="space-y-3 mb-8">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                <span>+</span>
                <span>Assign Ticket</span>
              </button>
              
              <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                <span>#</span>
                <span>Add Technician</span>
              </button>
              
              <button className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                <span>⬇</span>
                <span>Generate Report</span>
              </button>
              
              <button className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                <span>⚙</span>
                <span>Settings</span>
              </button>
            </div>

            {/* System Status Card */}
            <div className="pt-6 border-t border-gray-700">
              <h4 className="text-sm font-bold text-gray-400 mb-3">System Status</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                  <span className="text-gray-400">Backend</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-green-400">Online</span>
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                  <span className="text-gray-400">Database</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-green-400">Connected</span>
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                  <span className="text-gray-400">AI Service</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-green-400">Active</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Detail View Modal */}
      <TicketDetailView
        ticketId={selectedTicketId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onTicketUpdated={fetchTickets}
      />
    </div>
  )
}

export default ManagementDashboard
