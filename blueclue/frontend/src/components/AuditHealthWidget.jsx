import { useState, useEffect, useCallback, useRef } from 'react'
import BaseWidget from './BaseWidget'
import { useToast } from '../hooks/useToast'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

/**
 * AuditHealthWidget
 * Displays real-time health status of audit logging systems.
 * Shows last entry timestamp and health indicators for each system.
 * Auto-refreshes every 60 seconds.
 * Management/admin only.
 */
function AuditHealthWidget() {
  const [healthData, setHealthData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const toast = useToast()
  const consecutiveFailuresRef = useRef(0)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('blueclue_token')
      if (!token) {
        throw new Error('Authentication token not found')
      }

      const response = await fetch(`${API_BASE_URL}/admin/audit-health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        let backendMessage = ''
        try {
          const errorData = await response.json()
          backendMessage = errorData?.message || ''
        } catch {
          backendMessage = ''
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error(backendMessage || 'Unauthorized: management/admin access required')
        }
        throw new Error(backendMessage || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch audit health')
      }

      consecutiveFailuresRef.current = 0
      setHealthData(data)
    } catch (err) {
      consecutiveFailuresRef.current += 1
      // Only log/toast on first failure to avoid console spam when backend is unavailable
      if (consecutiveFailuresRef.current === 1) {
        console.error('Audit health fetch error:', err)
        setError(err.message)
        toast.error(err.message)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchHealth()
    
    // Auto-refresh every 60 seconds; stop after 5 consecutive failures to avoid console spam
    const intervalId = setInterval(() => {
      if (consecutiveFailuresRef.current < 5) {
        fetchHealth()
      }
    }, 60000)
    
    return () => clearInterval(intervalId)
  }, [fetchHealth])

  const handleRefresh = useCallback(async () => {
    consecutiveFailuresRef.current = 0  // reset so polling resumes and errors are logged again
    await fetchHealth()
  }, [fetchHealth])

  // Format log type name for display
  const formatLogType = (logType) => {
    if (!logType) return 'Unknown'
    return logType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Get icon for health status
  const getHealthIcon = (isHealthy) => {
    if (isHealthy === null || isHealthy === undefined) {
      return <span className="text-gray-400 text-xl">⚪</span>
    }
    return isHealthy 
      ? <span className="text-green-400 text-xl">✅</span>
      : <span className="text-red-400 text-xl">❌</span>
  }

  // Get status text color
  const getStatusColor = (isHealthy) => {
    if (isHealthy === null || isHealthy === undefined) {
      return 'text-gray-400'
    }
    return isHealthy ? 'text-green-400' : 'text-red-400'
  }

  const renderContent = () => {
    if (loading && !healthData) {
      return (
        <div className="flex items-center justify-center h-full py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
            <p className="text-gray-400 text-sm">Loading audit health...</p>
          </div>
        </div>
      )
    }

    if (error && !healthData) {
      return (
        <div className="flex items-center justify-center h-full py-12">
          <div className="text-center">
            <p className="text-red-400 text-sm mb-2">⚠️ Error loading audit health</p>
            <p className="text-gray-500 text-xs max-w-xs mx-auto">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }

    if (!healthData || !healthData.health || healthData.health.length === 0) {
      return (
        <div className="flex items-center justify-center h-full py-12">
          <p className="text-gray-500 text-sm">No audit health data available</p>
        </div>
      )
    }

    const { health, overall_healthy } = healthData

    return (
      <div className="space-y-4">
        {/* Overall Status Card */}
        <div className={`p-4 rounded-lg border ${
          overall_healthy 
            ? 'bg-green-900/20 border-green-500/30' 
            : 'bg-red-900/20 border-red-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getHealthIcon(overall_healthy)}
              <div>
                <p className={`font-semibold ${getStatusColor(overall_healthy)}`}>
                  {overall_healthy ? 'All Systems Healthy' : 'System Issues Detected'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {overall_healthy 
                    ? 'All audit systems are logging correctly' 
                    : 'One or more audit systems need attention'}
                </p>
              </div>
            </div>
            {loading && (
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            )}
          </div>
        </div>

        {/* Individual System Status Cards */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-3">
            System Details
          </p>
          {health.map((system, index) => (
            <div
              key={system.log_type || index}
              className="p-3 bg-gray-700/50 rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getHealthIcon(system.is_healthy)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {formatLogType(system.log_type)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {system.time_since_last_entry || 'No entries yet'}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-xs text-gray-500">
                    {system.entry_count_24h !== null && system.entry_count_24h !== undefined
                      ? `${system.entry_count_24h} entries`
                      : 'No data'}
                  </p>
                  <p className={`text-xs font-medium mt-0.5 ${getStatusColor(system.is_healthy)}`}>
                    {system.is_healthy === null || system.is_healthy === undefined
                      ? 'No baseline'
                      : system.is_healthy 
                        ? 'Healthy' 
                        : 'Unhealthy'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Last Updated Timestamp */}
        <div className="text-center pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            Auto-refreshes every 60 seconds
          </p>
        </div>
      </div>
    )
  }

  return (
    <BaseWidget
      title="Audit Logging Health"
      subtitle="System monitoring status"
      icon="🔍"
      onRefresh={handleRefresh}
      className="h-full"
    >
      {renderContent()}
    </BaseWidget>
  )
}

export default AuditHealthWidget
