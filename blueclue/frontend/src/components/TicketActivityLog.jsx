import { useState, useEffect, useCallback } from 'react'
import { getTicketHistory } from '../services/ticketService'
import { formatDateTime } from '../utils/dateFormatter'
import RelativeTime from './RelativeTime'

/**
 * TicketActivityLog
 * Displays the activity history / audit log for a single ticket.
 * Shows assignment, reassignment, status changes, priority changes, etc.
 */
function TicketActivityLog({ ticketId, isOpen = true }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchHistory = useCallback(async () => {
    if (!ticketId) return
    setLoading(true)
    setError(null)
    try {
      const res = await getTicketHistory(ticketId)
      setHistory(res.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    if (isOpen && ticketId) {
      fetchHistory()
    }
  }, [isOpen, ticketId, fetchHistory])

  if (!isOpen) return null

  // (timeline timestamps rendered by <RelativeTime> component)

  // Get icon + color for each change type
  const getChangeTypeInfo = (changeType) => {
    switch (changeType) {
      case 'ticket_assigned':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
          color: 'text-blue-400',
          bgColor: 'bg-blue-900/30',
          label: 'Assigned'
        }
      case 'ticket_reassigned':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          ),
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-900/30',
          label: 'Reassigned'
        }
      case 'assignment':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
          color: 'text-blue-400',
          bgColor: 'bg-blue-900/30',
          label: 'Assigned'
        }
      case 'ticket_unassigned':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6h12a6 6 0 00-6-6zM21 12h-6" />
            </svg>
          ),
          color: 'text-red-400',
          bgColor: 'bg-red-900/30',
          label: 'Unassigned'
        }
      case 'status_change':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-green-400',
          bgColor: 'bg-green-900/30',
          label: 'Status Changed'
        }
      case 'ticket_cancelled':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          ),
          color: 'text-gray-400',
          bgColor: 'bg-gray-800',
          label: 'Cancelled'
        }
      case 'priority_change':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          color: 'text-orange-400',
          bgColor: 'bg-orange-900/30',
          label: 'Priority Changed'
        }
      case 'category_change':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ),
          color: 'text-purple-400',
          bgColor: 'bg-purple-900/30',
          label: 'Category Changed'
        }
      case 'field_edited':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          ),
          color: 'text-cyan-400',
          bgColor: 'bg-cyan-900/30',
          label: 'Edited'
        }
      case 'update_requested':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-amber-400',
          bgColor: 'bg-amber-900/30',
          label: 'Update Requested'
        }
      case 'update_fulfilled':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-900/30',
          label: 'Update Provided'
        }
      default:
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-gray-400',
          bgColor: 'bg-gray-800',
          label: changeType?.replace(/_/g, ' ') || 'Change'
        }
    }
  }

  // Build a human-readable description for an entry
  const getDescription = (entry) => {
    const details = entry.change_details || {}
    const by = details.assigned_by_name || entry.changed_by_name || 'System'

    switch (entry.change_type) {
      case 'ticket_assigned':
        return (
          <span>
            <span className="text-white font-medium">{by}</span>
            {' assigned to '}
            <span className="text-blue-300 font-medium">{details.assigned_to_name || `User #${entry.new_value}`}</span>
            {details.action === 'bulk_assign' && <span className="text-gray-500 text-xs ml-1">(bulk)</span>}
          </span>
        )
      case 'ticket_reassigned':
        return (
          <span>
            <span className="text-white font-medium">{by}</span>
            {' reassigned from '}
            <span className="text-gray-300">{details.previous_assignee_name || `User #${entry.old_value}`}</span>
            {' to '}
            <span className="text-blue-300 font-medium">{details.assigned_to_name || `User #${entry.new_value}`}</span>
          </span>
        )
      case 'ticket_unassigned':
        return (
          <span>
            <span className="text-white font-medium">{details.unassigned_by_name || by}</span>
            {' unassigned '}
            <span className="text-red-300">{details.previous_assignee_name || `User #${entry.old_value}`}</span>
          </span>
        )
      case 'assignment':
        // From the DB trigger (basic entry, no change_details)
        return (
          <span>
            {'Assigned to '}
            <span className="text-blue-300 font-medium">Technician #{entry.new_value}</span>
            {entry.old_value && entry.old_value !== 'unassigned' && (
              <>
                {' (was '}
                <span className="text-gray-300">#{entry.old_value}</span>
                {')'}
              </>
            )}
          </span>
        )
      case 'status_change':
        return (
          <span>
            {'Status changed from '}
            <span className="text-gray-300">{entry.old_value?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
            {' to '}
            <span className="text-green-300 font-medium">{entry.new_value?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
          </span>
        )
      case 'ticket_cancelled': {
        const cancelInfo = entry.change_details || {}
        const cancelledBy = cancelInfo.cancelled_by_name || entry.changed_by_name || 'Unknown'
        const cancelReason = cancelInfo.reason || 'No reason provided'
        const cancelExtra = cancelInfo.details
        const prevStatus = cancelInfo.previous_status?.replace(/_/g, ' ') || entry.old_value?.replace(/_/g, ' ')
        return (
          <span>
            <span className="text-white font-medium">{cancelledBy}</span>
            {' cancelled this ticket'}
            {prevStatus && <span className="text-gray-500"> (was {prevStatus})</span>}
            <br />
            <span className="text-gray-400">Reason: </span>
            <span className="text-gray-200">{cancelReason}</span>
            {cancelExtra && (
              <>
                <br />
                <span className="text-gray-400">Details: </span>
                <span className="text-gray-300">{cancelExtra}</span>
              </>
            )}
          </span>
        )
      }
      case 'priority_change':
        return (
          <span>
            {'Priority changed from '}
            <span className="text-gray-300">{entry.old_value}</span>
            {' to '}
            <span className="text-orange-300 font-medium">{entry.new_value}</span>
          </span>
        )
      case 'category_change':
        return (
          <span>
            {'Category changed from '}
            <span className="text-gray-300">{entry.old_value}</span>
            {' to '}
            <span className="text-purple-300 font-medium">{entry.new_value}</span>
          </span>
        )
      case 'field_edited': {
        const editDetails = entry.change_details || {}
        const editedBy = editDetails.edited_by_name || entry.changed_by_name || 'Someone'
        const fieldLabel = (entry.field_name || 'field').replace(/_/g, ' ')
        return (
          <span>
            <span className="text-white font-medium">{editedBy}</span>
            {' edited '}
            <span className="text-cyan-300 font-medium">{fieldLabel}</span>
            {entry.old_value && entry.new_value && (
              <>
                {' from '}
                <span className="text-gray-400">&ldquo;{entry.old_value.length > 60 ? entry.old_value.slice(0, 60) + '...' : entry.old_value}&rdquo;</span>
                {' to '}
                <span className="text-gray-200">&ldquo;{entry.new_value.length > 60 ? entry.new_value.slice(0, 60) + '...' : entry.new_value}&rdquo;</span>
              </>
            )}
          </span>
        )
      }
      case 'update_requested': {
        const reqDetails = entry.change_details || {}
        const requestedBy = reqDetails.requested_by_name || entry.changed_by_name || 'Manager'
        const assignedName = reqDetails.assigned_to_name || 'Technician'
        const deadline = reqDetails.deadline ? formatDateTime(reqDetails.deadline, {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        }) : 'N/A'
        const message = reqDetails.message
        return (
          <span>
            <span className="text-white font-medium">{requestedBy}</span>
            {' requested a status update from '}
            <span className="text-amber-300 font-medium">{assignedName}</span>
            <br />
            <span className="text-gray-400">Deadline: </span>
            <span className="text-gray-200">{deadline}</span>
            {message && (
              <>
                <br />
                <span className="text-gray-400">Request: </span>
                <span className="text-gray-300">&ldquo;{message}&rdquo;</span>
              </>
            )}
          </span>
        )
      }
      case 'update_fulfilled': {
        const fulfillDetails = entry.change_details || {}
        const fulfilledBy = fulfillDetails.fulfilled_by_name || entry.changed_by_name || 'Technician'
        const responseText = fulfillDetails.response_text || 'No details provided'
        const isResolved = fulfillDetails.is_resolved
        const isBlocked = fulfillDetails.is_blocked
        const needsMoreTime = fulfillDetails.needs_more_time
        const blockerDesc = fulfillDetails.blocker_description
        const estimatedCompletion = fulfillDetails.estimated_completion
        
        let statusBadge = ''
        if (isResolved) statusBadge = 'Resolved'
        else if (isBlocked) statusBadge = 'Blocked'
        else if (needsMoreTime) statusBadge = 'Needs More Time'
        
        return (
          <span>
            <span className="text-white font-medium">{fulfilledBy}</span>
            {' provided a status update'}
            {statusBadge && <span className="ml-2 text-xs font-semibold text-gray-200">({statusBadge})</span>}
            <br />
            <span className="text-gray-400">Update: </span>
            <span className="text-gray-200">&ldquo;{responseText.length > 100 ? responseText.slice(0, 100) + '...' : responseText}&rdquo;</span>
            {isBlocked && blockerDesc && (
              <>
                <br />
                <span className="text-red-400">Blocker: </span>
                <span className="text-gray-300">{blockerDesc}</span>
              </>
            )}
            {estimatedCompletion && (
              <>
                <br />
                <span className="text-gray-400">Est. Completion: </span>
                <span className="text-gray-200">{formatDateTime(estimatedCompletion, {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                })}</span>
              </>
            )}
          </span>
        )
      }
      default:
        return (
          <span>
            {entry.field_name && `${entry.field_name}: `}
            {entry.old_value && <span className="text-gray-300">{entry.old_value}</span>}
            {entry.old_value && entry.new_value && ' → '}
            {entry.new_value && <span className="text-white font-medium">{entry.new_value}</span>}
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="text-center py-6 text-gray-500">
        <div className="animate-spin w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full mx-auto mb-2" />
        Loading activity...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-6 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        No activity recorded yet.
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {history.map((entry, idx) => {
        const info = getChangeTypeInfo(entry.change_type)
        const isLast = idx === history.length - 1

        // Skip trigger-generated 'assignment' entries when we have a rich 'ticket_assigned' entry nearby
        // (the trigger fires on the same UPDATE, so they'll have similar timestamps)
        if (entry.change_type === 'assignment' && !entry.change_details) {
          const hasRichEntry = history.some(
            h => (h.change_type === 'ticket_assigned' || h.change_type === 'ticket_reassigned') &&
                 h.change_details &&
                 Math.abs(new Date(h.created_at) - new Date(entry.created_at)) < 5000 &&
                 h.ticket_id === entry.ticket_id
          )
          if (hasRichEntry) return null
        }

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${info.bgColor} ${info.color} flex-shrink-0`}>
                {info.icon}
              </div>
              {!isLast && <div className="w-px flex-1 bg-gray-700 my-1" />}
            </div>

            {/* Content */}
            <div className="pb-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-semibold uppercase tracking-wide ${info.color}`}>
                  {info.label}
                </span>
                <RelativeTime timestamp={entry.created_at} className="text-xs text-gray-500" />
              </div>
              <div className="text-sm text-gray-300">
                {getDescription(entry)}
              </div>
              {entry.comment && (
                <div className="mt-1 text-xs text-gray-400 italic bg-gray-800/50 rounded px-2 py-1 border-l-2 border-gray-600">
                  &ldquo;{entry.comment}&rdquo;
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default TicketActivityLog
