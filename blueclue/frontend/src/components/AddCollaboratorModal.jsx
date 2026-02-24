import React, { useState, useEffect } from 'react';
import { getTechnicians } from '../services/userService';
import { getTechnicianWorkload } from '../services/collaboratorService';

/**
 * AddCollaboratorModal - Modal for adding technicians to a ticket
 * @param {Object} props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onAdd - Add collaborator handler
 * @param {string} props.ticketCategory - Ticket category for filtering
 * @param {Array} props.existingCollaborators - Current collaborators
 */
const AddCollaboratorModal = ({ 
  isOpen, 
  onClose, 
  onAdd, 
  existingCollaborators = []
}) => {
  const [technicians, setTechnicians] = useState([]);
  const [filteredTechnicians, setFilteredTechnicians] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTechId, setSelectedTechId] = useState(null);
  const [role, setRole] = useState('assisting');
  const [note, setNote] = useState('');
  const [workloadData, setWorkloadData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch technicians on mount
  useEffect(() => {
    if (isOpen) {
      fetchTechnicians();
      setSearchQuery('');
      setSelectedTechId(null);
      setRole('assisting');
      setNote('');
      setError('');
    }
  }, [isOpen]);

  // Filter technicians based on search
  useEffect(() => {
    if (!technicians.length) return;

    let filtered = technicians;

    // Filter out existing collaborators
    const existingIds = existingCollaborators.map(c => c.user_id);
    filtered = filtered.filter(tech => !existingIds.includes(tech.id));

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tech => 
        tech.first_name?.toLowerCase().includes(query) ||
        tech.last_name?.toLowerCase().includes(query) ||
        tech.email?.toLowerCase().includes(query) ||
        tech.username?.toLowerCase().includes(query)
      );
    }

    setFilteredTechnicians(filtered);
  }, [searchQuery, technicians, existingCollaborators]);

  // Fetch workload when tech is selected
  useEffect(() => {
    if (selectedTechId && !workloadData[selectedTechId]) {
      fetchWorkload(selectedTechId);
    }
  }, [selectedTechId, workloadData]);

  const fetchTechnicians = async () => {
    try {
      setLoading(true);
      const response = await getTechnicians();
      // getTechnicians already returns the array directly
      setTechnicians(response || []);
    } catch (err) {
      console.error('Failed to fetch technicians:', err);
      setError('Failed to load technicians');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkload = async (techId) => {
    try {
      const response = await getTechnicianWorkload(techId);
      setWorkloadData(prev => ({
        ...prev,
        [techId]: response.data
      }));
    } catch (err) {
      console.error('Failed to fetch workload:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedTechId) {
      setError('Please select a technician');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onAdd(selectedTechId, role, note);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add collaborator');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTech = (techId) => {
    setSelectedTechId(selectedTechId === techId ? null : techId);
    setError('');
  };

  const getWorkloadColor = (activeCount) => {
    if (!activeCount || activeCount === '0') return 'text-green-400';
    if (parseInt(activeCount) <= 2) return 'text-yellow-400';
    if (parseInt(activeCount) <= 4) return 'text-orange-400';
    return 'text-red-400';
  };

  if (!isOpen) return null;

  const selectedWorkload = selectedTechId ? workloadData[selectedTechId] : null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-[#1a1f2e] border border-blue-500/30 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900/30 rounded-lg border border-blue-500/30">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Add Collaborator</h2>
              <p className="text-sm text-gray-400 mt-1">Add a technician to help with this ticket</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
            disabled={loading}
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Search Box */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search Technician
              </label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or username..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            {/* Technician List */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Available Technicians ({filteredTechnicians.length})
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-700/50 rounded-lg p-2 bg-gray-800/30">
                {loading ? (
                  <div className="text-center py-8 text-gray-400">Loading technicians...</div>
                ) : filteredTechnicians.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    {searchQuery ? 'No technicians found' : 'No available technicians'}
                  </div>
                ) : (
                  filteredTechnicians.map(tech => {
                    const workload = workloadData[tech.id];
                    const isSelected = selectedTechId === tech.id;
                    
                    return (
                      <div
                        key={tech.id}
                        onClick={() => handleSelectTech(tech.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-900/30 border-blue-500/50'
                            : 'bg-gray-800/50 border-gray-600/30 hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">
                                {tech.first_name} {tech.last_name}
                              </span>
                              <span className="px-2 py-0.5 bg-blue-900/30 text-blue-300 text-xs rounded border border-blue-500/30">
                                {tech.role}
                              </span>
                            </div>
                            <p className="text-sm text-gray-400 mt-1">{tech.email}</p>
                          </div>
                          
                          {/* Workload indicator */}
                          {workload && (
                            <div className="flex items-center gap-2 ml-4">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span className={`text-sm font-medium ${getWorkloadColor(workload.active_tickets)}`}>
                                {workload.active_tickets || 0} active
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected Tech Workload Details */}
            {selectedWorkload && (
              <div className="p-4 bg-gray-800/50 border border-gray-600/50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="font-medium text-white">Workload Details</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Total Tickets</p>
                    <p className="text-xl font-bold text-white mt-1">{selectedWorkload.total_tickets || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">As Primary</p>
                    <p className="text-xl font-bold text-blue-400 mt-1">{selectedWorkload.primary_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Assisting</p>
                    <p className="text-xl font-bold text-purple-400 mt-1">{selectedWorkload.assisting_count || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Role Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Role
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRole('assisting')}
                  className={`flex-1 p-3 rounded-lg border transition-all ${
                    role === 'assisting'
                      ? 'bg-purple-900/30 border-purple-500/50 text-purple-300'
                      : 'bg-gray-800/50 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="font-medium">Assisting</div>
                  <div className="text-xs mt-1">Help with the ticket</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('primary')}
                  className={`flex-1 p-3 rounded-lg border transition-all ${
                    role === 'primary'
                      ? 'bg-blue-900/30 border-blue-500/50 text-blue-300'
                      : 'bg-gray-800/50 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="font-medium">Transfer Primary</div>
                  <div className="text-xs mt-1">Make them the lead</div>
                </button>
              </div>
            </div>

            {/* Note Field */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Note (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explain why collaboration is needed..."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 resize-none"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Optional explanation for the collaborator</span>
                <span>{note.length}/500</span>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700/50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedTechId}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span>Add Collaborator</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCollaboratorModal;
