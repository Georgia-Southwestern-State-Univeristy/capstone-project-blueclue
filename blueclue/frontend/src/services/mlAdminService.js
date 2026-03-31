// src/services/mlAdminService.js
// API calls to the ML Admin backend endpoints.

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('blueclue_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
};

// ── Dashboard ────────────────────────────────────────────────────────────────

export const getMLDashboard = () =>
  fetch(`${API_BASE_URL}/ml-admin/dashboard`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);

export const getMLHealth = () =>
  fetch(`${API_BASE_URL}/ml-admin/health`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);

// ── Explainability ───────────────────────────────────────────────────────────

/**
 * Why did the AI choose this prediction?
 * @param {string} text       Ticket description
 * @param {string} modelType  'category' | 'priority'
 * @param {string} [prediction]  Pre-known prediction label
 * @param {number} [confidence]  Pre-known confidence
 */
export const explainPrediction = (text, modelType = 'category', prediction = '', confidence = 0) =>
  fetch(`${API_BASE_URL}/ml-admin/explain`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ text, model_type: modelType, prediction, confidence }),
  }).then(handleResponse);

// ── Feedback / Overrides ─────────────────────────────────────────────────────

/**
 * Submit user feedback on an AI prediction.
 * @param {Object} feedback
 */
export const submitFeedback = (feedback) =>
  fetch(`${API_BASE_URL}/ml-admin/feedback`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(feedback),
  }).then(handleResponse);

export const getFeedback = ({ limit = 100, category = null, overriddenOnly = false } = {}) => {
  const params = new URLSearchParams({ limit });
  if (category) params.append('category', category);
  if (overriddenOnly) params.append('overridden_only', 'true');
  return fetch(`${API_BASE_URL}/ml-admin/feedback?${params}`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);
};

export const getOverrideRates = () =>
  fetch(`${API_BASE_URL}/ml-admin/feedback/override-rates`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);

export const getTrainingSummary = () =>
  fetch(`${API_BASE_URL}/ml-admin/feedback/training-summary`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);

export const getPendingFeedback = (limit = 100) =>
  fetch(`${API_BASE_URL}/ml-admin/feedback/pending?limit=${limit}`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);

export const approveFeedback = (id, note = '') =>
  fetch(`${API_BASE_URL}/ml-admin/feedback/${id}/approve`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ note }),
  }).then(handleResponse);

export const rejectFeedback = (id, note = '') =>
  fetch(`${API_BASE_URL}/ml-admin/feedback/${id}/reject`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ note }),
  }).then(handleResponse);

export const bulkApproveFeedback = () =>
  fetch(`${API_BASE_URL}/ml-admin/feedback/bulk-approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
  }).then(handleResponse);

// ── Drift Detection ──────────────────────────────────────────────────────────

export const runDriftDetection = (modelType = 'category', windowDays = 30) =>
  fetch(`${API_BASE_URL}/ml-admin/drift/run`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ model_type: modelType, window_days: windowDays }),
  }).then(handleResponse);

export const getDriftReports = ({ modelType = null, limit = 20 } = {}) => {
  const params = new URLSearchParams({ limit });
  if (modelType) params.append('model_type', modelType);
  return fetch(`${API_BASE_URL}/ml-admin/drift/reports?${params}`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);
};

// ── Model Versions ───────────────────────────────────────────────────────────

export const getModelVersions = (modelType = null) => {
  const params = modelType ? `?model_type=${modelType}` : '';
  return fetch(`${API_BASE_URL}/ml-admin/models/versions${params}`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);
};

export const getRegistryHistory = () =>
  fetch(`${API_BASE_URL}/ml-admin/models/registry/history`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);

export const deployModel = (modelType, version) =>
  fetch(`${API_BASE_URL}/ml-admin/models/deploy`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ model_type: modelType, version }),
  }).then(handleResponse);

export const rollbackModel = (modelType, targetVersion = null) =>
  fetch(`${API_BASE_URL}/ml-admin/models/rollback`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ model_type: modelType, target_version: targetVersion }),
  }).then(handleResponse);

// ── Retraining ───────────────────────────────────────────────────────────────

export const triggerRetraining = ({ modelTypes = ['category', 'priority', 'time'], autoDeploy = false, threshold = 0.02 } = {}) =>
  fetch(`${API_BASE_URL}/ml-admin/retrain`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      model_types: modelTypes,
      auto_deploy: autoDeploy,
      improvement_threshold: threshold,
    }),
  }).then(handleResponse);

export const getRetrainingRuns = () =>
  fetch(`${API_BASE_URL}/ml-admin/retrain/reports`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);

// ── Predictions ──────────────────────────────────────────────────────────────

export const getRecentPredictions = (limit = 50) =>
  fetch(`${API_BASE_URL}/ml-admin/predictions/recent?limit=${limit}`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);

export const exportPredictions = (since = null) => {
  const params = since ? `?since=${since}` : '';
  return fetch(`${API_BASE_URL}/ml-admin/predictions/export${params}`, {
    headers: getAuthHeaders(),
  }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  });
};

// ── Drift Settings ───────────────────────────────────────────────────────────

/** GET /api/ml-admin/drift/settings */
export const getDriftSettings = () =>
  fetch(`${API_BASE_URL}/ml-admin/drift/settings`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);

/** PUT /api/ml-admin/drift/settings/:modelType */
export const updateDriftSettings = (modelType, settings) =>
  fetch(`${API_BASE_URL}/ml-admin/drift/settings/${modelType}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(settings),
  }).then(handleResponse);

// ── Drift Alerts ─────────────────────────────────────────────────────────────

/** GET /api/ml-admin/drift/alerts */
export const getDriftAlerts = ({ modelType = null, acknowledged = null, limit = 50 } = {}) => {
  const params = new URLSearchParams({ limit });
  if (modelType)     params.append('model_type',   modelType);
  if (acknowledged !== null) params.append('acknowledged', String(acknowledged));
  return fetch(`${API_BASE_URL}/ml-admin/drift/alerts?${params}`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);
};

/** PATCH /api/ml-admin/drift/alerts/:id/acknowledge */
export const acknowledgeDriftAlert = (id) =>
  fetch(`${API_BASE_URL}/ml-admin/drift/alerts/${id}/acknowledge`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  }).then(handleResponse);

/** POST /api/ml-admin/drift/alerts/acknowledge-all */
export const acknowledgeAllDriftAlerts = () =>
  fetch(`${API_BASE_URL}/ml-admin/drift/alerts/acknowledge-all`, {
    method: 'POST',
    headers: getAuthHeaders(),
  }).then(handleResponse);

// ── Drift History ────────────────────────────────────────────────────────────

/** GET /api/ml-admin/drift/history?model_type=category&limit=60 */
export const getDriftHistory = ({ modelType = 'category', limit = 60 } = {}) =>
  fetch(`${API_BASE_URL}/ml-admin/drift/history?model_type=${modelType}&limit=${limit}`, {
    headers: getAuthHeaders(),
  }).then(handleResponse);
