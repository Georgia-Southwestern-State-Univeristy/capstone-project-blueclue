import { useState, useEffect, useMemo } from 'react'
import { getTechnicians, bulkAssignTickets, assignTicket as assignTicketApi } from '../services/ticketService'
import TicketDetailView from './TicketDetailView'
import useContainerSize from '../hooks/useContainerSize'
import RefreshButton from './RefreshButton'

// ── Helpers ──────────────────────────────────────────────────────────────

const getStatusColor = (status) => {
  const m = {
    open:                { bg: 'bg-yellow-950', border: 'border-yellow-700', text: 'text-yellow-400', badge: 'bg-yellow-900 text-yellow-300' },
    in_progress:         { bg: 'bg-blue-950',   border: 'border-blue-700',   text: 'text-blue-400',   badge: 'bg-blue-900 text-blue-300' },
    waiting_on_customer: { bg: 'bg-purple-950',  border: 'border-purple-700', text: 'text-purple-400', badge: 'bg-purple-900 text-purple-300' },
    resolved:            { bg: 'bg-green-950',   border: 'border-green-700',  text: 'text-green-400',  badge: 'bg-green-900 text-green-300' },
    closed:              { bg: 'bg-gray-800',    border: 'border-gray-600',   text: 'text-gray-400',   badge: 'bg-gray-700 text-gray-300' },
    cancelled:           { bg: 'bg-gray-900',    border: 'border-gray-600',   text: 'text-gray-400',   badge: 'bg-gray-700 text-gray-300' },
  }
  return m[status] || m.open
}

const getPriorityColor = (p) => {
  const m = { low: 'bg-blue-900 text-blue-300', medium: 'bg-yellow-900 text-yellow-300', high: 'bg-orange-900 text-orange-300', critical: 'bg-red-900 text-red-300' }
  return m[p] || 'bg-gray-700 text-gray-300'
}

const formatStatus = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

import { formatDate as _fmtDate } from '../utils/dateFormatter'
const formatDate = (d) => _fmtDate(d)

/** Returns workload tier with color classes and label */
const getWorkloadTier = (count) => {
  if (count >= 10) return { text: 'text-red-400',    barBg: 'bg-red-500',    label: 'Heavy',  avatarBg: 'bg-red-900',    avatarBorder: 'border-red-500' }
  if (count >= 7)  return { text: 'text-orange-400', barBg: 'bg-orange-500', label: 'High',   avatarBg: 'bg-orange-900', avatarBorder: 'border-orange-500' }
  if (count >= 4)  return { text: 'text-yellow-400', barBg: 'bg-yellow-500', label: 'Medium', avatarBg: 'bg-yellow-900', avatarBorder: 'border-yellow-500' }
  return                   { text: 'text-green-400',  barBg: 'bg-green-500',  label: 'Light',  avatarBg: 'bg-green-900',  avatarBorder: 'border-green-500' }
}

// ── Component ────────────────────────────────────────────────────────────

function TicketControlWidget({ tickets = [], onRefresh, onTicketUpdated, onMinimize }) {
  // ── Container-responsive sizing ──
  const [containerRef, { width: containerWidth }] = useContainerSize()
  const ticketCols = containerWidth >= 900 ? 3 : containerWidth >= 550 ? 2 : 1
  const filterCols = containerWidth >= 600 ? 3 : 1
  const headerRow = containerWidth >= 700

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState('queue')

  // ── Queue state ──
  const [selectedTickets, setSelectedTickets] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ status: [], priority: [], assignmentStatus: [] })
  const [refreshing, setRefreshing] = useState(false)

  // ── Assign state ──
  const [technicians, setTechnicians] = useState([])
  const [techLoading, setTechLoading] = useState(false)
  const [techSearch, setTechSearch] = useState('')
  const [selectedTechnician, setSelectedTechnician] = useState(null)
  const [assignmentNote, setAssignmentNote] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState(null)
  const [assignSuccess, setAssignSuccess] = useState(null)
  const [unassigning, setUnassigning] = useState(null) // ticket id being unassigned
  const [detailTicketId, setDetailTicketId] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // ── Fetch technicians ──
  const refreshTechnicians = () => {
    setTechLoading(true)
    getTechnicians()
      .then(res => setTechnicians(res.data || []))
      .catch(err => console.error('Failed to load technicians:', err))
      .finally(() => setTechLoading(false))
  }

  useEffect(() => { refreshTechnicians() }, [])

  // ── Refresh handler with visual feedback ──
  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      if (onRefresh) await onRefresh()
      refreshTechnicians()
    } finally {
      setTimeout(() => setRefreshing(false), 600)
    }
  }

  // ── Filtering logic (same as technician dashboard) ──
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => {
      const cur = prev[filterType]
      return { ...prev, [filterType]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] }
    })
  }

  const resetFilters = () => {
    setFilters({ status: [], priority: [], assignmentStatus: [] })
    setSearchQuery('')
  }

  const hasActiveFilters = filters.status.length > 0 || filters.priority.length > 0 || filters.assignmentStatus.length > 0 || searchQuery.trim() !== ''

  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const fields = [ticket.id?.toString(), ticket.ticket_number, ticket.subject, ticket.description, ticket.customer_name, ticket.customer_email, ticket.assigned_to_name, ticket.category, ticket.priority, ticket.status].filter(Boolean).join(' ').toLowerCase()
        if (!fields.includes(q)) return false
      }
      if (filters.status.length > 0 && !filters.status.includes(ticket.status)) return false
      if (filters.priority.length > 0 && !filters.priority.includes(ticket.priority)) return false
      if (filters.assignmentStatus.length > 0) {
        const isAssigned = ticket.assigned_to_name && ticket.assigned_to_name !== 'null'
        if (filters.assignmentStatus.includes('assigned') && !isAssigned) return false
        if (filters.assignmentStatus.includes('unassigned') && isAssigned) return false
      }
      return true
    })
  }, [tickets, searchQuery, filters])

  const sortedTickets = useMemo(() => [...filteredTickets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [filteredTickets])

  // ── Selection helpers ──
  const toggleTicket = (id) => {
    setSelectedTickets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (selectedTickets.length === filteredTickets.length) {
      setSelectedTickets([])
    } else {
      setSelectedTickets(filteredTickets.map(t => t.id))
    }
  }

  const allSelected = filteredTickets.length > 0 && selectedTickets.length === filteredTickets.length

  // ── Technician search ──
  const filteredTechnicians = useMemo(() => {
    if (!techSearch.trim()) return technicians
    const q = techSearch.toLowerCase()
    return technicians.filter(t => {
      const name = t.full_name || `${t.first_name} ${t.last_name}`
      return name.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q)
    })
  }, [technicians, techSearch])

  // ── Assignment ──
  const handleAssign = async () => {
    if (selectedTickets.length === 0 || !selectedTechnician) return
    setAssigning(true)
    setAssignError(null)
    setAssignSuccess(null)
    try {
      const result = await bulkAssignTickets(selectedTickets, selectedTechnician.id, assignmentNote.trim())
      const count = result.data?.assigned_count || selectedTickets.length
      const name = selectedTechnician.full_name || `${selectedTechnician.first_name} ${selectedTechnician.last_name}`
      setAssignSuccess(`${count} ticket${count !== 1 ? 's' : ''} assigned to ${name}`)
      setSelectedTickets([])
      setSelectedTechnician(null)
      setAssignmentNote('')
      setActiveTab('queue')
      refreshTechnicians()
      if (onTicketUpdated) onTicketUpdated()
    } catch (err) {
      setAssignError(err.message || 'Failed to assign tickets')
    } finally {
      setAssigning(false)
    }
  }

  // ── Unassign ──
  const handleUnassign = async (ticketId) => {
    setUnassigning(ticketId)
    setAssignError(null)
    try {
      await assignTicketApi(ticketId, null)
      setAssignSuccess('Ticket unassigned successfully')
      refreshTechnicians()
      if (onTicketUpdated) onTicketUpdated()
    } catch (err) {
      setAssignError(err.message || 'Failed to unassign ticket')
    } finally {
      setUnassigning(null)
    }
  }

  // ── Auto-clear success toast ──
  useEffect(() => {
    if (assignSuccess) {
      const t = setTimeout(() => setAssignSuccess(null), 5000)
      return () => clearTimeout(t)
    }
  }, [assignSuccess])

  // ── Selected ticket details for assign tab ──
  const selectedTicketDetails = useMemo(() => tickets.filter(t => selectedTickets.includes(t.id)), [tickets, selectedTickets])

  // ── Mini assignment counts ──
  const assignedCount = tickets.filter(t => t.assigned_to_name && t.assigned_to_name !== 'null').length
  const unassignedCount = tickets.length - assignedCount

  // ── Max workload for bar scaling ──
  const maxWorkload = useMemo(() => Math.max(15, ...technicians.map(t => t.open_ticket_count ?? 0)), [technicians])

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <>
    <div ref={containerRef} className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm h-full flex flex-col overflow-hidden">
      {/* Success Toast */}
      {assignSuccess && (
        <div className="mx-6 mt-4 px-4 py-3 bg-green-900/40 border border-green-700 rounded-lg text-green-300 text-sm flex items-center justify-between">
          <span>{assignSuccess}</span>
          <button onClick={() => setAssignSuccess(null)} className="text-green-400 hover:text-green-200 ml-4">&times;</button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex border-b border-gray-700">
        {[
          { id: 'queue', label: 'Ticket Queue', count: filteredTickets.length },
          { id: 'assign', label: 'Assign Tickets', count: selectedTickets.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors relative ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/50'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════ QUEUE TAB ═══════════════ */}
      {activeTab === 'queue' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Search + Filter Bar */}
          <div className="p-6 border-b border-gray-700">
            <div className={`flex gap-4 mb-4 ${headerRow ? 'flex-row justify-between items-center' : 'flex-col'}`}>
              {/* Title with Assignment Counts */}
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-white">Ticket Queue</h2>
                <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg border border-gray-600 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span className="text-gray-300">{assignedCount} Assigned</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                    <span className="text-gray-300">{unassignedCount} Unassigned</span>
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search tickets by ID, subject, customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowFilters(!showFilters)} className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                  {showFilters ? 'Hide' : 'Show'} Filters
                  {hasActiveFilters && (
                    <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {filters.status.length + filters.priority.length + filters.assignmentStatus.length + (searchQuery.trim() !== '' ? 1 : 0)}
                    </span>
                  )}
                </button>
                <RefreshButton onRefresh={handleRefresh} disabled={refreshing} />
              </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${filterCols}, minmax(0, 1fr))` }}>
                  {/* Status */}
                  <div>
                    <h3 className="font-semibold text-white mb-2">Status</h3>
                    <div className="space-y-1">
                      {['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed', 'cancelled'].map(s => (
                        <label key={s} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-2 py-1.5 rounded">
                          <input type="checkbox" checked={filters.status.includes(s)} onChange={() => handleFilterChange('status', s)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                          <span className="text-sm text-gray-300">{formatStatus(s)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {/* Priority */}
                  <div>
                    <h3 className="font-semibold text-white mb-2">Priority</h3>
                    <div className="space-y-1">
                      {['low', 'medium', 'high', 'critical'].map(p => (
                        <label key={p} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-2 py-1.5 rounded">
                          <input type="checkbox" checked={filters.priority.includes(p)} onChange={() => handleFilterChange('priority', p)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                          <span className="text-sm text-gray-300">{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {/* Assignment */}
                  <div>
                    <h3 className="font-semibold text-white mb-2">Assignment</h3>
                    <div className="space-y-1">
                      {['assigned', 'unassigned'].map(s => (
                        <label key={s} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-2 py-1.5 rounded">
                          <input type="checkbox" checked={filters.assignmentStatus.includes(s)} onChange={() => handleFilterChange('assignmentStatus', s)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                          <span className="text-sm text-gray-300">{s === 'assigned' ? 'Assigned to Someone' : 'Unassigned'}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button onClick={resetFilters} className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-sm font-medium">Clear All Filters</button>
                </div>
              </div>
            )}
          </div>

          {/* Selection bar */}
          {filteredTickets.length > 0 && (
            <div className="px-6 py-3 border-b border-gray-700 flex items-center justify-between bg-gray-800/30">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                <span className="text-sm text-gray-300">
                  {allSelected ? 'Deselect All' : 'Select All'}
                </span>
              </label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
                  {hasActiveFilters && ' (filtered)'}
                </span>
                {selectedTickets.length > 0 && (
                  <button
                    onClick={() => setActiveTab('assign')}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Assign {selectedTickets.length} Ticket{selectedTickets.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Empty / No results states */}
          {tickets.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-gray-400 text-lg">No tickets found</p>
            </div>
          )}
          {tickets.length > 0 && filteredTickets.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-gray-400 text-lg">No tickets match your filters</p>
              <button onClick={resetFilters} className="mt-4 px-4 py-2 text-blue-400 hover:text-blue-300 font-medium">Clear Filters</button>
            </div>
          )}

          {/* Ticket Cards Grid – scrollable within dashboard widget */}
          {filteredTickets.length > 0 && (
            <div className="p-6 flex-1 min-h-0 overflow-y-auto">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${ticketCols}, minmax(0, 1fr))` }}>
                {sortedTickets.map(ticket => {
                  const statusColor = getStatusColor(ticket.status)
                  const isSelected = selectedTickets.includes(ticket.id)
                  return (
                    <div
                      key={ticket.id}
                      onClick={() => { setDetailTicketId(ticket.id); setIsDetailOpen(true) }}
                      className={`${statusColor.bg} border ${isSelected ? 'border-blue-400 ring-1 ring-blue-400/50' : statusColor.border} rounded-lg p-4 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer select-none`}
                    >
                      {/* Header */}
                      <div className="flex items-start gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => { e.stopPropagation(); toggleTicket(ticket.id) }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 accent-blue-500 cursor-pointer mt-1 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-white text-sm leading-tight break-words">{ticket.subject}</h3>
                          <p className="text-xs text-gray-400 mt-0.5">{ticket.ticket_number || `#${ticket.id}`} &middot; {formatDate(ticket.created_at)}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap flex-shrink-0 ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority?.charAt(0).toUpperCase() + ticket.priority?.slice(1)}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-gray-300 text-sm mb-3 line-clamp-2 break-words">{ticket.description}</p>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded font-medium ${statusColor.badge}`}>{formatStatus(ticket.status)}</span>
                        {ticket.category && <span className="text-gray-400 bg-gray-800 px-2 py-0.5 rounded">{ticket.category}</span>}
                      </div>

                      {/* Customer / Assignment */}
                      <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between text-xs">
                        <span className="text-gray-400">
                          {ticket.customer_name || 'Unknown'}
                        </span>
                        <div className="flex items-center gap-2">
                          {ticket.assigned_to_name && ticket.assigned_to_name !== 'null' ? (
                            <span className="text-blue-300 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              {ticket.assigned_to_name}
                            </span>
                          ) : (
                            <span className="text-gray-500 italic">Unassigned</span>
                          )}
                        </div>
                      </div>

                      {/* AI Classification */}
                      {ticket.ai_classified && (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span className="text-indigo-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            AI
                          </span>
                          {ticket.ai_confidence != null && (
                            <span className={`font-medium ${ticket.ai_confidence >= 0.7 ? 'text-green-400' : ticket.ai_confidence >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {Math.round(ticket.ai_confidence * 100)}%
                            </span>
                          )}
                          {ticket.ai_fallback_used && <span className="text-yellow-500">Fallback</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ ASSIGN TAB ═══════════════ */}
      {activeTab === 'assign' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Selected Tickets Summary */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white">
                Selected Tickets
                <span className="ml-2 text-sm font-normal text-gray-400">({selectedTickets.length})</span>
              </h3>
              {selectedTickets.length > 0 && (
                <button onClick={() => setSelectedTickets([])} className="text-sm text-gray-400 hover:text-white transition-colors">Clear selection</button>
              )}
            </div>

            {selectedTickets.length === 0 ? (
              <div className="p-8 text-center bg-gray-800/50 rounded-lg border border-gray-700 border-dashed">
                <p className="text-gray-400 mb-2">No tickets selected</p>
                <button onClick={() => setActiveTab('queue')} className="text-blue-400 hover:text-blue-300 text-sm font-medium">Go to Queue &rarr;</button>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {selectedTicketDetails.map(ticket => {
                  const isCurrentlyAssigned = ticket.assigned_to_name && ticket.assigned_to_name !== 'null'
                  const isUnassigningThis = unassigning === ticket.id
                  return (
                    <div key={ticket.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority?.charAt(0).toUpperCase() + ticket.priority?.slice(1)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{ticket.subject}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">{ticket.ticket_number || `#${ticket.id}`}</span>
                            {isCurrentlyAssigned && (
                              <span className="text-blue-300 text-xs flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                {ticket.assigned_to_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {/* Unassign button — only for currently assigned tickets */}
                        {isCurrentlyAssigned && (
                          <button
                            onClick={() => handleUnassign(ticket.id)}
                            disabled={isUnassigningThis}
                            title="Unassign from current technician"
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              isUnassigningThis
                                ? 'bg-gray-700 text-gray-500 cursor-wait'
                                : 'bg-red-900/40 text-red-400 border border-red-700 hover:bg-red-900/70 hover:text-red-300'
                            }`}
                          >
                            {isUnassigningThis ? 'Removing...' : 'Unassign'}
                          </button>
                        )}
                        {/* View details */}
                        <button
                          onClick={() => { setDetailTicketId(ticket.id); setIsDetailOpen(true) }}
                          className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-blue-400 transition-colors"
                          title="View ticket details"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        {/* Remove from selection */}
                        <button onClick={() => toggleTicket(ticket.id)} className="text-gray-500 hover:text-red-400 transition-colors" title="Remove from selection">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Technician Search & Select */}
          <div>
            <h3 className="text-lg font-bold text-white mb-3">Select Technician</h3>

            {/* Search */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Search technicians by name or email..."
                value={techSearch}
                onChange={(e) => setTechSearch(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Technician list */}
            {techLoading ? (
              <div className="text-center py-6 text-gray-500">Loading technicians...</div>
            ) : filteredTechnicians.length === 0 ? (
              <div className="text-center py-6 text-gray-500">No technicians found</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredTechnicians.map(tech => {
                  const name = tech.full_name || `${tech.first_name} ${tech.last_name}`
                  const count = tech.open_ticket_count ?? 0
                  const isSelected = selectedTechnician?.id === tech.id
                  const tier = getWorkloadTier(count)
                  const barPercent = Math.min(100, (count / maxWorkload) * 100)

                  // Tickets from the selection that are currently assigned to this tech
                  const assignedFromSelection = selectedTicketDetails.filter(
                    t => t.assigned_to_name === name
                  )

                  return (
                    <button
                      key={tech.id}
                      onClick={() => setSelectedTechnician(isSelected ? null : tech)}
                      className={`w-full rounded-lg border transition-all text-left ${
                        isSelected
                          ? 'bg-blue-900/40 border-blue-500 ring-1 ring-blue-500/50'
                          : 'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750'
                      }`}
                    >
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          {/* Avatar with workload-colored border */}
                          <div className={`relative w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 ${tier.avatarBorder} ${tier.avatarBg}`}>
                            {name.charAt(0).toUpperCase()}
                            {/* Pulsing dot for heavy workload */}
                            {count >= 10 && (
                              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-gray-800 animate-pulse"></span>
                            )}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${isSelected ? 'text-blue-200' : 'text-white'}`}>{name}</p>
                            <p className="text-xs text-gray-400">{tech.role === 'senior_technician' ? 'Senior Technician' : 'Technician'}</p>
                            {/* Show which selected tickets are assigned to this tech */}
                            {assignedFromSelection.length > 0 && (
                              <p className="text-xs text-blue-400 mt-0.5">
                                Currently assigned {assignedFromSelection.length} of your selected ticket{assignedFromSelection.length !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Ticket count badge */}
                        <div className="text-right flex-shrink-0">
                          <p className={`text-lg font-bold ${tier.text}`}>{count}</p>
                          <p className="text-xs text-gray-500">{tier.label}</p>
                        </div>
                      </div>

                      {/* Workload progress bar */}
                      <div className="px-3 pb-3">
                        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${tier.barBg}`}
                            style={{ width: `${barPercent}%` }}
                          ></div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Assignment Note */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Assignment Note (optional)</label>
            <textarea
              value={assignmentNote}
              onChange={(e) => setAssignmentNote(e.target.value)}
              placeholder="Add context for the technician..."
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{assignmentNote.length}/500</p>
          </div>

          {/* Error */}
          {assignError && (
            <div className="text-red-400 text-sm bg-red-900/30 border border-red-700 rounded px-3 py-2">
              {assignError}
            </div>
          )}

          </div>

          {/* Assign Button — pinned at bottom */}
          <div className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-900 flex-shrink-0">
            <button onClick={() => setActiveTab('queue')} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">
              &larr; Back to Queue
            </button>
            <button
              onClick={handleAssign}
              disabled={selectedTickets.length === 0 || !selectedTechnician || assigning}
              className={`px-6 py-2.5 rounded-lg font-semibold transition-colors ${
                selectedTickets.length > 0 && selectedTechnician && !assigning
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              {assigning
                ? 'Assigning...'
                : `Assign ${selectedTickets.length} Ticket${selectedTickets.length !== 1 ? 's' : ''}${selectedTechnician ? ` to ${selectedTechnician.full_name || selectedTechnician.first_name}` : ''}`
              }
            </button>
          </div>
        </div>
      )}
    </div>

    {/* Ticket Detail View Modal */}
    <TicketDetailView
      ticketId={detailTicketId}
      isOpen={isDetailOpen}
      onClose={() => setIsDetailOpen(false)}
      onTicketUpdated={onTicketUpdated}
      onMinimize={(data) => { setIsDetailOpen(false); onMinimize?.(data) }}
    />
    </>
  )
}

export default TicketControlWidget
