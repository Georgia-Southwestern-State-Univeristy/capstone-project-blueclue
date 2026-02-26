import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Get auth headers
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('blueclue_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

/**
 * UpdateRequestResponseTimeAnalytics
 * Shows average response times for update requests by technician
 */
function UpdateRequestResponseTimeAnalytics() {
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(
        `${API_URL}/update-requests/analytics/response-times?days=${days}`,
        {
          headers: getAuthHeaders(),
          withCredentials: true
        }
      );

      setAnalytics(response.data.data.analytics || []);
    } catch (err) {
      console.error('Error fetching response time analytics:', err);
      setError(err.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatHours = (hours) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    return `${hours.toFixed(1)} hrs`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
        <p className="text-sm text-red-300">{error}</p>
      </div>
    );
  }

  if (analytics.length === 0) {
    return (
      <div className="bg-gray-700 rounded-lg p-8 text-center">
        <svg className="w-12 h-12 text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-gray-400">No response time data available for the selected period</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Showing data for last <strong className="text-white">{days} days</strong>
        </p>
        <select 
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="px-3 py-1 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:ring-2 focus:ring-indigo-500"
        >
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
        </select>
      </div>

      {/* Technician List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {analytics.map((tech) => (
          <div 
            key={tech.tech_id}
            className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-indigo-500/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-medium text-white">
                  {tech.first_name} {tech.last_name}
                </h4>
                <p className="text-xs text-gray-400">{tech.email}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-indigo-400">
                  {formatHours(tech.avg_response_time_hours)}
                </div>
                <p className="text-xs text-gray-400">avg response</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="bg-gray-800/50 rounded p-2">
                <div className="font-semibold text-green-400">{tech.responses_within_1hr}</div>
                <div className="text-gray-400">≤ 1 hr</div>
              </div>
              <div className="bg-gray-800/50 rounded p-2">
                <div className="font-semibold text-amber-400">{tech.responses_within_4hrs}</div>
                <div className="text-gray-400">≤ 4 hrs</div>
              </div>
              <div className="bg-gray-800/50 rounded p-2">
                <div className="font-semibold text-orange-400">{tech.responses_within_8hrs}</div>
                <div className="text-gray-400">≤ 8 hrs</div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-600 grid grid-cols-3 gap-3 text-xs text-gray-400">
              <div>
                <span className="font-medium text-white">{tech.total_responses}</span> total
              </div>
              <div>
                <span className="font-medium text-white">{formatHours(tech.min_response_time_seconds / 3600)}</span> fastest
              </div>
              <div>
                <span className="font-medium text-white">{formatHours(tech.max_response_time_seconds / 3600)}</span> slowest
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-4 mt-4">
        <h4 className="font-medium text-indigo-300 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Performance Summary
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-white">
              {analytics.length}
            </div>
            <div className="text-xs text-gray-400">Active Techs</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {analytics.reduce((sum, t) => sum + parseInt(t.total_responses), 0)}
            </div>
            <div className="text-xs text-gray-400">Total Responses</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-400">
              {formatHours(
                analytics.reduce((sum, t) => sum + parseFloat(t.avg_response_time_hours), 0) / analytics.length
              )}
            </div>
            <div className="text-xs text-gray-400">Overall Avg</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">
              {Math.round(
                (analytics.reduce((sum, t) => sum + parseInt(t.responses_within_4hrs), 0) /
                analytics.reduce((sum, t) => sum + parseInt(t.total_responses), 0)) * 100
              )}%
            </div>
            <div className="text-xs text-gray-400">Within 4 hrs</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpdateRequestResponseTimeAnalytics;
