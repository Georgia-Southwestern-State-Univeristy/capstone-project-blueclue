import { useState, useEffect, useRef } from 'react';
import { getUserRole, getCurrentUser } from '../services/authService';
import { getSocket } from '../services/socketService';
import { formatTimeAgo as _fmtTimeAgo } from '../utils/dateFormatter';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('blueclue_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

/**
 * TicketComments Component
 * Displays threaded comments with reactions, role-based filtering, and real-time updates
 */
function TicketComments({ ticketId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // Parent comment for threading
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const commentsEndRef = useRef(null);
  const textareaRef = useRef(null);
  
  const userRole = getUserRole();
  const currentUser = getCurrentUser();
  const userId = currentUser?.id;
  const canCreateInternal = userRole === 'technician' || userRole === 'management';
  const MAX_CHARS = 2000;

  const ALLOWED_EMOJIS = [];

  // Fetch comments
  useEffect(() => {
    if (!ticketId) return;

    const fetchComments = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/comments`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        });

        if (!response.ok) throw new Error('Failed to fetch comments');

        const data = await response.json();
        setComments(data.data || []);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [ticketId]);

  // Socket.IO real-time updates
  useEffect(() => {
    if (!ticketId) return;

    const io = getSocket();
    if (!io) return;

    // Join ticket room for real-time updates
    io.emit('join_ticket_room', ticketId);

    // Listen for new comments
    const handleNewComment = (data) => {
      if (data.ticketId === ticketId) {
        setComments((prev) => [...prev, data.comment]);
        scrollToBottom();
      }
    };

    // Listen for comment updates
    const handleCommentUpdated = (data) => {
      if (data.ticketId === ticketId) {
        setComments((prev) =>
          prev.map((c) => (c.id === data.comment.id ? data.comment : c))
        );
      }
    };

    // Listen for comment deletions
    const handleCommentDeleted = (data) => {
      if (data.ticketId === ticketId) {
        setComments((prev) => prev.filter((c) => c.id !== data.commentId));
      }
    };

    // Listen for reactions
    const handleReactionAdded = (data) => {
      if (data.ticketId === ticketId) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === data.commentId
              ? { ...c, reaction_count: data.reactionCount }
              : c
          )
        );
      }
    };

    const handleReactionRemoved = (data) => {
      if (data.ticketId === ticketId) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === data.commentId
              ? { ...c, reaction_count: data.reactionCount }
              : c
          )
        );
      }
    };

    io.on('new_comment', handleNewComment);
    io.on('comment_updated', handleCommentUpdated);
    io.on('comment_deleted', handleCommentDeleted);
    io.on('reaction_added', handleReactionAdded);
    io.on('reaction_removed', handleReactionRemoved);

    return () => {
      if (io) {
        io.emit('leave_ticket_room', ticketId);
        io.off('new_comment', handleNewComment);
        io.off('comment_updated', handleCommentUpdated);
        io.off('comment_deleted', handleCommentDeleted);
        io.off('reaction_added', handleReactionAdded);
        io.off('reaction_removed', handleReactionRemoved);
      }
    };
  }, [ticketId]);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Formatting functions for rich text
  const insertFormatting = (before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = newComment.substring(start, end);
    const newText =
      newComment.substring(0, start) +
      before +
      selectedText +
      after +
      newComment.substring(end);

    setNewComment(newText);
    
    // Restore focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const formatBold = () => insertFormatting('**', '**');
  const formatItalic = () => insertFormatting('*', '*');
  const formatCode = () => insertFormatting('`', '`');
  const formatLink = () => {
    const url = prompt('Enter URL:');
    if (url) insertFormatting('[', `](${url})`);
  };
  const formatList = () => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const lineStart = newComment.lastIndexOf('\n', start - 1) + 1;
    const beforeLine = newComment.substring(0, lineStart);
    const afterLine = newComment.substring(lineStart);
    setNewComment(beforeLine + '- ' + afterLine);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + 2, lineStart + 2);
    }, 0);
  };

  // Render markdown-like preview
  const renderPreview = (text) => {
    let html = text;
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Code
    html = html.replace(/`(.*?)`/g, '<code class="bg-gray-800 px-1 rounded">$1</code>');
    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
    // Lists
    html = html.replace(/^- (.*)$/gm, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li.*<\/li>)/s, '<ul class="list-disc">$1</ul>');
    // Line breaks
    html = html.replace(/\n/g, '<br />');
    return html;
  };

  // Submit new comment
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          content: newComment.trim(),
          isInternal,
          parentCommentId: replyTo?.id || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to post comment');

      const data = await response.json();
      setComments((prev) => [...prev, data.data]);
      setNewComment('');
      setIsInternal(false);
      setReplyTo(null);
      scrollToBottom();
    } catch (err) {
      alert('Failed to post comment: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete comment
  const handleDelete = async (commentId) => {
    if (!confirm('Delete this comment?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to delete comment');

      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      alert('Failed to delete comment: ' + err.message);
    }
  };

  // Start editing
  const startEdit = (comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  // Save edit
  const saveEdit = async (commentId) => {
    if (!editContent.trim()) return;

    try {
      const response = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (!response.ok) throw new Error('Failed to update comment');

      const data = await response.json();
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? data.data : c))
      );
      setEditingId(null);
      setEditContent('');
    } catch (err) {
      alert('Failed to update comment: ' + err.message);
    }
  };

  // Add reaction
  const addReaction = async (commentId, emoji) => {
    try {
      const response = await fetch(`${API_BASE_URL}/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) throw new Error('Failed to add reaction');

      const data = await response.json();
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? data.data : c))
      );
    } catch (err) {
      console.error('Failed to add reaction:', err);
    }
  };

  // Remove reaction
  const removeReaction = async (commentId, emoji) => {
    try {
      const response = await fetch(`${API_BASE_URL}/comments/${commentId}/reactions/${emoji}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to remove reaction');

      const data = await response.json();
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? data.data : c))
      );
    } catch (err) {
      console.error('Failed to remove reaction:', err);
    }
  };

  // Organize comments into threads
  const organizeThreads = () => {
    const topLevel = comments.filter((c) => !c.parent_comment_id);
    const replies = comments.filter((c) => c.parent_comment_id);

    return topLevel.map((parent) => ({
      ...parent,
      replies: replies.filter((r) => r.parent_comment_id === parent.id),
    }));
  };

  // Format date
  const formatDate = (dateString) => {
    return _fmtTimeAgo(dateString) || 'Just now';
  };

  // Render single comment
  const renderComment = (comment, isReply = false) => {
    const isOwner = comment.user_id === userId;
    const isInternalComment = comment.is_internal;
    const canEdit = isOwner && !isReply;
    const canDelete = isOwner || userRole === 'management';
    const isEditing = editingId === comment.id;

    return (
      <div
        key={comment.id}
        className={`${
          isReply ? 'ml-8 pl-4 border-l-2 border-gray-700' : ''
        } ${isInternalComment ? 'bg-amber-900/10 border border-amber-800/30 rounded-lg p-4' : 'p-4'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
              {comment.first_name?.[0]}{comment.last_name?.[0]}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-200 font-medium text-sm">
                  {comment.first_name} {comment.last_name}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    comment.user_type === 'management'
                      ? 'bg-purple-900/30 text-purple-400'
                      : comment.user_type === 'tech'
                      ? 'bg-blue-900/30 text-blue-400'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {comment.role_name || comment.user_type}
                </span>
                {isInternalComment && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Internal</span>
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">{formatDate(comment.created_at)}</span>
            </div>
          </div>
          {(canEdit || canDelete) && !isEditing && (
            <div className="flex items-center space-x-2">
              {canEdit && (
                <button
                  onClick={() => startEdit(comment)}
                  className="text-gray-500 hover:text-blue-400 text-xs"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="text-gray-500 hover:text-red-400 text-xs"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-gray-900 border border-blue-500/50 rounded-lg px-3 py-2 text-gray-300 text-sm focus:outline-none focus:border-blue-500"
              rows={3}
            />
            <div className="flex items-center space-x-2">
              <button
                onClick={() => saveEdit(comment.id)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingId(null);
                  setEditContent('');
                }}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className="text-gray-300 text-sm whitespace-pre-wrap break-words mb-3 prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderPreview(comment.content) }}
          />
        )}

        {/* Reactions */}
        {!isEditing && (
          <div className="flex items-center space-x-2 flex-wrap">
            {ALLOWED_EMOJIS.map((emoji) => {
              const count = comment.reaction_count?.[emoji] || 0;
              return (
                <button
                  key={emoji}
                  onClick={() =>
                    count > 0 ? removeReaction(comment.id, emoji) : addReaction(comment.id, emoji)
                  }
                  className={`px-2 py-1 rounded text-xs flex items-center space-x-1 transition-colors ${
                    count > 0
                      ? 'bg-blue-900/30 text-blue-400 border border-blue-800/50'
                      : 'bg-gray-800/50 text-gray-500 hover:bg-gray-700/50 border border-transparent'
                  }`}
                >
                  <span>{emoji}</span>
                  {count > 0 && <span className="font-medium">{count}</span>}
                </button>
              );
            })}
            {!isReply && (
              <button
                onClick={() => setReplyTo(comment)}
                className="text-xs text-gray-500 hover:text-blue-400 ml-2"
              >
                Reply
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const threads = organizeThreads();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading comments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-3xl">
      {/* Comments list */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {threads.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          threads.map((thread) => (
            <div key={thread.id} className="space-y-2">
              {renderComment(thread)}
              {thread.replies?.map((reply) => renderComment(reply, true))}
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Reply indicator */}
      {replyTo && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 mb-2 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Replying to <span className="text-blue-400">{replyTo.first_name}</span>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-gray-500 hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Comment composer */}
      <form onSubmit={handleSubmit} className="border-t border-gray-800 pt-4">
        <div className="space-y-2">
          {/* Formatting toolbar */}
          <div className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-t-lg px-3 py-2">
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={formatBold}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="Bold (Ctrl+B)"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 000 2h.586l-6.293 6.293a1 1 0 101.414 1.414L13 6.414V7a1 1 0 102 0V3h-4z"/>
                  <text x="3" y="15" fontSize="12" fontWeight="bold">B</text>
                </svg>
              </button>
              <button
                type="button"
                onClick={formatItalic}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="Italic (Ctrl+I)"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <text x="6" y="15" fontSize="12" fontStyle="italic">I</text>
                </svg>
              </button>
              <button
                type="button"
                onClick={formatList}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="List"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                type="button"
                onClick={formatLink}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="Link"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                type="button"
                onClick={formatCode}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors font-mono text-xs"
                title="Code"
              >
                &lt;/&gt;
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={`text-xs px-3 py-1 rounded transition-colors ${
                showPreview
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          </div>

          {/* Editor/Preview */}
          {showPreview ? (
            <div
              className="w-full bg-gray-900 border border-gray-700 border-t-0 rounded-b-lg px-4 py-3 text-gray-300 text-sm min-h-[80px] prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: renderPreview(newComment) || '<span class="text-gray-500 italic">Nothing to preview</span>' }}
            />
          ) : (
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyTo ? `Reply to ${replyTo.first_name}...` : 'Write a comment...'}
              className="w-full bg-gray-900 border border-gray-700 border-t-0 rounded-b-lg px-4 py-3 text-gray-300 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none"
              rows={4}
              maxLength={MAX_CHARS}
            />
          )}

          {/* Footer controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {canCreateInternal && (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-400">Internal (tech-only)</span>
                </label>
              )}
              <span className={`text-xs ${
                newComment.length > MAX_CHARS * 0.9
                  ? 'text-red-400 font-medium'
                  : newComment.length > MAX_CHARS * 0.75
                  ? 'text-yellow-400'
                  : 'text-gray-500'
              }`}>
                {newComment.length}/{MAX_CHARS}
              </span>
            </div>
            <button
              type="submit"
              disabled={!newComment.trim() || submitting || newComment.length > MAX_CHARS}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors font-medium"
            >
              {submitting ? (
                <span className="flex items-center space-x-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <span>Posting...</span>
                </span>
              ) : (
                replyTo ? 'Reply' : 'Comment'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default TicketComments;
