import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import { LineChart, BarChart, StackedBarChart, Heatmap, MetricCard } from '../components/analytics'
import DonutChart from '../components/DonutChart'
import * as analyticsService from '../services/analyticsService'

/**
 * Analytics Dashboard
 * Comprehensive metrics, insights, and visualizations for management and technicians
 */
function AnalyticsDashboard() {
  const navigate = useNavigate()
  
  // User info
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Date range state
  const [datePreset, setDatePreset] = useState('month')
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' })
  const [showCustomRange, setShowCustomRange] = useState(false)
  
  // Analytics data
  const [dashboardData, setDashboardData] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  
  // Drill-down state
  const [drillDownFilter, setDrillDownFilter] = useState(null)
  const [drillDownTickets, setDrillDownTickets] = useState([])
  const [drillDownLoading, setDrillDownLoading] = useState(false)
  const [drillDownPage, setDrillDownPage] = useState(1)
  const [drillDownPagination, setDrillDownPagination] = useState(null)
  
  // Export state
  const [exporting, setExporting] = useState(false)

  // Check user authentication and role
  useEffect(() => {
    const userData = localStorage.getItem('blueclue_user')
    if (!userData) {
      navigate('/login')
      return
    }
    
    try {
      const user = JSON.parse(userData)
      setUserRole(user.role)
      
      // Only allow technicians, senior_technicians, management, and admin
      if (!['technician', 'senior_technician', 'management', 'admin'].includes(user.role)) {
        navigate('/client-dashboard')
      }
    } catch {
      navigate('/login')
    }
  }, [navigate])

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = showCustomRange 
        ? { startDate: customDateRange.start, endDate: customDateRange.end }
        : { preset: datePreset }
      
      const response = await analyticsService.getDashboardSummary(params)
      setDashboardData(response.data)
    } catch (err) {
      setError(err.message || 'Failed to load analytics data')
      console.error('Analytics fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [datePreset, customDateRange, showCustomRange])

  useEffect(() => {
    if (userRole) {
      fetchData()
    }
  }, [userRole, fetchData])

  // Drill-down handler
  const handleDrillDown = useCallback(async (filter) => {
    setDrillDownFilter(filter)
    setDrillDownLoading(true)
    setDrillDownPage(1)
    
    try {
      const params = {
        ...(showCustomRange 
          ? { startDate: customDateRange.start, endDate: customDateRange.end }
          : { preset: datePreset }),
        ...filter,
        page: 1,
        limit: 20
      }
      
      const response = await analyticsService.getTicketsByFilter(params)
      setDrillDownTickets(response.data.tickets)
      setDrillDownPagination(response.data.pagination)
    } catch (err) {
      console.error('Drill-down error:', err)
    } finally {
      setDrillDownLoading(false)
    }
  }, [datePreset, customDateRange, showCustomRange])

  // Load more drill-down results
  const loadMoreDrillDown = async () => {
    if (!drillDownPagination?.hasMore) return
    
    setDrillDownLoading(true)
    const nextPage = drillDownPage + 1
    
    try {
      const params = {
        ...(showCustomRange 
          ? { startDate: customDateRange.start, endDate: customDateRange.end }
          : { preset: datePreset }),
        ...drillDownFilter,
        page: nextPage,
        limit: 20
      }
      
      const response = await analyticsService.getTicketsByFilter(params)
      setDrillDownTickets(prev => [...prev, ...response.data.tickets])
      setDrillDownPagination(response.data.pagination)
      setDrillDownPage(nextPage)
    } catch (err) {
      console.error('Load more error:', err)
    } finally {
      setDrillDownLoading(false)
    }
  }

  // Export handler
  const handleExport = async (format, type = 'summary') => {
    setExporting(true)
    try {
      const params = {
        format,
        type,
        ...(showCustomRange 
          ? { startDate: customDateRange.start, endDate: customDateRange.end }
          : { preset: datePreset })
      }
      await analyticsService.downloadAnalytics(params)
    } catch (err) {
      setError(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  // Close drill-down modal
  const closeDrillDown = () => {
    setDrillDownFilter(null)
    setDrillDownTickets([])
    setDrillDownPagination(null)
  }

  // Date preset options
  const datePresets = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
  ]

  // Tab configuration
  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'resolution', label: 'Resolution Time', icon: '⏱️' },
    { id: 'volume', label: 'Ticket Volume', icon: '📈' },
    { id: 'performance', label: 'Tech Performance', icon: '👥' },
    ...(userRole === 'management' || userRole === 'admin' 
      ? [
          { id: 'categories', label: 'Categories', icon: '📁' },
          { id: 'sla', label: 'SLA Compliance', icon: '✅' },
        ] 
      : []
    ),
  ]

  // Note: formatDate is defined as a standalone function at the bottom of the file
  // for use by tab components

  // Check if user is tech only (limited view)
  const isTechOnly = userRole === 'technician' || userRole === 'senior_technician'

  // Render loading state
  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen bg-gray-950 p-4 md:p-8">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
            <p className="text-gray-400 mt-1">
              {isTechOnly ? 'Your performance metrics and insights' : 'Team performance metrics and insights'}
            </p>
          </div>
          
          {/* Date Range Selector and Export */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Preset Buttons */}
            <div className="flex flex-wrap gap-1 bg-gray-800 rounded-lg p-1">
              {datePresets.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => {
                    setDatePreset(preset.value)
                    setShowCustomRange(false)
                  }}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    datePreset === preset.value && !showCustomRange
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => setShowCustomRange(!showCustomRange)}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                  showCustomRange
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                Custom
              </button>
            </div>

            {/* Export Buttons */}
            {!isTechOnly && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exporting}
                  className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
                >
                  {exporting ? '...' : '📄'} CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  disabled={exporting}
                  className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
                >
                  {exporting ? '...' : '📄'} JSON
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {showCustomRange && (
          <div className="mt-4 flex flex-wrap items-center gap-3 bg-gray-800 rounded-lg p-3">
            <input
              type="date"
              value={customDateRange.start}
              onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={customDateRange.end}
              onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600"
            />
            <button
              onClick={fetchData}
              disabled={!customDateRange.start || !customDateRange.end}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} />
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Content */}
      {dashboardData && (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <OverviewTab 
              data={dashboardData} 
              isTechOnly={isTechOnly}
              onDrillDown={handleDrillDown}
            />
          )}

          {/* Resolution Time Tab */}
          {activeTab === 'resolution' && (
            <ResolutionTimeTab 
              data={dashboardData.resolution_time} 
              onDrillDown={handleDrillDown}
            />
          )}

          {/* Volume Tab */}
          {activeTab === 'volume' && (
            <TicketVolumeTab 
              data={dashboardData.ticket_volume}
              onDrillDown={handleDrillDown}
            />
          )}

          {/* Tech Performance Tab */}
          {activeTab === 'performance' && (
            <TechPerformanceTab 
              data={dashboardData.technician_performance}
              isTechOnly={isTechOnly}
              onDrillDown={handleDrillDown}
            />
          )}

          {/* Categories Tab (Management only) */}
          {activeTab === 'categories' && dashboardData.categories && (
            <CategoriesTab 
              data={dashboardData.categories}
              onDrillDown={handleDrillDown}
            />
          )}

          {/* SLA Compliance Tab (Management only) */}
          {activeTab === 'sla' && dashboardData.sla && (
            <SLATab 
              data={dashboardData.sla}
              onDrillDown={handleDrillDown}
            />
          )}
        </>
      )}

      {/* Drill-Down Modal */}
      {drillDownFilter && (
        <DrillDownModal
          filter={drillDownFilter}
          tickets={drillDownTickets}
          loading={drillDownLoading}
          pagination={drillDownPagination}
          onClose={closeDrillDown}
          onLoadMore={loadMoreDrillDown}
          onTicketClick={(ticket) => {
            // Navigate to ticket or open detail view
            navigate(`/management-dashboard?ticket=${ticket.id}`)
          }}
        />
      )}
    </div>
  )
}

// ============================================================================
// Tab Components
// ============================================================================

function OverviewTab({ data, isTechOnly, onDrillDown }) {
  const { resolution_time, ticket_volume, sla, additional } = data
  
  // Prepare status segments for donut chart
  const statusSegments = ticket_volume?.by_status ? [
    { label: 'Open', count: ticket_volume.by_status.open, color: '#60a5fa' },
    { label: 'In Progress', count: ticket_volume.by_status.in_progress, color: '#fbbf24' },
    { label: 'Waiting', count: ticket_volume.by_status.waiting_on_customer, color: '#a78bfa' },
    { label: 'Resolved', count: ticket_volume.by_status.resolved, color: '#34d399' },
    { label: 'Closed', count: ticket_volume.by_status.closed, color: '#6b7280' },
    { label: 'Cancelled', count: ticket_volume.by_status.cancelled, color: '#ef4444' },
  ] : []

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Total Tickets"
          value={ticket_volume?.total}
          color="blue"
          onClick={() => onDrillDown({})}
        />
        <MetricCard
          title="Avg Resolution Time"
          value={resolution_time?.overall?.avg_resolution_hours}
          format="hours"
          change={resolution_time?.comparison?.percent_change}
          color={resolution_time?.goal?.meets_goal ? 'green' : 'yellow'}
        />
        <MetricCard
          title="Open Tickets"
          value={ticket_volume?.by_status?.open}
          color="blue"
          onClick={() => onDrillDown({ status: 'open' })}
        />
        <MetricCard
          title="Reopen Rate"
          value={additional?.reopen?.rate}
          format="percent"
          color={additional?.reopen?.rate > 10 ? 'red' : 'green'}
        />
        {!isTechOnly && sla && (
          <>
            <MetricCard
              title="SLA Compliance"
              value={sla.overall?.resolution?.compliance_rate}
              format="percent"
              color={sla.overall?.resolution?.compliance_rate >= 90 ? 'green' : 'yellow'}
              onClick={() => onDrillDown({ slaBreach: 'true' })}
            />
            <MetricCard
              title="Cancellation Rate"
              value={additional?.cancellation?.rate}
              format="percent"
              color={additional?.cancellation?.rate > 5 ? 'yellow' : 'green'}
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <DonutChart 
          segments={statusSegments} 
          total={ticket_volume?.total}
        />

        {/* Resolution Time Trend */}
        <LineChart
          data={resolution_time?.trend || []}
          xKey="date"
          yKey="avg_hours"
          title="Resolution Time Trend"
          color="#3b82f6"
          formatX={formatDate}
          formatY={(v) => v?.toFixed(1)}
          unit="h"
          yLabel="Avg Hours"
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Avg Comments/Ticket"
          value={additional?.comments?.avg_per_ticket}
          color="gray"
        />
        <MetricCard
          title="Collaboration Rate"
          value={additional?.collaboration?.collaboration_rate}
          format="percent"
          color="purple"
        />
        <MetricCard
          title="Resolved (Period)"
          value={resolution_time?.overall?.total_resolved}
          color="green"
        />
        <MetricCard
          title="Median Resolution"
          value={resolution_time?.overall?.median_resolution_hours}
          format="hours"
          color="gray"
        />
      </div>
    </div>
  )
}

function ResolutionTimeTab({ data, onDrillDown }) {
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Average"
          value={data.overall?.avg_resolution_hours}
          format="hours"
          color="blue"
        />
        <MetricCard
          title="Median"
          value={data.overall?.median_resolution_hours}
          format="hours"
          color="gray"
        />
        <MetricCard
          title="Min"
          value={data.overall?.min_resolution_hours}
          format="hours"
          color="green"
        />
        <MetricCard
          title="Max"
          value={data.overall?.max_resolution_hours}
          format="hours"
          color="red"
        />
        <MetricCard
          title="Target (24h)"
          value={data.goal?.meets_goal ? 'Met' : 'Not Met'}
          subtitle={`${data.goal?.deviation_hours?.toFixed(1)}h ${data.goal?.deviation_hours > 0 ? 'over' : 'under'}`}
          color={data.goal?.meets_goal ? 'green' : 'yellow'}
        />
        <MetricCard
          title="vs Previous"
          value={data.comparison?.percent_change}
          format="percent"
          color={data.comparison?.trend_direction === 'improved' ? 'green' : 'red'}
          subtitle={data.comparison?.trend_direction}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <LineChart
          data={data.trend || []}
          xKey="date"
          yKey="avg_hours"
          title="Resolution Time Trend"
          color="#3b82f6"
          formatX={formatDate}
          unit="h"
        />

        {/* By Priority */}
        <BarChart
          data={data.by_priority || []}
          xKey="priority"
          yKey="avg_hours"
          title="Resolution Time by Priority"
          formatValue={(v) => `${v?.toFixed(1)}h`}
          colorMap={{
            critical: '#ef4444',
            high: '#f97316',
            medium: '#fbbf24',
            low: '#84cc16'
          }}
          onBarClick={(item) => onDrillDown({ priority: item.priority })}
        />
      </div>

      {/* By Category */}
      <BarChart
        data={data.by_category || []}
        xKey="category"
        yKey="avg_hours"
        title="Resolution Time by Category"
        horizontal
        formatValue={(v) => `${v?.toFixed(1)}h`}
        onBarClick={(item) => onDrillDown({ category: item.category })}
      />
    </div>
  )
}

function TicketVolumeTab({ data, onDrillDown }) {
  if (!data) return null

  // Stacked trend data is available via data.trend directly

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <MetricCard title="Total" value={data.total} color="blue" onClick={() => onDrillDown({})} />
        <MetricCard title="Open" value={data.by_status?.open} color="blue" onClick={() => onDrillDown({ status: 'open' })} />
        <MetricCard title="In Progress" value={data.by_status?.in_progress} color="yellow" onClick={() => onDrillDown({ status: 'in_progress' })} />
        <MetricCard title="Waiting" value={data.by_status?.waiting_on_customer} color="purple" onClick={() => onDrillDown({ status: 'waiting_on_customer' })} />
        <MetricCard title="Resolved" value={data.by_status?.resolved} color="green" onClick={() => onDrillDown({ status: 'resolved' })} />
        <MetricCard title="Closed" value={data.by_status?.closed} color="gray" onClick={() => onDrillDown({ status: 'closed' })} />
        <MetricCard title="Cancelled" value={data.by_status?.cancelled} color="red" onClick={() => onDrillDown({ status: 'cancelled' })} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume Trend */}
        <LineChart
          data={data.trend || []}
          xKey="date"
          yKey="created"
          yKey2="resolved_same_day"
          title="Daily Volume Trend"
          color="#3b82f6"
          color2="#10b981"
          formatX={formatDate}
          yLabel="Created"
          y2Label="Same-day Resolved"
        />

        {/* Month over Month */}
        <BarChart
          data={data.month_over_month || []}
          xKey="month"
          yKey="count"
          title="Month over Month"
          formatValue={(v) => v}
        />
      </div>

      {/* Heatmap */}
      <Heatmap
        data={data.heatmap || []}
        title="Request Activity Heatmap (by Day/Hour)"
        height={180}
      />

      {/* Peak Time Info */}
      {data.peak_time && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Peak Request Time</h4>
          <p className="text-lg text-white">
            <span className="font-bold">{data.peak_time.dayName}</span> at{' '}
            <span className="font-bold">{data.peak_time.hour}:00</span> -{' '}
            <span className="text-blue-400">{data.peak_time.count} tickets</span>
          </p>
        </div>
      )}
    </div>
  )
}

function TechPerformanceTab({ data, isTechOnly, onDrillDown }) {
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Team Averages */}
      {!isTechOnly && data.team_averages && (
        <div className="grid grid-cols-3 gap-4">
          <MetricCard
            title="Team Avg Resolution"
            value={data.team_averages.avg_resolution_hours}
            format="hours"
            color="blue"
          />
          <MetricCard
            title="Team Avg First Response"
            value={data.team_averages.avg_first_response_hours}
            format="hours"
            color="purple"
          />
          <MetricCard
            title="Team Avg Resolved"
            value={data.team_averages.avg_resolved}
            subtitle="per technician"
            color="green"
          />
        </div>
      )}

      {/* Leaderboard Chart */}
      {!isTechOnly && (
        <BarChart
          data={data.leaderboard?.map(t => ({
            label: t.tech_name,
            value: t.resolved,
            tech_id: t.tech_id
          })) || []}
          xKey="label"
          yKey="value"
          title="Top Performers (Tickets Resolved)"
          horizontal
          onBarClick={(item) => onDrillDown({ techId: item.tech_id })}
        />
      )}

      {/* Technician Table */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            {isTechOnly ? 'Your Performance' : 'Technician Performance'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                {!isTechOnly && <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">#</th>}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Technician</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Resolved</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Open</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Avg Resolution</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">First Response</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Reopen Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.technicians?.map((tech) => (
                <tr 
                  key={tech.tech_id} 
                  className="hover:bg-gray-800/50 cursor-pointer"
                  onClick={() => onDrillDown({ techId: tech.tech_id })}
                >
                  {!isTechOnly && (
                    <td className="px-4 py-3 text-sm text-gray-400">{tech.rank}</td>
                  )}
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-white">{tech.tech_name}</div>
                    <div className="text-xs text-gray-500">{tech.email}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 text-sm font-semibold text-green-400">{tech.resolved}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 text-sm text-blue-400">{tech.open_tickets}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-300">
                    {tech.avg_resolution_hours ? `${tech.avg_resolution_hours.toFixed(1)}h` : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-300">
                    {tech.avg_first_response_hours ? `${tech.avg_first_response_hours.toFixed(1)}h` : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-sm rounded ${
                      tech.reopen_rate > 10 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {tech.reopen_rate?.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CategoriesTab({ data, onDrillDown }) {
  if (!data) return null

  // pieData can be used for a PieChart if needed
  // const pieData = data.distribution?.map(c => ({
  //   label: c.display_name,
  //   value: c.count,
  //   category: c.category,
  //   color: c.color_code || undefined
  // })) || []

  return (
    <div className="space-y-6">
      {/* Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart
          data={data.distribution || []}
          xKey="display_name"
          yKey="count"
          title="Tickets by Category"
          horizontal
          onBarClick={(item) => onDrillDown({ category: item.category })}
        />

        <BarChart
          data={data.distribution || []}
          xKey="display_name"
          yKey="avg_resolution_hours"
          title="Avg Resolution Time by Category"
          horizontal
          formatValue={(v) => v ? `${v.toFixed(1)}h` : 'N/A'}
        />
      </div>

      {/* Growing/Declining Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Growing */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
          <h4 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
            <span>📈</span> Growing Categories
          </h4>
          {data.growing_categories?.length > 0 ? (
            <ul className="space-y-2">
              {data.growing_categories.map((c, i) => (
                <li key={i} className="flex justify-between items-center text-sm">
                  <span className="text-gray-300">{c.category.replace(/_/g, ' ')}</span>
                  <span className="text-green-400 font-semibold">+{c.growth}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No significant growth</p>
          )}
        </div>

        {/* Declining */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
          <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
            <span>📉</span> Declining Categories
          </h4>
          {data.declining_categories?.length > 0 ? (
            <ul className="space-y-2">
              {data.declining_categories.map((c, i) => (
                <li key={i} className="flex justify-between items-center text-sm">
                  <span className="text-gray-300">{c.category.replace(/_/g, ' ')}</span>
                  <span className="text-red-400 font-semibold">{c.decline}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No significant decline</p>
          )}
        </div>
      </div>

      {/* Category Comparison Table */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Period Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Category</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Current</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Previous</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.comparison?.map((cat, index) => (
                <tr key={index} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-sm text-white">{cat.category?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-300">{cat.current_count}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-300">{cat.previous_count}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-semibold ${
                      cat.percent_change > 0 ? 'text-green-400' : cat.percent_change < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {cat.percent_change !== null ? `${cat.percent_change > 0 ? '+' : ''}${cat.percent_change}%` : 'N/A'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SLATab({ data, onDrillDown }) {
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Response SLA Met"
          value={data.overall?.response?.compliance_rate}
          format="percent"
          color={data.overall?.response?.compliance_rate >= 90 ? 'green' : 'yellow'}
          subtitle={`${data.overall?.response?.met || 0} of ${data.overall?.response?.applicable || 0}`}
        />
        <MetricCard
          title="Response Breached"
          value={data.overall?.response?.breached}
          color="red"
          onClick={() => onDrillDown({ slaBreach: 'true' })}
        />
        <MetricCard
          title="Resolution SLA Met"
          value={data.overall?.resolution?.compliance_rate}
          format="percent"
          color={data.overall?.resolution?.compliance_rate >= 90 ? 'green' : 'yellow'}
          subtitle={`${data.overall?.resolution?.met || 0} of ${data.overall?.resolution?.applicable || 0}`}
        />
        <MetricCard
          title="Resolution Breached"
          value={data.overall?.resolution?.breached}
          color="red"
          onClick={() => onDrillDown({ slaBreach: 'true' })}
        />
      </div>

      {/* SLA Targets Info */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-400 mb-3">SLA Targets</h4>
        <div className="grid grid-cols-4 gap-4 text-center">
          {['critical', 'high', 'medium', 'low'].map(priority => (
            <div key={priority} className="bg-gray-900 rounded-lg p-3">
              <div className={`text-xs font-medium uppercase mb-1 ${
                priority === 'critical' ? 'text-red-400' :
                priority === 'high' ? 'text-orange-400' :
                priority === 'medium' ? 'text-yellow-400' : 'text-green-400'
              }`}>{priority}</div>
              <div className="text-sm text-gray-300">
                Response: {data.sla_targets?.response?.[priority]}h
              </div>
              <div className="text-sm text-gray-300">
                Resolution: {data.sla_targets?.resolution?.[priority]}h
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Breach Trend */}
      <LineChart
        data={data.trend || []}
        xKey="date"
        yKey="response_breaches"
        yKey2="resolution_breaches"
        title="SLA Breach Trend"
        color="#ef4444"
        color2="#f97316"
        formatX={formatDate}
        yLabel="Response"
        y2Label="Resolution"
      />

      {/* Breaches by Category */}
      <BarChart
        data={data.breaches_by_category || []}
        xKey="category"
        yKey="resolution_breaches"
        title="Resolution Breaches by Category"
        horizontal
        color="#f97316"
        onBarClick={(item) => onDrillDown({ category: item.category, slaBreach: 'true' })}
      />

      {/* Current Breaches Table */}
      {data.current_breaches?.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-red-900/50 overflow-hidden">
          <div className="p-4 border-b border-gray-700 bg-red-900/20">
            <h3 className="text-lg font-semibold text-red-400">
              🚨 Current SLA Breaches ({data.current_breaches.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ticket</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Subject</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Priority</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Hours Overdue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Assigned To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.current_breaches.slice(0, 10).map((ticket, index) => (
                  <tr key={index} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-sm text-blue-400 font-mono">{ticket.ticket_number}</td>
                    <td className="px-4 py-3 text-sm text-white truncate max-w-xs">{ticket.subject}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        ticket.priority === 'critical' ? 'bg-red-900 text-red-200' :
                        ticket.priority === 'high' ? 'bg-orange-900 text-orange-200' :
                        ticket.priority === 'medium' ? 'bg-yellow-900 text-yellow-200' :
                        'bg-green-900 text-green-200'
                      }`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-300">{ticket.breach_type}</td>
                    <td className="px-4 py-3 text-center text-sm text-red-400 font-semibold">
                      {ticket.hours_overdue?.toFixed(1)}h
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{ticket.assigned_to_name || 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Drill-Down Modal Component
// ============================================================================

function DrillDownModal({ filter, tickets, loading, pagination, onClose, onLoadMore, onTicketClick }) {
  // Build filter description
  const filterDescription = Object.entries(filter)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ') || 'All Tickets'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">Filtered Tickets</h3>
            <p className="text-sm text-gray-400">{filterDescription}</p>
            {pagination && (
              <p className="text-xs text-gray-500 mt-1">
                Showing {tickets.length} of {pagination.total} tickets
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-800 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ticket</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Subject</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Priority</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Hours Open</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Customer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {tickets.map((ticket, index) => (
                <tr 
                  key={index} 
                  className="hover:bg-gray-800/50 cursor-pointer"
                  onClick={() => onTicketClick(ticket)}
                >
                  <td className="px-4 py-3 text-sm text-blue-400 font-mono">{ticket.ticket_number}</td>
                  <td className="px-4 py-3 text-sm text-white truncate max-w-xs">{ticket.subject}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      ticket.status === 'open' ? 'bg-blue-900 text-blue-200' :
                      ticket.status === 'in_progress' ? 'bg-yellow-900 text-yellow-200' :
                      ticket.status === 'resolved' ? 'bg-green-900 text-green-200' :
                      ticket.status === 'closed' ? 'bg-gray-700 text-gray-300' :
                      'bg-red-900 text-red-200'
                    }`}>
                      {ticket.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      ticket.priority === 'critical' ? 'bg-red-900 text-red-200' :
                      ticket.priority === 'high' ? 'bg-orange-900 text-orange-200' :
                      ticket.priority === 'medium' ? 'bg-yellow-900 text-yellow-200' :
                      'bg-green-900 text-green-200'
                    }`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-300">
                    {ticket.hours_open?.toFixed(1)}h
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{ticket.customer_name}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading && (
            <div className="p-8 text-center">
              <LoadingSpinner />
            </div>
          )}
        </div>

        {/* Footer with Load More */}
        {pagination?.hasMore && (
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="w-full py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper function for date formatting
function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default AnalyticsDashboard
