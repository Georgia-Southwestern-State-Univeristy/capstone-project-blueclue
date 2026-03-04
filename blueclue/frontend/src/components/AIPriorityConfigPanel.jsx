import { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';

/**
 * AIPriorityConfigPanel Component
 * Admin panel for configuring AI priority system
 */
const AIPriorityConfigPanel = () => {
  const [config, setConfig] = useState(null);
  const [editedConfig, setEditedConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
    loadAnalytics();
  }, []);

  const loadConfiguration = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/config/ai/priority_weights', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to load configuration');

      const data = await response.json();
      setConfig(data.data.config_value);
      setEditedConfig(data.data.config_value);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics/ai-priority', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.data.overview);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/config/ai/priority-weights', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(editedConfig)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save configuration');
      }

      const data = await response.json();
      setConfig(data.data.config_value);
      setEditedConfig(data.data.config_value);
      setSuccessMessage('Configuration saved successfully!');
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset configuration to defaults? This cannot be undone.')) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch('/api/config/ai/priority_weights/reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to reset configuration');

      const data = await response.json();
      setConfig(data.data.config_value);
      setEditedConfig(data.data.config_value);
      setSuccessMessage('Configuration reset to defaults!');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = () => {
    return JSON.stringify(config) !== JSON.stringify(editedConfig);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-red-900/30 border border-red-600 rounded-lg p-4">
        <p className="text-red-300">Failed to load configuration</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-100">
          AI Priority System Configuration
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Configure how AI recommendations influence ticket priority decisions
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-900/30 border border-red-600 text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-900/30 border border-green-600 text-green-300 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Analytics Summary (if available) */}
      {analytics && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-400 mb-3">
            Current Performance
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-400">Total Overrides</p>
              <p className="text-2xl font-bold text-gray-200">{analytics.total_overrides}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">AI Acceptance Rate</p>
              <p className="text-2xl font-bold text-green-400">
                {analytics.acceptance_rate ? `${analytics.acceptance_rate}%` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Avg Confidence</p>
              <p className="text-2xl font-bold text-blue-400">
                {analytics.avg_confidence ? `${(analytics.avg_confidence * 100).toFixed(0)}%` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">High Confidence Overrides</p>
              <p className="text-2xl font-bold text-orange-400">{analytics.high_confidence_overrides || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-6">
        {/* Master Switch */}
        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
          <div>
            <h3 className="text-lg font-semibold text-gray-200">
              Enable AI Priority System
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Turn on AI-influenced priority calculations
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={editedConfig.enableAIPriority}
              onChange={(e) => setEditedConfig({
                ...editedConfig,
                enableAIPriority: e.target.checked
              })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Weight Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Priority Weights</h3>
          
          {/* AI Weight */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              AI Weight: {editedConfig.aiWeight.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={editedConfig.aiWeight}
              onChange={(e) => setEditedConfig({
                ...editedConfig,
                aiWeight: parseFloat(e.target.value)
              })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              disabled={!editedConfig.enableAIPriority}
            />
            <p className="text-xs text-gray-500 mt-1">
              Higher values give more weight to AI recommendations
            </p>
          </div>

          {/* User Weight */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              User Weight: {editedConfig.userWeight.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={editedConfig.userWeight}
              onChange={(e) => setEditedConfig({
                ...editedConfig,
                userWeight: parseFloat(e.target.value)
              })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              disabled={!editedConfig.enableAIPriority}
            />
            <p className="text-xs text-gray-500 mt-1">
              Higher values give more weight to user selections
            </p>
          </div>
        </div>

        {/* Confidence Thresholds */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Confidence Thresholds</h3>
          
          {/* High Confidence */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              High Confidence Threshold: {(editedConfig.highConfidenceThreshold * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={editedConfig.highConfidenceThreshold}
              onChange={(e) => setEditedConfig({
                ...editedConfig,
                highConfidenceThreshold: parseFloat(e.target.value)
              })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              disabled={!editedConfig.enableAIPriority}
            />
            <p className="text-xs text-gray-500 mt-1">
              AI confidence above this shows as "High"
            </p>
          </div>

          {/* Medium Confidence */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Medium Confidence Threshold: {(editedConfig.mediumConfidenceThreshold * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={editedConfig.mediumConfidenceThreshold}
              onChange={(e) => setEditedConfig({
                ...editedConfig,
                mediumConfidenceThreshold: parseFloat(e.target.value)
              })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              disabled={!editedConfig.enableAIPriority}
            />
            <p className="text-xs text-gray-500 mt-1">
              AI confidence above this shows as "Medium"
            </p>
          </div>
        </div>

        {/* Warning Settings */}
        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
          <div>
            <h3 className="text-md font-semibold text-gray-200">
              Show Override Warnings
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Display modal when user overrides high-confidence AI
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={editedConfig.showWarningOnOverride}
              onChange={(e) => setEditedConfig({
                ...editedConfig,
                showWarningOnOverride: e.target.checked
              })}
              className="sr-only peer"
              disabled={!editedConfig.enableAIPriority}
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
        <button
          onClick={handleReset}
          disabled={isSaving}
          className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-gray-300 font-medium py-3 px-6 rounded-lg transition-colors"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-400 mb-2">How It Works</h4>
        <ul className="text-sm text-gray-300 space-y-1 ml-4 list-disc">
          <li>When users don't select a priority, AI recommendation is used directly</li>
          <li>When users select a priority, it's weighted against AI's recommendation</li>
          <li>Higher AI confidence means more influence on final priority</li>
          <li>Warnings appear when user significantly overrides high-confidence AI</li>
        </ul>
      </div>
    </div>
  );
};

export default AIPriorityConfigPanel;
