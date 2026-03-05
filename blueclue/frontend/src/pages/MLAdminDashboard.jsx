import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as svc from '../services/mlAdminService'

// ─── tiny helper components ────────────────────────────────────────────────
const Card = ({ title, children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
    {title && <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">{title}</h3>}
    {children}
  </div>
)

const Badge = ({ color = 'blue', children }) => {
  const colors = {
    green:  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    red:    'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    gray:   'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.blue}`}>
      {children}
    </span>
  )
}

const Metric = ({ label, value, sub, color = 'default' }) => {
  const colors = { green: 'text-green-500', red: 'text-red-500', yellow: 'text-yellow-500', default: 'text-blue-600 dark:text-blue-400' }
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${colors[color] || colors.default}`}>{value ?? '—'}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</div>}
    </div>
  )
}

const ConfidenceBar = ({ value, max = 1 }) => {
  const pct = Math.round((value / max) * 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-400 w-10 text-right">{pct}%</span>
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
  const [activeTab, setActiveTab] = useState('Overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Data state
  const [dashboard, setDashboard]         = useState(null)
  const [predictions, setPredictions]     = useState([])
  const [feedback, setFeedback]           = useState(null)
  const [driftReports, setDriftReports]   = useState([])
  const [modelVersions, setModelVersions] = useState(null)
  const [retrainRuns, setRetrainRuns]     = useState([])

  // Action state
  const [actionLoading, setActionLoading] = useState('')
  const [actionMsg, setActionMsg]         = useState(null)
  const [driftRunning, setDriftRunning]   = useState(false)

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
      setError('Failed to load ML dashboard: ' + e.message)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  // Lazy tab loaders
  useEffect(() => {
    if (activeTab === 'Predictions' && predictions.length === 0) {
      svc.getRecentPredictions(100).then(r => setPredictions(r?.data || [])).catch(() => {})
    }
    if (activeTab === 'Feedback' && !feedback) {
      svc.getFeedback({ limit: 100 }).then(r => setFeedback(r?.data || r)).catch(() => {})
    }
    if (activeTab === 'Drift' && driftReports.length === 0) {
      svc.getDriftReports({ limit: 20 }).then(r => setDriftReports(r?.data || [])).catch(() => {})
    }
    if (activeTab === 'Models' && !modelVersions) {
      svc.getModelVersions().then(r => setModelVersions(r?.data || r)).catch(() => {})
    }
    if (activeTab === 'Retraining' && retrainRuns.length === 0) {
      svc.getRetrainingRuns().then(r => setRetrainRuns(r?.data || [])).catch(() => {})
    }
  }, [activeTab]) // eslint-disable-line

  // ── Action handlers ──────────────────────────────────────────────────────

  const handleRunDrift = async (modelType) => {
    setDriftRunning(true)
    setActionMsg(null)
    try {
      const r = await svc.runDriftDetection(modelType, 30)
      setActionMsg({ type: 'success', text: `Drift report for ${modelType}: drift ${r?.data?.drift_detected ? 'DETECTED' : 'none'}` })
      svc.getDriftReports({ limit: 20 }).then(r => setDriftReports(r?.data || [])).catch(() => {})
    } catch (e) {
      setActionMsg({ type: 'error', text: 'Drift detection failed: ' + e.message })
    } finally {
      setDriftRunning(false)
    }
  }

  const handleRetrain = async (opts) => {
    setActionLoading('retrain')
    setActionMsg(null)
    try {
      const r = await svc.triggerRetraining(opts)
      setActionMsg({ type: 'success', text: `Retraining started. Run ID: ${r?.data?.run_id}` })
    } catch (e) {
      setActionMsg({ type: 'error', text: 'Retraining failed: ' + e.message })
    } finally {
      setActionLoading('')
    }
  }

  const handleDeploy = async (modelType, version) => {
    if (!window.confirm(`Deploy ${modelType} version ${version}?`)) return
    setActionLoading(`deploy-${version}`)
    try {
      await svc.deployModel(modelType, version)
      setActionMsg({ type: 'success', text: `Deployed ${modelType} v${version}` })
      svc.getModelVersions().then(r => setModelVersions(r?.data || r)).catch(() => {})
    } catch (e) {
      setActionMsg({ type: 'error', text: 'Deploy failed: ' + e.message })
    } finally {
      setActionLoading('')
    }
  }

  const handleRollback = async (modelType) => {
    if (!window.confirm(`Roll back ${modelType} to the previous version?`)) return
    setActionLoading(`rollback-${modelType}`)
    try {
      const r = await svc.rollbackModel(modelType)
      setActionMsg({ type: 'success', text: r?.data?.message || 'Rollback complete' })
      svc.getModelVersions().then(r => setModelVersions(r?.data || r)).catch(() => {})
    } catch (e) {
      setActionMsg({ type: 'error', text: 'Rollback failed: ' + e.message })
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
      setActionMsg({ type: 'error', text: 'Export failed: ' + e.message })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><Spinner /></div>

  const mlMetrics   = dashboard?.ml_metrics    || {}
  const health      = dashboard?.ml_health     || {}
  const overrideStats = dashboard?.override_stats || {}
  const dailyStats  = dashboard?.daily_stats   || []

  const isHealthy = health.status === 'OK'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              ML Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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

        {/* Action message banner */}
        {actionMsg && (
          <div className={`mb-4 p-3 rounded-lg text-sm flex items-center justify-between
            ${actionMsg.type === 'success' ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
            <span>{actionMsg.text}</span>
            <button onClick={() => setActionMsg(null)} className="ml-3 opacity-60 hover:opacity-100">X</button>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors
                ${activeTab === tab
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
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
                  value={mlMetrics.total_requests?.toLocaleString() ?? '—'}
                  sub={`${mlMetrics.requests_per_minute ?? '—'} req/min`}
                />
              </Card>
              <Card>
                <Metric
                  label="Avg Confidence"
                  value={mlMetrics.confidence ? `${Math.round(mlMetrics.confidence.mean * 100)}%` : '—'}
                  color={mlMetrics.confidence?.mean >= 0.7 ? 'green' : 'yellow'}
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
                      <span className="text-gray-500 dark:text-gray-400 uppercase text-xs font-mono">{p}</span>
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
                        <span className="capitalize text-gray-600 dark:text-gray-400">{mt}</span>
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
                    value={mlMetrics.confidence?.low_confidence_pct != null ? `${mlMetrics.confidence.low_confidence_pct}%` : '—'}
                    color={parseFloat(mlMetrics.confidence?.low_confidence_pct) > 20 ? 'red' : 'green'}
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                    {mlMetrics.confidence?.low_confidence_count ?? 0} of {mlMetrics.total_requests ?? 0} total
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
                          className={`w-full rounded-t transition-all ${isLow ? 'bg-red-400 dark:bg-red-600' : 'bg-blue-400 dark:bg-blue-500'}`}
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[9px] text-gray-400 dark:text-gray-500 hidden sm:block">{b.bucket.split('-')[0]}</span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                  ← Red = low confidence (&lt;0.6). Target: keep below 20% of all predictions.
                </p>
              </Card>
            )}

            {/* Category distribution */}
            {mlMetrics.category_distribution && Object.keys(mlMetrics.category_distribution).length > 0 && (
              <Card title="Live Category Distribution">
                <div className="space-y-2">
                  {Object.entries(mlMetrics.category_distribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => {
                      const total = Object.values(mlMetrics.category_distribution).reduce((s, v) => s + v, 0)
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="w-28 text-xs text-gray-600 dark:text-gray-400 capitalize truncate">{cat}</span>
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
                      <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-1">Date</th>
                        <th className="text-right py-1">Predictions</th>
                        <th className="text-right py-1">Avg Conf</th>
                        <th className="text-right py-1">Low Conf</th>
                        <th className="text-right py-1">Fallback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyStats.slice(0, 14).map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Last 100 AI classifications</p>
              <button onClick={handleExport} className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                ↓ Export JSON
              </button>
            </div>

            {predictions.length === 0 ? <Spinner /> : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700 text-left">
                        <th className="py-2 pr-3">Ticket</th>
                        <th className="py-2 pr-3">Category</th>
                        <th className="py-2 pr-3">Priority</th>
                        <th className="py-2 pr-3">Confidence</th>
                        <th className="py-2 pr-3">Override?</th>
                        <th className="py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.map((p, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="py-1.5 pr-3">
                            <div className="font-mono text-blue-600 dark:text-blue-400">{p.ticket_number}</div>
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
                              <div className="w-12 bg-gray-200 dark:bg-gray-700 rounded-full h-1">
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
                          <td className="py-1.5 text-gray-400">{p.created_at?.split('T')[0]}</td>
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
        {/* FEEDBACK TAB                                                      */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Feedback' && (
          <div className="space-y-4">
            {!feedback ? <Spinner /> : (
              <>
                {/* Stats row */}
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
                          <span className="text-gray-700 dark:text-gray-300 italic">"{r.override_reason}"</span>
                          <Badge color="gray">{r.count}×</Badge>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Recent entries */}
                <Card title="Recent Feedback">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700 text-left">
                          <th className="py-2 pr-3">Ticket</th>
                          <th className="py-2 pr-3">AI Category</th>
                          <th className="py-2 pr-3">User Category</th>
                          <th className="py-2 pr-3">Overridden?</th>
                          <th className="py-2 pr-3">Reason</th>
                          <th className="py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(feedback.entries || []).slice(0, 50).map((f, i) => (
                          <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-1.5 pr-3 font-mono text-blue-600 dark:text-blue-400">{f.ticket_number}</td>
                            <td className="py-1.5 pr-3 capitalize">{f.ai_category}</td>
                            <td className="py-1.5 pr-3 capitalize">{f.user_category || '(kept)'}</td>
                            <td className="py-1.5 pr-3">
                              {f.category_overridden ? <Badge color="yellow">Cat</Badge> : ''}
                              {f.priority_overridden ? <Badge color="yellow"> Pri</Badge> : ''}
                              {!f.category_overridden && !f.priority_overridden && <Badge color="green">Accepted</Badge>}
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
            <div className="flex gap-3 flex-wrap">
              {['category', 'priority'].map(mt => (
                <button
                  key={mt}
                  onClick={() => handleRunDrift(mt)}
                  disabled={driftRunning}
                  className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {driftRunning ? 'Running…' : `Run Drift (${mt})`}
                </button>
              ))}
            </div>

            {driftReports.length === 0 ? (
              <Card>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No drift reports yet. Run a drift check above.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {driftReports.map((r, i) => (
                  <Card key={i}>
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge color={r.drift_detected ? 'red' : 'green'}>
                            {r.drift_detected ? 'Drift Detected' : 'No Drift'}
                          </Badge>
                          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{r.model_type}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{r.report_date}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{r.notes}</p>
                      </div>
                      <div className="flex gap-4 text-xs">
                        {r.chi2_statistic != null && (
                          <div className="text-center">
                            <div className="font-mono font-bold text-gray-700 dark:text-gray-300">{r.chi2_statistic}</div>
                            <div className="text-gray-400 dark:text-gray-500">χ² (p={r.chi2_p_value})</div>
                          </div>
                        )}
                        {r.ks_statistic != null && (
                          <div className="text-center">
                            <div className="font-mono font-bold text-gray-700 dark:text-gray-300">{r.ks_statistic}</div>
                            <div className="text-gray-400 dark:text-gray-500">KS (p={r.ks_p_value})</div>
                          </div>
                        )}
                        <div className="text-center">
                          <div className="font-mono font-bold text-gray-700 dark:text-gray-300">{r.sample_size}</div>
                          <div className="text-gray-400 dark:text-gray-500">samples</div>
                        </div>
                      </div>
                    </div>

                    {/* Live distribution */}
                    {r.distribution && Object.keys(r.distribution).length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5">Live distribution vs baseline:</p>
                        <div className="space-y-1">
                          {Object.entries(r.distribution).sort((a,b)=>b[1]-a[1]).map(([label, count]) => {
                            const total = Object.values(r.distribution).reduce((s,v)=>s+v,0)
                            const baseCount = r.baseline_dist?.[label] || 0
                            const baseTotal = Object.values(r.baseline_dist||{}).reduce((s,v)=>s+v,0)
                            return (
                              <div key={label} className="flex items-center gap-2 text-xs">
                                <span className="w-20 capitalize truncate text-gray-600 dark:text-gray-400">{label}</span>
                                <div className="flex-1 flex items-center gap-1">
                                  <div title="Live" className="h-2 bg-blue-500 rounded" style={{ width: `${Math.round((count/Math.max(total,1))*120)}px` }} />
                                  {baseTotal > 0 && (
                                    <div title="Baseline" className="h-2 bg-gray-300 dark:bg-gray-600 rounded" style={{ width: `${Math.round((baseCount/Math.max(baseTotal,1))*120)}px` }} />
                                  )}
                                </div>
                                <span className="text-gray-400 w-16">
                                  {Math.round((count/Math.max(total,1))*100)}% live
                                </span>
                              </div>
                            )
                          })}
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">■ Blue = live  ■ Gray = training baseline</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
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
                          {actionLoading === `rollback-${mt}` ? 'Rolling back…' : '↩ Rollback'}
                        </button>
                      </div>
                    </div>

                    {/* Version table */}
                    {info.versions?.length > 0 && (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700 text-left">
                            <th className="py-1.5 pr-3">Version</th>
                            <th className="py-1.5 pr-3">Accuracy</th>
                            <th className="py-1.5 pr-3">Registered</th>
                            <th className="py-1.5">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {info.versions.map((v, i) => (
                            <tr key={i} className={`border-b border-gray-100 dark:border-gray-800 ${v.is_active ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
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

                {/* No versions */}
                {(!modelVersions.registry || Object.keys(modelVersions.registry).length === 0) && (
                  <Card>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No model versions registered yet.
                      Train models and run the pipeline to populate the registry.
                    </p>
                  </Card>
                )}
              </>
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
                <p className="text-sm text-gray-600 dark:text-gray-400">
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
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Retraining runs in the background. Check server logs or the run history below.
                </p>
              </div>
            </Card>

            {/* Run history */}
            <Card title="Retraining Run History">
              {retrainRuns.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No retraining runs yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700 text-left">
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
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-1.5 pr-3 font-mono text-blue-600 dark:text-blue-400">{r.id}</td>
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
