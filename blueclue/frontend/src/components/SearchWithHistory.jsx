import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

/**
 * SearchWithHistory Component
 * ============================
 * Reusable search input with dropdown history
 * 
 * Features:
 * - Shows last 5 searches when focused
 * - Click to populate and submit
 * - Delete individual history items
 * - Persistent per user and search type
 * - Matches existing CSS styling
 * 
 * @param {string} searchType - 'ticket' or 'knowledge_base'
 * @param {string} value - Current search value (controlled)
 * @param {function} onChange - Handler for value changes
 * @param {function} onSubmit - Handler for search submission (optional, for forms)
 * @param {string} placeholder - Input placeholder text
 * @param {string} className - Additional CSS classes for input
 * @param {boolean} showClearButton - Show X button to clear (default: true)
 */
export default function SearchWithHistory({
  searchType,
  value,
  onChange,
  onSubmit,
  placeholder = 'Search...',
  className = '',
  showClearButton = true
}) {
  const [history, setHistory] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  console.log('[SearchWithHistory] Component render, searchType:', searchType, 'value:', value);

  // ===== FUNCTION DECLARATIONS (must come before useEffects that call them) =====
  
  const saveToHistory = async (query) => {
    console.log('[SearchWithHistory] saveToHistory called, query:', query);
    if (!query || !query.trim()) return;

    try {
      const token = localStorage.getItem('blueclue_token');
      console.log('[SearchWithHistory] Token found:', !!token);
      if (!token) return;

      await axios.post(
        `/api/search-history/${searchType}`,
        { query: query.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refresh history after saving
      const response = await axios.get(`/api/search-history/${searchType}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setHistory(response.data.searches || []);
      }
    } catch (error) {
      // Silently fail - history is a nice-to-have feature
      console.error('Failed to save search history:', error);
    }
  };

  const deleteHistoryItem = async (id, event) => {
    event.stopPropagation();

    try {
      const token = localStorage.getItem('blueclue_token');
      if (!token) return;

      const response = await axios.delete(`/api/search-history/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setHistory(prev => prev.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete history item:', error);
    }
  };

  const handleInputFocus = () => {
    console.log('[SearchWithHistory] Input focused, history length:', history.length);
    if (history.length > 0) {
      setShowDropdown(true);
      console.log('[SearchWithHistory] Dropdown shown');
    }
  };

  const handleHistoryClick = async (query) => {
    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    onChange({ target: { value: query } });
    
    // Save to history immediately (updates timestamp)
    await saveToHistory(query);
    
    // Keep dropdown visible to show updated history
    setShowDropdown(true);
    
    // Trigger submit if provided
    if (onSubmit) {
      // Use a small delay to ensure state updates propagate
      setTimeout(() => {
        if (onSubmit.call) {
          onSubmit(query);
        }
      }, 0);
    }
  };

  const handleInputChange = (e) => {
    console.log('[SearchWithHistory] Input changed, new value:', e.target.value);
    onChange(e);
    // Keep dropdown open while typing - it will update when history changes
  };

  const handleInputKeyDown = async (e) => {
    console.log('[SearchHistory] Key pressed:', e.key, 'Value:', value);
    if (e.key === 'Enter' && value.trim()) {
      console.log('[SearchHistory] Enter key - saving search');
      e.preventDefault(); // Prevent form submission
      
      // Clear any pending auto-save since we're saving now
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      await saveToHistory(value);
      
      // Keep dropdown visible to show updated history
      setShowDropdown(true);
      
      // Trigger parent's submit handler if provided
      if (onSubmit) {
        onSubmit(value);
      }
    }
  };

  const handleClear = () => {
    onChange({ target: { value: '' } });
    inputRef.current?.focus();
  };

  // ===== USE EFFECTS (come after all function declarations) =====

  // Fetch search history when component mounts or search type changes
  useEffect(() => {
    console.log('[SearchWithHistory] Fetching history for searchType:', searchType);
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('blueclue_token');
        console.log('[SearchWithHistory] Token found for fetch:', !!token);
        if (!token) return;

        const response = await axios.get(`/api/search-history/${searchType}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        console.log('[SearchWithHistory] Fetch response:', response.data);
        if (response.data.success) {
          setHistory(response.data.searches || []);
          console.log('[SearchWithHistory] History set, count:', response.data.searches?.length || 0);
        }
      } catch (error) {
        // Silently fail - history is a nice-to-have feature
        console.error('Failed to fetch search history:', error);
      }
    };

    fetchHistory();
  }, [searchType]);

  // Auto-save search after user stops typing (debounced)
  useEffect(() => {
    console.log('[SearchWithHistory] Auto-save effect triggered, value:', value);
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      console.log('[SearchWithHistory] Cleared previous timeout');
    }

    // Only save non-empty searches
    if (value && value.trim()) {
      console.log('[SearchWithHistory] Scheduling auto-save in 1.5s');
      // Wait 1.5 seconds after user stops typing before saving
      saveTimeoutRef.current = setTimeout(() => {
        console.log('[SearchWithHistory] Auto-save timeout fired');
        saveToHistory(value);
      }, 1500);
    }

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [value, searchType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        className={className}
      />

      {/* Search icon */}
      <svg 
        className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      {/* Clear button */}
      {showClearButton && value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
          title="Clear search"
          type="button"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* History dropdown */}
      {showDropdown && history.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          <div className="py-1">
            <div className="px-3 py-1 text-xs text-gray-400 uppercase tracking-wider">
              Recent Searches
            </div>
            {history.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between px-3 py-2 hover:bg-gray-700 cursor-pointer transition-colors"
                onClick={() => handleHistoryClick(item.query)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-200 truncate">{item.query}</span>
                </div>
                <button
                  onClick={(e) => deleteHistoryItem(item.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                  title="Remove from history"
                  type="button"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
