import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/useToast'
import * as svc from '../services/mlAdminService'
import ExplainabilityPanel from '../components/ml/ExplainabilityPanel'

// ─── tiny helper components ────────────────────────────────────────────────
const Card = ({ title, children, className = '' }) => (
  <div className={`bg-gray-800 rounded-xl border border-gray-700 p-4 ${className}`}>
    {title && <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">{title}</h3>}
    {children}
  </div>
)

const Badge = ({ color = 'blue', children }) => {
  const colors = {
    green:  'bg-green-900 text-green-300',
    yellow: 'bg-yellow-900 text-yellow-300',
    red:    'bg-red-900 text-red-300',
    blue:   'bg-blue-900 text-blue-300',
    gray:   'bg-gray-700 text-gray-300',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.blue}`}>
      {children}
    </span>
  )
}

const Metric = ({ label, value, sub, color = 'default' }) => {
  const colors = { green: 'text-green-500', red: 'text-red-500', yellow: 'text-yellow-500', default: 'text-blue-400' }
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${colors[color] || colors.default}`}>{value ?? '—'}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
    </div>
  )
}

const ConfidenceBar = ({ value, max = 1 }) => {
  const pct = Math.round((value / max) * 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
    </div>
  )
}

const Spinner = () => (
  <div className="flex justify-center py-8">
    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
)

const TABS = ['Overview', 'Predictions', 'Feedback', 'Drift', 'Models', 'Retraining']

// ─── Main component ─────────────────────────────────────────────────────────
export default function MLAdminDashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('Overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Data state
  const [dashboard, setDashboard]               = useState(null)
  const [predictions, setPredictions]           = useState([])
  const [feedback, setFeedback]                 = useState(null)
  const [trainingSummary, setTrainingSummary]   = useState(null)
  const [pendingFeedback, setPendingFeedback]   = useState([])
  const [reviewLoading, setReviewLoading]       = useState(false)
  const [driftReports, setDriftReports]         = useState([])
  const [modelVersions, setModelVersions]       = useState(null)
  const [globalFeatures, setGlobalFeatures]     = useState(null)
  const [retrainRuns, setRetrainRuns]           = useState([])
  const [retrainRunsLoading, setRetrainRunsLoading] = useState(false)
  const retrainPollingRef = useRef(null)

  // Explainability row expansion
  const [explainRow, setExplainRow] = useState(null) // ticket index

  // Action state
  const [actionLoading, setActionLoading] = useState('')
  const [driftRunning, setDriftRunning]   = useState(false)
  const [driftLoading, setDriftLoading]   = useState(false)
  const [driftError, setDriftError]       = useState(null)

  // Drift automation state
  const [driftSettings, setDriftSettings]     = useState([])
  const [driftAlerts, setDriftAlerts]         = useState([])
  const [driftAlertsUnread, setDriftAlertsUnread] = useState(0)
  const [driftHistory, setDriftHistory]       = useState([])
  const [driftHistoryModel, setDriftHistoryModel] = useState('category')
  const [settingsEditing, setSettingsEditing] = useState({}) // { [modelType]: { ...fields } }
  const [settingsSaving, setSettingsSaving]   = useState('')  // modelType being saved

  // Auth guard
  useEffect(() => {
    const userData = localStorage.getItem('blueclue_user')
    if (!userData) { navigate('/login'); return }
    try {
      const user = JSON.parse(userData)
      if (!['admin', 'management'].includes(user.role)) {
        navigate('/management-dashboard')
      }
    } catch { navigate('/login') }
  }, [navigate])

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    try {
      setRefreshing(true)
      const data = await svc.getMLDashboard()
      setDashboard(data?.data || data)
    } catch (e) {
      toast.error('Failed to load ML dashboard: ' + e.message)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  // Refresh retraining run list
  const refreshRetrainRuns = useCallback(async () => {
    setRetrainRunsLoading(true)
    try {
      const r = await svc.getRetrainingRuns()
      setRetrainRuns(r?.data || [])
    } catch { /* silent */ } finally {
      setRetrainRunsLoading(false)
    }
  }, [])

  // Poll every 5s while any run is still "running"
  useEffect(() => {
    const hasRunning = retrainRuns.some(r => r.status === 'running')
    if (!hasRunning) return
    const id = setInterval(refreshRetrainRuns, 5000)
    return () => clearInterval(id)
  }, [retrainRuns, refreshRetrainRuns])

  // Cleanup polling on unmount
  useEffect(() => () => { if (retrainPollingRef.current) clearInterval(retrainPollingRef.current) }, [])

  // Load drift reports (used on tab open and after each run)
  const loadDriftReports = useCallback(async () => {
    setDriftLoading(true)
    setDriftError(null)
    try {
      const r = await svc.getDriftReports({ limit: 20 })
      setDriftReports(r?.data || [])
    } catch (e) {
      setDriftError('Failed to load drift reports: ' + e.message)
    } finally {
      setDriftLoading(false)
    }
  }, [])

  // Lazy tab loaders
  useEffect(() => {
    if (activeTab === 'Predictions' && predictions.length === 0) {
      svc.getRecentPredictions(100)
        .then(r => setPredictions(r?.data || []))
        .catch(e => {
          console.error('Failed to load predictions:', e)
          toast.error('Failed to load predictions: ' + (e.message || 'Unknown error'))
        })
    }
    if (activeTab === 'Feedback') {
      if (!feedback) {
        svc.getFeedback({ limit: 100 })
          .then(r => setFeedback(r?.data || r))
          .catch(e => {
            console.error('Failed to load feedback:', e)
            toast.error('Failed to load feedback: ' + (e.message || 'Unknown error'))
          })
      }
      if (!trainingSummary) {
        svc.getTrainingSummary()
          .then(r => setTrainingSummary(r?.data || r))
          .catch(e => console.error('Failed to load training summary:', e))
      }
      svc.getPendingFeedback(100)
        .then(r => setPendingFeedback(r?.data || []))
        .catch(e => console.error('Failed to load pending feedback:', e))
    }
    if (activeTab === 'Drift') {
      loadDriftReports()
      svc.getDriftSettings()
        .then(r => {
          const rows = r?.data || []
          setDriftSettings(rows)
          // Pre-populate editable copies
          const edits = {}
          rows.forEach(s => { edits[s.model_type] = { ...s } })
          setSettingsEditing(edits)
        })
        .catch(() => {})
      svc.getDriftAlerts({ acknowledged: false, limit: 20 })
        .then(r => { setDriftAlerts(r?.data || []); setDriftAlertsUnread(r?.unread_count ?? 0) })
        .catch(() => {})
      svc.getDriftHistory({ modelType: driftHistoryModel, limit: 60 })
        .then(r => setDriftHistory(r?.data || []))
        .catch(() => {})
    }
    if (activeTab === 'Models' && !modelVersions) {
      svc.getModelVersions()
        .then(r => setModelVersions(r?.data || r))
        .catch(e => {
          console.error('Failed to load model versions:', e)
          toast.error('Failed to load model versions: ' + (e.message || 'Unknown error'))
        })
      svc.getGlobalTopFeatures()
        .then(r => setGlobalFeatures(r?.data || r))
        .catch(() => {}) // non-critical – silently omit if unavailable
    }
    if (activeTab === 'Retraining') {
      refreshRetrainRuns()
    }
  }, [activeTab]) // eslint-disable-line

  // ── Action handlers ──────────────────────────────────────────────────────

  const handleRunDrift = async (modelType) => {
    setDriftRunning(true)
    try {
      const r = await svc.runDriftDetection(modelType, 30)
      toast.success(`Drift report for ${modelType}: drift ${r?.data?.drift_detected ? 'DETECTED' : 'none'}`)
    } catch (e) {
      toast.error('Drift detection failed: ' + e.message)
    } finally {
      setDriftRunning(false)
      // Always refresh the list so existing reports remain visible
      loadDriftReports()
      // Refresh alerts in case new one was created
      svc.getDriftAlerts({ acknowledged: false, limit: 20 })
        .then(r => { setDriftAlerts(r?.data || []); setDriftAlertsUnread(r?.unread_count ?? 0) })
        .catch(() => {})
      // Refresh history chart
      svc.getDriftHistory({ modelType: driftHistoryModel, limit: 60 })
        .then(r => setDriftHistory(r?.data || []))
        .catch(() => {})
    }
  }

  const handleAcknowledgeAlert = async (id) => {
    try {
      await svc.acknowledgeDriftAlert(id)
      setDriftAlerts(prev => prev.filter(a => a.id !== id))
      setDriftAlertsUnread(prev => Math.max(0, prev - 1))
      toast.success('Alert acknowledged')
    } catch (e) {
      toast.error('Failed to acknowledge: ' + e.message)
    }
  }

  const handleAcknowledgeAllAlerts = async () => {
    try {
      const r = await svc.acknowledgeAllDriftAlerts()
      setDriftAlerts([])
      setDriftAlertsUnread(0)
      toast.success(`Acknowledged ${r?.acknowledged_count ?? 0} alert(s)`)
    } catch (e) {
      toast.error('Failed: ' + e.message)
    }
  }

  const handleSaveDriftSettings = async (modelType) => {
    setSettingsSaving(modelType)
    try {
      const { data } = await svc.updateDriftSettings(modelType, settingsEditing[modelType])
      setDriftSettings(prev => prev.map(s => s.model_type === modelType ? data : s))
      toast.success(`Drift settings saved for ${modelType}`)
    } catch (e) {
      toast.error('Save failed: ' + e.message)
    } finally {
      setSettingsSaving('')
    }
  }

  const handleRetrain = async (opts) => {
    setActionLoading('retrain')
    try {
      const r = await svc.triggerRetraining(opts)
      toast.success(`Retraining started. Run ID: ${r?.data?.run_id}`)
      // Immediately refresh run list so the new row appears, then polling takes over
      await refreshRetrainRuns()
    } catch (e) {
      toast.error('Retraining failed: ' + e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleDeploy = async (modelType, version) => {
    if (!window.confirm(`Deploy ${modelType} version ${version}?`)) return
    setActionLoading(`deploy-${version}`)
    try {
      await svc.deployModel(modelType, version)
      toast.success(`Deployed ${modelType} v${version}`)
      svc.getModelVersions()
        .then(r => setModelVersions(r?.data || r))
        .catch(e => {
          console.error('Failed to refresh model versions after deploy:', e)
          // Don't show error to user since deploy succeeded - just log it
        })
    } catch (e) {
      toast.error('Deploy failed: ' + e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleRollback = async (modelType) => {
    if (!window.confirm(`Roll back ${modelType} to the previous version?`)) return
    setActionLoading(`rollback-${modelType}`)
    try {
      const r = await svc.rollbackModel(modelType)
      toast.success(r?.data?.message || 'Rollback complete')
      svc.getModelVersions()
        .then(r => setModelVersions(r?.data || r))
        .catch(e => {
          console.error('Failed to refresh model versions after rollback:', e)
          // Don't show error to user since rollback succeeded - just log it
        })
    } catch (e) {
      toast.error('Rollback failed: ' + e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleExport = async () => {
    try {
      const blob = await svc.exportPredictions()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `predictions_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error('Export failed: ' + e.message)
    }
  }

  // ── Feedback review handlers ──────────────────────────────────────────────

  const handleApproveFeedback = async (id) => {
    setReviewLoading(true)
    try {
      await svc.approveFeedback(id)
      setPendingFeedback(prev => prev.filter(f => f.id !== id))
      setTrainingSummary(null) // force refresh on next render
      toast.success('Feedback approved for training')
    } catch (e) {
      toast.error('Approve failed: ' + e.message)
    } finally {
      setReviewLoading(false)
    }
  }

  const handleRejectFeedback = async (id) => {
    setReviewLoading(true)
    try {
      await svc.rejectFeedback(id)
      setPendingFeedback(prev => prev.filter(f => f.id !== id))
      setTrainingSummary(null)
      toast.success('Feedback rejected from training')
    } catch (e) {
      toast.error('Reject failed: ' + e.message)
    } finally {
      setReviewLoading(false)
    }
  }

  const handleBulkApprove = async () => {
    if (!window.confirm(`Approve all ${pendingFeedback.length} pending feedback records for training?`)) return
    setReviewLoading(true)
    try {
      const r = await svc.bulkApproveFeedback()
      setPendingFeedback([])
      setTrainingSummary(null)
      toast.success(`Bulk approved ${r?.approved_count ?? 0} records`)
    } catch (e) {
      toast.error('Bulk approve failed: ' + e.message)
    } finally {
      setReviewLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><Spinner /></div>

  const mlMetrics   = dashboard?.ml_metrics    || {}
  const health      = dashboard?.ml_health     || {}
  const overrideStats = dashboard?.override_stats || {}
  const dailyStats  = dashboard?.daily_stats   || []
  const dbStats     = dashboard?.db_stats      || null

  // Prefer DB-backed stats (all-time, not reset on service restart) over in-memory counters
  const totalPredictions  = dbStats?.total_predictions  ?? mlMetrics.total_requests
  const avgConfidence     = dbStats?.avg_confidence     ?? mlMetrics.confidence?.mean
  const lowConfPct        = dbStats?.low_confidence_pct ?? mlMetrics.confidence?.low_confidence_pct
  const lowConfCount      = dbStats?.low_confidence_count ?? mlMetrics.confidence?.low_confidence_count ?? 0
  const catDist = (dbStats?.category_distribution && Object.keys(dbStats.category_distribution).length > 0)
    ? dbStats.category_distribution
    : mlMetrics.category_distribution

  const isHealthy = health.status === 'OK'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              ML Admin Dashboard
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Monitoring, explainability, model versioning and retraining
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge color={isHealthy ? 'green' : 'red'}>
              {isHealthy ? '● Live' : '● Degraded'}
            </Badge>
            <button
              onClick={loadDashboard}
              disabled={refreshing}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {refreshing ? 'Refreshing…' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 border-b border-gray-700 mb-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors
                ${activeTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* OVERVIEW TAB                                                      */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Overview' && (
          <div className="space-y-6">
            {/* Top metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <Metric
                  label="Total Requests"
                  value={totalPredictions?.toLocaleString() ?? '—'}
                  sub={`${mlMetrics.requests_per_minute ?? '—'} req/min`}
                />
              </Card>
              <Card>
                <Metric
                  label="Avg Confidence"
                  value={avgConfidence != null ? `${Math.round(avgConfidence * 100)}%` : '—'}
                  color={avgConfidence >= 0.7 ? 'green' : 'yellow'}
                />
              </Card>
              <Card>
                <Metric
                  label="Override Rate"
                  value={overrideStats.category_override_pct != null ? `${overrideStats.category_override_pct}%` : '—'}
                  color={parseFloat(overrideStats.category_override_pct) < 15 ? 'green' : 'red'}
                  sub="Target < 15%"
                />
              </Card>
              <Card>
                <Metric
                  label="Error Rate"
                  value={mlMetrics.error_rate_pct != null ? `${mlMetrics.error_rate_pct}%` : '—'}
                  color={parseFloat(mlMetrics.error_rate_pct) < 1 ? 'green' : 'red'}
                />
              </Card>
            </div>

            {/* Latency percentilessub = rows 2 */}
            <div className="grid grid-cols-3 gap-4">
              <Card title="Latency (ms)">
                <div className="space-y-2">
                  {['p50','p95','p99'].map(p => (
                    <div key={p} className="flex justify-between text-sm">
                      <span className="text-gray-400 uppercase text-xs font-mono">{p}</span>
                      <span className="font-semibold">{mlMetrics.latency_ms?.[p] ?? '—'} ms</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Models Loaded">
                <div className="space-y-2">
                  {['category','priority','time'].map(mt => {
                    const loaded = health.models_loaded?.[mt]
                    return (
                      <div key={mt} className="flex justify-between items-center text-sm">
                        <span className="capitalize text-gray-400">{mt}</span>
                        <Badge color={loaded ? 'green' : 'red'}>{loaded ? 'Loaded' : 'Missing'}</Badge>
                      </div>
                    )
                  })}
                </div>
              </Card>

              <Card title="Low Confidence">
                <div className="space-y-2">
                  <Metric
                    label="Predictions < 60%"
                    value={lowConfPct != null ? `${lowConfPct}%` : '—'}
                    color={parseFloat(lowConfPct) > 20 ? 'red' : 'green'}
                  />
                  <p className="text-xs text-gray-500 text-center">
                    {lowConfCount} of {totalPredictions ?? 0} total
                  </p>
                </div>
              </Card>
            </div>

            {/* Confidence histogram */}
            {mlMetrics.confidence?.histogram?.length > 0 && (
              <Card title="Confidence Score Distribution">
                <div className="flex items-end gap-1 h-24">
                  {mlMetrics.confidence.histogram.map((b, i) => {
                    const maxCount = Math.max(...mlMetrics.confidence.histogram.map(x => x.count), 1)
                    const height = Math.max(4, Math.round((b.count / maxCount) * 96))
                    const isLow = parseFloat(b.bucket) < 0.6
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${b.bucket}: ${b.count}`}>
                        <div
                          className={`w-full rounded-t transition-all ${isLow ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[9px] text-gray-500 hidden sm:block">{b.bucket.split('-')[0]}</span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-red-400 mt-2">
                  ← Red = low confidence (&lt;0.6). Target: keep below 20% of all predictions.
                </p>
              </Card>
            )}

            {/* Category distribution */}
            {catDist && Object.keys(catDist).length > 0 && (
              <Card title="Category Distribution (all-time)">
                <div className="space-y-2">
                  {Object.entries(catDist)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => {
                      const total = Object.values(catDist).reduce((s, v) => s + v, 0)
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="w-28 text-xs text-gray-400 capitalize truncate">{cat}</span>
                          <ConfidenceBar value={count} max={total} />
                          <span className="text-xs font-mono text-gray-500 w-10 text-right">{count}</span>
                        </div>
                      )
                    })}
                </div>
              </Card>
            )}

            {/* Daily rolling stats */}
            {dailyStats.length > 0 && (
              <Card title="Daily Predictions (last 30 days)">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-700">
                        <th className="text-left py-1">Date</th>
                        <th className="text-right py-1">Predictions</th>
                        <th className="text-right py-1">Avg Conf</th>
                        <th className="text-right py-1">Low Conf</th>
                        <th className="text-right py-1">Fallback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyStats.slice(0, 14).map((row, i) => (
                        <tr key={i} className="border-b border-gray-800 hover:bg-gray-700/30">
                          <td className="py-1">{row.day?.split('T')[0] ?? row.day}</td>
                          <td className="text-right py-1 font-mono">{row.predictions}</td>
                          <td className="text-right py-1 font-mono">{row.avg_confidence ? `${Math.round(row.avg_confidence * 100)}%` : '—'}</td>
                          <td className="text-right py-1 font-mono">{row.low_confidence_count ?? 0}</td>
                          <td className="text-right py-1 font-mono">{row.fallback_count ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* PREDICTIONS TAB                                                   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Predictions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-400">Last 100 AI classifications</p>
              <button onClick={handleExport} className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                ↓ Export JSON
              </button>
            </div>

            {predictions.length === 0 ? <Spinner /> : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-700 text-left">
                        <th className="py-2 pr-3">Ticket</th>
                        <th className="py-2 pr-3">Category</th>
                        <th className="py-2 pr-3">Priority</th>
                        <th className="py-2 pr-3">Confidence</th>
                        <th className="py-2 pr-3">Override?</th>
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2">Explain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.map((p, i) => (
                        <Fragment key={i}>
                          <tr className="border-b border-gray-800 hover:bg-gray-700/30">
                            <td className="py-1.5 pr-3">
                              <div className="font-mono text-blue-400">{p.ticket_number}</div>
                              <div className="text-gray-400 truncate max-w-[120px]">{p.subject}</div>
                            </td>
                            <td className="py-1.5 pr-3">
                              <span className="capitalize">{p.predicted_category}</span>
                              {p.category_overridden && (
                                <div className="text-orange-500">→ {p.user_category}</div>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 capitalize">{p.predicted_priority}</td>
                            <td className="py-1.5 pr-3">
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 bg-gray-700 rounded-full h-1">
                                  <div
                                    className={`h-1 rounded-full ${(p.confidence||0) >= 0.8 ? 'bg-green-500' : (p.confidence||0) >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.round((p.confidence||0)*100)}%` }}
                                  />
                                </div>
                                <span>{Math.round((p.confidence||0)*100)}%</span>
                              </div>
                            </td>
                            <td className="py-1.5 pr-3">
                              {(p.category_overridden || p.priority_overridden)
                                ? <Badge color="yellow">Overridden</Badge>
                                : p.fallback_used
                                ? <Badge color="gray">Fallback</Badge>
                                : <Badge color="green">Accepted</Badge>
                              }
                            </td>
                            <td className="py-1.5 pr-3 text-gray-400">{p.created_at?.split('T')[0]}</td>
                            <td className="py-1.5">
                              <button
                                onClick={() => setExplainRow(explainRow === i ? null : i)}
                                className="text-xs px-2 py-0.5 rounded bg-indigo-900 text-indigo-300 hover:bg-indigo-800 transition-colors"
                                title="Why did the AI choose this?"
                              >
                                {explainRow === i ? 'Hide' : 'Why?'}
                              </button>
                            </td>
                          </tr>
                          {explainRow === i && p.subject && (
                            <tr key={`explain-${i}`}>
                              <td colSpan={7} className="pb-3 pt-1 px-2">
                                <ExplainabilityPanel
                                  text={`${p.subject}${p.description ? ' ' + p.description : ''}`}
                                  prediction={p.predicted_category}
                                  confidence={p.confidence || 0}
                                  modelType="category"
                                  autoLoad={true}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* FEEDBACK TAB                                                      */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Feedback' && (
          <div className="space-y-4">
            {!feedback ? <Spinner /> : (
              <>
                {/* ── Training Summary ── */}
                {trainingSummary && (
                  <>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Training Feedback Summary</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <Card>
                        <Metric label="Total Overrides" value={trainingSummary.totals?.category_overrides ?? 0} />
                      </Card>
                      <Card>
                        <Metric
                          label="Overall Override Rate"
                          value={trainingSummary.totals?.overall_override_rate_pct != null
                            ? `${trainingSummary.totals.overall_override_rate_pct}%` : '—'}
                          color={parseFloat(trainingSummary.totals?.overall_override_rate_pct) < 15 ? 'green' : 'red'}
                        />
                      </Card>
                      <Card>
                        <Metric
                          label="Pending Review"
                          value={trainingSummary.pending_count ?? 0}
                          color={trainingSummary.pending_count > 0 ? 'yellow' : 'green'}
                        />
                      </Card>
                      <Card>
                        <Metric label="Approved for Training" value={trainingSummary.totals?.approved_for_training ?? 0} color="green" />
                      </Card>
                    </div>

                    {/* Override rate by category */}
                    {trainingSummary.by_category?.length > 0 && (
                      <Card title="Override Rate by Category">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500 border-b border-gray-700 text-left">
                                <th className="py-2 pr-3">Category</th>
                                <th className="py-2 pr-3">Overrides</th>
                                <th className="py-2 pr-3">Override %</th>
                                <th className="py-2 pr-3">Avg Confidence</th>
                                <th className="py-2 pr-3">Pending</th>
                                <th className="py-2">Approved</th>
                              </tr>
                            </thead>
                            <tbody>
                              {trainingSummary.by_category.map((row, i) => (
                                <tr key={i} className="border-b border-gray-800">
                                  <td className="py-1.5 pr-3 capitalize font-medium text-gray-200">{row.ai_category}</td>
                                  <td className="py-1.5 pr-3">{row.total_overrides}</td>
                                  <td className="py-1.5 pr-3">
                                    <Badge color={parseFloat(row.category_override_pct) > 20 ? 'red' : 'green'}>
                                      {row.category_override_pct}%
                                    </Badge>
                                  </td>
                                  <td className="py-1.5 pr-3 text-gray-400">{Math.round(row.avg_confidence * 100)}%</td>
                                  <td className="py-1.5 pr-3">
                                    {row.pending_review > 0
                                      ? <Badge color="yellow">{row.pending_review}</Badge>
                                      : <span className="text-gray-500">—</span>}
                                  </td>
                                  <td className="py-1.5 text-green-400">{row.approved_for_training}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    )}

                    {/* Most corrected categories */}
                    {trainingSummary.most_corrected?.length > 0 && (
                      <Card title="Most Corrected Categories (AI said → Technician changed to)">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500 border-b border-gray-700 text-left">
                                <th className="py-2 pr-3">AI Predicted</th>
                                <th className="py-2 pr-3">→ Corrected To</th>
                                <th className="py-2 pr-3">Count</th>
                                <th className="py-2">% of Corrections</th>
                              </tr>
                            </thead>
                            <tbody>
                              {trainingSummary.most_corrected.map((row, i) => (
                                <tr key={i} className="border-b border-gray-800">
                                  <td className="py-1.5 pr-3 capitalize text-red-400">{row.original_cat}</td>
                                  <td className="py-1.5 pr-3 capitalize text-green-400">{row.corrected_to}</td>
                                  <td className="py-1.5 pr-3">{row.correction_count}</td>
                                  <td className="py-1.5 text-gray-400">{row.pct_of_total}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    )}
                  </>
                )}

                {/* ── Stats row (existing) ── */}
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">All Feedback Stats</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card>
                    <Metric label="Total Feedback" value={feedback.stats?.total ?? 0} />
                  </Card>
                  <Card>
                    <Metric
                      label="Category Override %"
                      value={feedback.stats?.category_override_pct != null ? `${feedback.stats.category_override_pct}%` : '—'}
                      color={parseFloat(feedback.stats?.category_override_pct) < 15 ? 'green' : 'red'}
                    />
                  </Card>
                  <Card>
                    <Metric
                      label="Priority Override %"
                      value={feedback.stats?.priority_override_pct != null ? `${feedback.stats.priority_override_pct}%` : '—'}
                      color={parseFloat(feedback.stats?.priority_override_pct) < 15 ? 'green' : 'red'}
                    />
                  </Card>
                  <Card>
                    <Metric
                      label="Avg AI Confidence"
                      value={feedback.stats?.avg_ai_confidence != null ? `${Math.round(feedback.stats.avg_ai_confidence * 100)}%` : '—'}
                    />
                  </Card>
                </div>

                {/* Top override reasons */}
                {feedback.top_reasons?.length > 0 && (
                  <Card title="Top Override Reasons">
                    <ul className="space-y-1">
                      {feedback.top_reasons.map((r, i) => (
                        <li key={i} className="flex justify-between text-sm">
                          <span className="text-gray-300 italic">"{r.override_reason}"</span>
                          <Badge color="gray">{r.count}×</Badge>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* ── Pending review queue ── */}
                <Card title={`Pending Review Queue ${pendingFeedback.length > 0 ? `(${pendingFeedback.length} awaiting)` : ''}`}>
                  {pendingFeedback.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No feedback records awaiting review.</p>
                  ) : (
                    <>
                      <div className="flex justify-end mb-3">
                        <button
                          onClick={handleBulkApprove}
                          disabled={reviewLoading}
                          className="px-3 py-1.5 text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                        >
                          Approve All ({pendingFeedback.length})
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 border-b border-gray-700 text-left">
                              <th className="py-2 pr-3">Ticket</th>
                              <th className="py-2 pr-3">AI Category</th>
                              <th className="py-2 pr-3">→ New Category</th>
                              <th className="py-2 pr-3">Conf.</th>
                              <th className="py-2 pr-3">Reason</th>
                              <th className="py-2 pr-3">Technician</th>
                              <th className="py-2 pr-3">Date</th>
                              <th className="py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingFeedback.map((f) => (
                              <tr key={f.id} className="border-b border-gray-800">
                                <td className="py-1.5 pr-3 font-mono text-blue-400">{f.ticket_number}</td>
                                <td className="py-1.5 pr-3 capitalize text-red-300">{f.ai_category || '—'}</td>
                                <td className="py-1.5 pr-3 capitalize text-green-300">{f.user_category || '—'}</td>
                                <td className="py-1.5 pr-3 text-gray-400">
                                  {f.ai_confidence != null ? `${Math.round(f.ai_confidence * 100)}%` : '—'}
                                </td>
                                <td className="py-1.5 pr-3 italic text-gray-400 truncate max-w-[120px]">{f.override_reason || '—'}</td>
                                <td className="py-1.5 pr-3 text-gray-300">{f.technician_name || '—'}</td>
                                <td className="py-1.5 pr-3 text-gray-400">{f.created_at?.split('T')[0]}</td>
                                <td className="py-1.5 flex gap-1">
                                  <button
                                    onClick={() => handleApproveFeedback(f.id)}
                                    disabled={reviewLoading}
                                    className="px-2 py-1 text-[10px] bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded transition-colors"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleRejectFeedback(f.id)}
                                    disabled={reviewLoading}
                                    className="px-2 py-1 text-[10px] bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white rounded transition-colors"
                                  >
                                    Reject
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </Card>

                {/* Recent entries */}
                <Card title="Recent Feedback">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-700 text-left">
                          <th className="py-2 pr-3">Ticket</th>
                          <th className="py-2 pr-3">AI Category</th>
                          <th className="py-2 pr-3">User Category</th>
                          <th className="py-2 pr-3">Overridden?</th>
                          <th className="py-2 pr-3">Training Status</th>
                          <th className="py-2 pr-3">Reason</th>
                          <th className="py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(feedback.entries || []).slice(0, 50).map((f, i) => (
                          <tr key={i} className="border-b border-gray-800">
                            <td className="py-1.5 pr-3 font-mono text-blue-400">{f.ticket_number}</td>
                            <td className="py-1.5 pr-3 capitalize">{f.ai_category}</td>
                            <td className="py-1.5 pr-3 capitalize">{f.user_category || '(kept)'}</td>
                            <td className="py-1.5 pr-3">
                              {f.category_overridden ? <Badge color="yellow">Cat</Badge> : ''}
                              {f.priority_overridden ? <Badge color="yellow"> Pri</Badge> : ''}
                              {!f.category_overridden && !f.priority_overridden && <Badge color="green">Accepted</Badge>}
                            </td>
                            <td className="py-1.5 pr-3">
                              {f.training_status === 'approved' && <Badge color="green">Approved</Badge>}
                              {f.training_status === 'rejected' && <Badge color="red">Rejected</Badge>}
                              {(f.training_status === 'pending' || !f.training_status) && <Badge color="yellow">Pending</Badge>}
                            </td>
                            <td className="py-1.5 pr-3 italic text-gray-400 truncate max-w-[150px]">{f.override_reason || '—'}</td>
                            <td className="py-1.5 text-gray-400">{f.created_at?.split('T')[0]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* DRIFT TAB                                                         */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Drift' && (
          <div className="space-y-4">

            {/* ── Manual run buttons ──── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-3 flex-wrap">
                {['category', 'priority'].map(mt => (
                  <button
                    key={mt}
                    onClick={() => handleRunDrift(mt)}
                    disabled={driftRunning}
                    className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {driftRunning ? 'Running…' : `Run Now (${mt})`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                Drift is also checked automatically on the schedule configured below.
              </p>
            </div>

            {/* ── Unread alerts banner ──── */}
            {driftAlertsUnread > 0 && (
              <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 flex items-center justify-between gap-3">
                <p className="text-sm text-red-300">
                  ⚠️ {driftAlertsUnread} unread drift alert{driftAlertsUnread !== 1 ? 's' : ''} require your attention.
                </p>
                <button
                  onClick={handleAcknowledgeAllAlerts}
                  className="text-xs px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Acknowledge All
                </button>
              </div>
            )}

            {/* ── Drift Alerts Panel ──── */}
            {driftAlerts.length > 0 && (
              <Card title={`Drift Alerts (${driftAlerts.length} unacknowledged)`}>
                <div className="space-y-2">
                  {driftAlerts.map(a => (
                    <div key={a.id} className="flex items-start justify-between gap-3 bg-gray-700/40 rounded-lg p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge color={a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'yellow' : 'blue'}>
                            {a.severity}
                          </Badge>
                          <span className="text-xs text-gray-400 capitalize">{a.model_type}</span>
                          <span className="text-xs text-gray-500">{a.created_at?.split('T')[0]}</span>
                          {a.retrain_triggered && (
                            <Badge color={a.retrain_status === 'success' ? 'green' : a.retrain_status === 'failed' ? 'red' : 'blue'}>
                              retrain: {a.retrain_status ?? 'in progress'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-300 truncate">{a.message}</p>
                        {a.chi2_statistic != null && (
                          <p className="text-[10px] text-gray-500 mt-1">
                            χ²={a.chi2_statistic} (p={a.chi2_p_value})
                            {a.ks_statistic != null ? `  KS=${a.ks_statistic} (p=${a.ks_p_value})` : ''}
                            &nbsp;&bull;&nbsp;{a.sample_size} samples
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleAcknowledgeAlert(a.id)}
                        className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 text-gray-200 rounded transition-colors whitespace-nowrap"
                      >
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ── Drift Metric History Chart ──── */}
            {driftHistory.length > 0 && (
              <Card title={`Drift Metric History – ${driftHistoryModel}`}>
                <div className="flex gap-2 mb-3">
                  {['category', 'priority'].map(mt => (
                    <button
                      key={mt}
                      onClick={() => {
                        setDriftHistoryModel(mt)
                        svc.getDriftHistory({ modelType: mt, limit: 60 })
                          .then(r => setDriftHistory(r?.data || []))
                          .catch(() => {})
                      }}
                      className={`text-xs px-2 py-1 rounded-md transition-colors ${
                        driftHistoryModel === mt
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {mt}
                    </button>
                  ))}
                </div>
                {/* Simple SVG sparkline for chi2 p-values */}
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-1" style={{ minWidth: `${driftHistory.length * 14}px`, height: '64px' }}>
                    {driftHistory.map((r, i) => {
                      // bar height: high p-value (no drift) = tall green, low p-value (drift) = short red
                      const pVal = r.chi2_p_value ?? r.ks_p_value ?? 1
                      const heightPct = Math.round(Math.min(pVal, 1) * 100)
                      const isDrift = r.drift_detected
                      return (
                        <div
                          key={i}
                          title={`${r.report_date}  p=${pVal}  ${isDrift ? 'DRIFT' : 'OK'}`}
                          className={`flex-shrink-0 w-3 rounded-sm ${
                            isDrift ? 'bg-red-500' : 'bg-green-600'
                          }`}
                          style={{ height: `${Math.max(heightPct, 4)}%` }}
                        />
                      )
                    })}
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>{driftHistory[0]?.report_date}</span>
                  <span className="text-red-400">■ drift  </span>
                  <span className="text-green-500">■ no drift</span>
                  <span>{driftHistory[driftHistory.length - 1]?.report_date}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-2">Bar height = p-value (higher p = less drift). Hover for details.</p>
              </Card>
            )}

            {/* ── Recent drift reports list ──── */}
            {driftLoading ? (
              <Card><Spinner /></Card>
            ) : driftError ? (
              <Card>
                <p className="text-sm text-red-400 text-center py-4">{driftError}</p>
              </Card>
            ) : driftReports.length === 0 ? (
              <Card>
                <p className="text-sm text-gray-400 text-center py-4">
                  No drift reports yet. Run a drift check above or wait for the scheduled job.
                </p>
              </Card>
            ) : (
              <Card title="Recent Drift Reports">
                <div className="space-y-3">
                  {driftReports.map((r, i) => (
                    <div key={i} className="border border-gray-700 rounded-lg p-3">
                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge color={r.drift_detected ? 'red' : 'green'}>
                              {r.drift_detected ? 'Drift Detected' : 'No Drift'}
                            </Badge>
                            {r.alert_sent && <Badge color="yellow">alert sent</Badge>}
                            <span className="text-xs text-gray-400 capitalize">{r.model_type}</span>
                            <span className="text-xs text-gray-500">{r.report_date}</span>
                          </div>
                          <p className="text-xs text-gray-400">{r.notes}</p>
                        </div>
                        <div className="flex gap-4 text-xs">
                          {r.chi2_statistic != null && (
                            <div className="text-center">
                              <div className="font-mono font-bold text-gray-300">{r.chi2_statistic}</div>
                              <div className="text-gray-500">χ² (p={r.chi2_p_value})</div>
                            </div>
                          )}
                          {r.ks_statistic != null && (
                            <div className="text-center">
                              <div className="font-mono font-bold text-gray-300">{r.ks_statistic}</div>
                              <div className="text-gray-500">KS (p={r.ks_p_value})</div>
                            </div>
                          )}
                          <div className="text-center">
                            <div className="font-mono font-bold text-gray-300">{r.sample_size}</div>
                            <div className="text-gray-500">samples</div>
                          </div>
                        </div>
                      </div>

                      {/* Live distribution */}
                      {r.distribution && Object.keys(r.distribution).length > 0 && (
                        <div className="mt-3">
                          <p className="text-[10px] text-gray-500 mb-1.5">Live distribution vs baseline:</p>
                          <div className="space-y-1">
                            {Object.entries(r.distribution).sort((a,b)=>b[1]-a[1]).map(([label, count]) => {
                              const total = Object.values(r.distribution).reduce((s,v)=>s+v,0)
                              const baseCount = r.baseline_dist?.[label] || 0
                              const baseTotal = Object.values(r.baseline_dist||{}).reduce((s,v)=>s+v,0)
                              return (
                                <div key={label} className="flex items-center gap-2 text-xs">
                                  <span className="w-20 capitalize truncate text-gray-400">{label}</span>
                                  <div className="flex-1 flex items-center gap-1">
                                    <div title="Live" className="h-2 bg-blue-500 rounded" style={{ width: `${Math.round((count/Math.max(total,1))*120)}px` }} />
                                    {baseTotal > 0 && (
                                      <div title="Baseline" className="h-2 bg-gray-600 rounded" style={{ width: `${Math.round((baseCount/Math.max(baseTotal,1))*120)}px` }} />
                                    )}
                                  </div>
                                  <span className="text-gray-400 w-16">
                                    {Math.round((count/Math.max(total,1))*100)}% live
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">■ Blue = live  ■ Gray = training baseline</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ── Configurable Settings Panel ──── */}
            <Card title="Drift Detection Settings">
              {driftSettings.length === 0 ? (
                <p className="text-xs text-gray-500">Settings not loaded yet. Open this tab to load them.</p>
              ) : (
                <div className="space-y-6">
                  {driftSettings.map(s => {
                    const edit = settingsEditing[s.model_type] || s
                    const set  = (field, val) => setSettingsEditing(prev => ({
                      ...prev,
                      [s.model_type]: { ...(prev[s.model_type] || s), [field]: val }
                    }))
                    return (
                      <div key={s.model_type} className="border border-gray-700 rounded-lg p-4 space-y-3">
                        <h4 className="text-sm font-semibold text-gray-200 capitalize">{s.model_type} model</h4>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {/* P-value threshold */}
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">P-value threshold</label>
                            <input
                              type="number" step="0.01" min="0.01" max="0.2"
                              value={edit.p_value_threshold ?? 0.05}
                              onChange={e => set('p_value_threshold', parseFloat(e.target.value))}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          {/* Window days */}
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Window (days)</label>
                            <input
                              type="number" step="1" min="7" max="365"
                              value={edit.window_days ?? 30}
                              onChange={e => set('window_days', parseInt(e.target.value, 10))}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          {/* Min sample size */}
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Min sample size</label>
                            <input
                              type="number" step="5" min="10"
                              value={edit.min_sample_size ?? 30}
                              onChange={e => set('min_sample_size', parseInt(e.target.value, 10))}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          {/* Cron expression */}
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-gray-500 mb-1">CRON schedule (UTC)</label>
                            <input
                              type="text"
                              value={edit.cron_expression ?? '0 2 * * *'}
                              onChange={e => set('cron_expression', e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                              placeholder="0 2 * * *"
                            />
                            <p className="text-[9px] text-gray-600 mt-0.5">Default: 0 2 * * * = daily at 02:00 UTC</p>
                          </div>
                          {/* Schedule enabled */}
                          <div className="flex items-center gap-2 pt-4">
                            <input
                              type="checkbox"
                              id={`sched-${s.model_type}`}
                              checked={!!edit.schedule_enabled}
                              onChange={e => set('schedule_enabled', e.target.checked)}
                              className="accent-blue-500"
                            />
                            <label htmlFor={`sched-${s.model_type}`} className="text-xs text-gray-300">Schedule enabled</label>
                          </div>
                        </div>

                        <div className="border-t border-gray-700 pt-3">
                          <p className="text-[10px] text-gray-500 mb-2">Auto-retraining when drift is detected</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`auto-retrain-${s.model_type}`}
                                checked={!!edit.auto_retrain_enabled}
                                onChange={e => set('auto_retrain_enabled', e.target.checked)}
                                className="accent-purple-500"
                              />
                              <label htmlFor={`auto-retrain-${s.model_type}`} className="text-xs text-gray-300">Auto-retrain</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`auto-deploy-${s.model_type}`}
                                checked={!!edit.auto_deploy_on_retrain}
                                onChange={e => set('auto_deploy_on_retrain', e.target.checked)}
                                className="accent-green-500"
                              />
                              <label htmlFor={`auto-deploy-${s.model_type}`} className="text-xs text-gray-300">Auto-deploy if better</label>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-1">Min accuracy gain</label>
                              <input
                                type="number" step="0.01" min="0" max="0.5"
                                value={edit.retrain_threshold ?? 0.02}
                                onChange={e => set('retrain_threshold', parseFloat(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            onClick={() => handleSaveDriftSettings(s.model_type)}
                            disabled={settingsSaving === s.model_type}
                            className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                          >
                            {settingsSaving === s.model_type ? 'Saving…' : 'Save Settings'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* MODELS TAB                                                        */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Models' && (
          <div className="space-y-4">
            {!modelVersions ? <Spinner /> : (
              <>
                {/* Registry summary from Python */}
                {modelVersions.registry && Object.entries(modelVersions.registry).map(([mt, info]) => (
                  <Card key={mt} title={`${mt.charAt(0).toUpperCase() + mt.slice(1)} Model`}>
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Badge color="green">Active: {info.active_version || 'none'}</Badge>
                        {info.active_accuracy != null && (
                          <Badge color="blue">Accuracy: {Math.round(info.active_accuracy * 100)}%</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRollback(mt)}
                          disabled={!!actionLoading}
                          className="text-xs px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                        >
                          {actionLoading === `rollback-${mt}` ? 'Rolling back…' : 'Rollback'}
                        </button>
                      </div>
                    </div>

                    {/* Version table */}
                    {info.versions?.length > 0 && (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 border-b border-gray-700 text-left">
                            <th className="py-1.5 pr-3">Version</th>
                            <th className="py-1.5 pr-3">Accuracy</th>
                            <th className="py-1.5 pr-3">Registered</th>
                            <th className="py-1.5">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {info.versions.map((v, i) => (
                            <tr key={i} className={`border-b border-gray-800 ${v.is_active ? 'bg-green-950/20' : ''}`}>
                              <td className="py-1.5 pr-3 font-mono">{v.version}</td>
                              <td className="py-1.5 pr-3">{v.accuracy != null ? `${Math.round(v.accuracy * 100)}%` : '—'}</td>
                              <td className="py-1.5 pr-3 text-gray-400">{v.registered_at?.split('T')[0]}</td>
                              <td className="py-1.5">
                                {v.is_active ? (
                                  <Badge color="green">Active</Badge>
                                ) : (
                                  <button
                                    onClick={() => handleDeploy(mt, v.version)}
                                    disabled={!!actionLoading}
                                    className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded transition-colors"
                                  >
                                    {actionLoading === `deploy-${v.version}` ? '…' : 'Deploy'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Card>
                ))}

                {/* No versions in registry – show DB versions as fallback */}
                {(!modelVersions.registry || Object.keys(modelVersions.registry).length === 0) && (
                  <>
                    {modelVersions.db_versions?.length > 0 ? (
                      <Card title="Model Versions (Database Records)">
                        <p className="text-xs text-yellow-400 mb-3">
                          ⚠ Registry is empty – showing DB records. Restart the ML service to auto-populate the registry from trained model files.
                        </p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 border-b border-gray-700 text-left">
                              <th className="py-1.5 pr-3">Model Type</th>
                              <th className="py-1.5 pr-3">Version</th>
                              <th className="py-1.5 pr-3">Accuracy</th>
                              <th className="py-1.5">Registered</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modelVersions.db_versions.map((v, i) => (
                              <tr key={i} className="border-b border-gray-800">
                                <td className="py-1.5 pr-3 capitalize">{v.model_type}</td>
                                <td className="py-1.5 pr-3 font-mono">{v.version}</td>
                                <td className="py-1.5 pr-3">{v.accuracy != null ? `${Math.round(v.accuracy * 100)}%` : '—'}</td>
                                <td className="py-1.5 text-gray-400">{v.created_at?.split('T')[0]}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Card>
                    ) : (
                      <Card>
                        <p className="text-sm text-gray-400 text-center py-4">
                          No model versions registered yet.<br />
                          <span className="text-xs">Train models and run the pipeline to populate the registry.</span>
                        </p>
                      </Card>
                    )}
                  </>
                )}
              </>
            )}

            {/* ── Model Insights: Global Top Features ─────────────────── */}
            {globalFeatures && (Object.values(globalFeatures).some(v => v?.length > 0)) && (
              <Card title="Model Insights — Top Features Globally">
                <p className="text-xs text-gray-500 mb-4">
                  Most influential features across all predictions, derived from model feature importances.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {['category', 'priority'].map(mt => {
                    const features = globalFeatures[mt]
                    if (!features?.length) return null
                    const maxScore = features[0]?.score || 1
                    return (
                      <div key={mt}>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                          {mt.charAt(0).toUpperCase() + mt.slice(1)} Model
                        </h4>
                        <div className="space-y-2">
                          {features.slice(0, 10).map((f, i) => {
                            const pct = Math.min(100, Math.round((f.score / maxScore) * 100))
                            const color = pct >= 70 ? 'bg-blue-500' : pct >= 40 ? 'bg-blue-400' : 'bg-blue-300'
                            return (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-xs text-gray-300 w-28 truncate font-mono" title={f.feature}>
                                  {f.feature}
                                </span>
                                <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${color} transition-all duration-300`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* RETRAINING TAB                                                    */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Retraining' && (
          <div className="space-y-4">
            {/* Manual trigger */}
            <Card title="Trigger Manual Retraining">
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  Retraining will export new tickets from the database, retrain the selected models,
                  evaluate on a hold-out set, and optionally auto-deploy if accuracy improves by the
                  specified threshold.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleRetrain({ modelTypes: ['category', 'priority', 'time'], autoDeploy: false })}
                    disabled={actionLoading === 'retrain'}
                    className="px-5 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
                  >
                    {actionLoading === 'retrain' ? 'Starting…' : 'Retrain All Models'}
                  </button>
                  <button
                    onClick={() => handleRetrain({ modelTypes: ['category', 'priority', 'time'], autoDeploy: true, threshold: 0.02 })}
                    disabled={actionLoading === 'retrain'}
                    className="px-5 py-2.5 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
                  >
                    {actionLoading === 'retrain' ? 'Starting…' : 'Retrain + Auto-deploy (≥2%)'}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Retraining runs in the background. Check server logs or the run history below.
                </p>
              </div>
            </Card>

            {/* Run history */}
            <Card title="Retraining Run History" className="relative">
              <button
                onClick={refreshRetrainRuns}
                disabled={retrainRunsLoading}
                className="absolute top-3 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors disabled:opacity-40"
                title="Refresh run history"
              >
                <svg className={`w-4 h-4 ${retrainRunsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              {retrainRuns.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">{retrainRunsLoading ? 'Loading…' : 'No retraining runs yet.'}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-700 text-left">
                        <th className="py-2 pr-3">Run ID</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Models</th>
                        <th className="py-2 pr-3">Auto-deployed</th>
                        <th className="py-2 pr-3">Duration</th>
                        <th className="py-2">Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retrainRuns.map((r, i) => (
                        <tr key={i} className="border-b border-gray-800">
                          <td className="py-1.5 pr-3 font-mono text-blue-400">{r.id}</td>
                          <td className="py-1.5 pr-3">
                            <Badge color={r.status === 'success' ? 'green' : r.status === 'running' ? 'blue' : 'red'}>
                              {r.status}
                            </Badge>
                          </td>
                          <td className="py-1.5 pr-3">{r.model_types}</td>
                          <td className="py-1.5 pr-3">
                            <Badge color={r.auto_deployed ? 'green' : 'gray'}>{r.auto_deployed ? 'Yes' : 'No'}</Badge>
                          </td>
                          <td className="py-1.5 pr-3">{r.duration_seconds != null ? `${r.duration_seconds}s` : '—'}</td>
                          <td className="py-1.5 text-gray-400">{r.started_at?.split('T')[0]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

      </div>
    </div>
  )
}
