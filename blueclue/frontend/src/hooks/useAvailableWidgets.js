import { useState, useEffect } from 'react';
import { useToast } from './useToast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Custom hook to fetch widgets available to the current user based on their role
 * @param {string[]} requestedKeys - Optional array of specific widget keys to filter for
 * @param {string} category - Optional category filter
 * @returns {object} { widgets, loading, error, refetch }
 */
export function useAvailableWidgets(requestedKeys = null, category = null) {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const fetchAvailableWidgets = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('blueclue_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const params = new URLSearchParams();
      if (category) {
        params.append('category', category);
      }

      const url = `${API_BASE_URL}/widgets/available${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch available widgets: ${response.statusText}`);
      }

      const data = await response.json();
      let availableWidgets = data.data || [];

      // If specific keys were requested, filter to only those
      if (requestedKeys && Array.isArray(requestedKeys)) {
        const keySet = new Set(requestedKeys);
        availableWidgets = availableWidgets.filter(w => keySet.has(w.key));
      }

      setWidgets(availableWidgets);
    } catch (err) {
      console.error('Error fetching available widgets:', err);
      setError(err.message);
      toast?.error?.('Failed to load available widgets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableWidgets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]); // Refetch when category changes

  return {
    widgets,
    loading,
    error,
    refetch: fetchAvailableWidgets,
  };
}
