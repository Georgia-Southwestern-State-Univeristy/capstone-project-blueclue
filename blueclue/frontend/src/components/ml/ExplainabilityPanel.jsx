/**
 * ExplainabilityPanel
 * ===================
 * Shows why the AI chose a particular category or priority.
 *
 * Usage:
 *   <ExplainabilityPanel
 *     text={ticketDescription}
 *     prediction="Software"
 *     confidence={0.85}
 *     modelType="category"
 *   />
 */
import { useState, useEffect } from 'react'
import { explainPrediction } from '../../services/mlAdminService'

// Confidence colour helper
const confidenceColor = (pct) => {
  if (pct >= 80) return 'text-green-600 dark:text-green-400'
  if (pct >= 60) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-500 dark:text-red-400'
}

const confidenceBg = (pct) => {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function ExplainabilityPanel({
  text,
  prediction = '',
  confidence = 0,
  modelType = 'category',
  autoLoad = true,
  className = '',
}) {
  const [explanation, setExplanation] = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)

  const confidencePct = Math.round((confidence || 0) * 100)

  const loadExplanation = async () => {
    if (!text) return
    setLoading(true)
    setError(null)
    try {
      const res = await explainPrediction(text, modelType, prediction, confidence)
      setExplanation(res?.data || res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autoLoad && text) loadExplanation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, prediction, modelType])

  const data = explanation

  return (
    <div className={`rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-blue-500 dark:text-blue-400 text-lg">🤖</span>
          <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
            AI {modelType === 'category' ? 'Category' : 'Priority'} Suggestion
          </span>
        </div>

        {!autoLoad && !data && (
          <button
            onClick={loadExplanation}
            disabled={loading}
            className="text-xs px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Analysing…' : 'Why this?'}
          </button>
        )}
      </div>

      {/* Prediction + confidence bar */}
      <div className="mt-2 flex items-center gap-3 flex-wrap">
        <span className="font-bold text-blue-900 dark:text-blue-100 capitalize text-base">
          {data?.prediction || prediction || '—'}
        </span>
        {(data?.confidence_pct ?? confidencePct) > 0 && (
          <div className="flex items-center gap-2 flex-1 min-w-[120px]">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${confidenceBg(data?.confidence_pct ?? confidencePct)}`}
                style={{ width: `${Math.min(data?.confidence_pct ?? confidencePct, 100)}%` }}
              />
            </div>
            <span className={`text-sm font-semibold whitespace-nowrap ${confidenceColor(data?.confidence_pct ?? confidencePct)}`}>
              {data?.confidence_pct ?? confidencePct}%
            </span>
          </div>
        )}
        {(data?.low_confidence) && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 font-medium">
            ⚠ Low confidence
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Generating explanation…
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <p className="mt-2 text-xs text-red-500 dark:text-red-400">Could not load explanation: {error}</p>
      )}

      {/* Feature list */}
      {data?.top_features?.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1.5">
            Because of these keywords:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.top_features.slice(0, 5).map((f, i) => {
              const score = Math.abs(f.score || 0)
              const maxScore = Math.abs(data.top_features[0]?.score || 1)
              const pct = Math.min(100, Math.round((score / Math.max(maxScore, 0.001)) * 100))
              return (
                <span
                  key={i}
                  title={`SHAP score: ${f.score?.toFixed(4) ?? '?'}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700"
                >
                  <span className="font-bold">{f.feature}</span>
                  <span
                    className="w-8 bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden"
                    title={`Weight: ${pct}%`}
                  >
                    <span
                      className="block h-1 bg-blue-400 dark:bg-blue-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary sentence */}
      {data?.summary && (
        <p className="mt-3 text-xs text-blue-600 dark:text-blue-300 italic border-t border-blue-200 dark:border-blue-800 pt-2">
          {data.summary}
        </p>
      )}

      {/* Method badge */}
      {data?.method && (
        <span className="mt-2 inline-block text-[10px] text-blue-400 dark:text-blue-600">
          Method: {data.method}
        </span>
      )}
    </div>
  )
}
