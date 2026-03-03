import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

const getAuthHeaders = () => {
    const token = localStorage.getItem('blueclue_token');
    return {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
        }
    };
};

const VersionHistory = ({ articleId, onClose, onRestore }) => {
    const [versions, setVersions] = useState([]);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [viewingVersion, setViewingVersion] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchVersions();
    }, [fetchVersions]);

    const fetchVersions = useCallback(async () => {
        try {
            const response = await axios.get(`/api/knowledge-base/articles/${articleId}/versions`, getAuthHeaders());
            setVersions(response.data);
        } catch (error) {
            console.error('Error fetching versions:', error);
            alert('Failed to fetch version history');
        } finally {
            setLoading(false);
        }
    }, [articleId]);

    const handleViewVersion = async (versionNumber) => {
        try {
            const response = await axios.get(
                `/api/knowledge-base/articles/${articleId}/versions/${versionNumber}`,
                getAuthHeaders()
            );
            setViewingVersion(response.data);
        } catch (error) {
            console.error('Error fetching version details:', error);
            alert('Failed to fetch version details');
        }
    };

    const handleRestoreVersion = async (versionNumber) => {
        if (!confirm(`Are you sure you want to restore to version ${versionNumber}? This will create a new version with the restored content.`)) {
            return;
        }

        try {
            await axios.post(
                `/api/knowledge-base/articles/${articleId}/versions/${versionNumber}/restore`,
                {},
                getAuthHeaders()
            );
            alert('Version restored successfully');
            onRestore();
        } catch (error) {
            console.error('Error restoring version:', error);
            alert('Failed to restore version');
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm z-[60] p-4">
            <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-5xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <h3 className="text-xl font-bold text-gray-200">Version History</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-400 transition-colors"
                        aria-label="Close"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Version List */}
                    <div className="w-1/3 border-r border-gray-800 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-gray-700 border-t-blue-500"></div>
                                <p className="mt-2 text-sm text-gray-400">Loading versions...</p>
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <p>No version history available</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-800">
                                {versions.map((version) => (
                                    <div
                                        key={version.id}
                                        className={`p-4 cursor-pointer hover:bg-gray-800/50 transition-colors ${
                                            selectedVersion === version.version_number ? 'bg-blue-50' : ''
                                        }`}
                                        onClick={() => {
                                            setSelectedVersion(version.version_number);
                                            handleViewVersion(version.version_number);
                                        }}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-200">
                                                        Version {version.version_number}
                                                    </span>
                                                    {version.is_latest_version && (
                                                        <span className="px-2 py-0.5 text-xs font-medium bg-green-900/50 text-green-300 rounded">
                                                            Current
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {formatDate(version.version_created_at)}
                                                </p>
                                                <p className="text-sm text-gray-400 mt-1">
                                                    By {version.edited_by_name}
                                                </p>
                                                {version.change_summary && (
                                                    <p className="text-xs text-gray-400 mt-1 italic">
                                                        {version.change_summary}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Version Details */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {!viewingVersion ? (
                            <div className="text-center text-gray-400 mt-12">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="mt-4">Select a version to view details</p>
                            </div>
                        ) : (
                            <div>
                                {/* Version Info */}
                                <div className="mb-6 pb-4 border-b border-gray-800">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-lg font-semibold text-gray-200">
                                            Version {viewingVersion.version_number}
                                        </h4>
                                        <button
                                            onClick={() => handleRestoreVersion(viewingVersion.version_number)}
                                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Restore This Version
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-400">Created:</span>
                                            <span className="ml-2 text-gray-200">
                                                {formatDate(viewingVersion.created_at)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Category:</span>
                                            <span className="ml-2 text-gray-200">{viewingVersion.category}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Difficulty:</span>
                                            <span className="ml-2 text-gray-200 capitalize">{viewingVersion.difficulty}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Published:</span>
                                            <span className="ml-2 text-gray-200">
                                                {viewingVersion.is_published ? 'Yes' : 'No'}
                                            </span>
                                        </div>
                                    </div>
                                    {viewingVersion.tags && Array.isArray(viewingVersion.tags) && viewingVersion.tags.length > 0 && (
                                        <div className="mt-3">
                                            <span className="text-sm text-gray-400">Tags:</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {viewingVersion.tags.map((tag, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-0.5 text-xs font-medium bg-blue-900/50 text-blue-300 rounded"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Title */}
                                <div className="mb-4">
                                    <h5 className="text-sm font-medium text-gray-400 mb-1">Title</h5>
                                    <p className="text-lg font-semibold text-gray-200">{viewingVersion.title}</p>
                                </div>

                                {/* Excerpt */}
                                {viewingVersion.excerpt && (
                                    <div className="mb-4">
                                        <h5 className="text-sm font-medium text-gray-400 mb-1">Excerpt</h5>
                                        <p className="text-sm text-gray-400">{viewingVersion.excerpt}</p>
                                    </div>
                                )}

                                {/* Content */}
                                <div>
                                    <h5 className="text-sm font-medium text-gray-400 mb-2">Content</h5>
                                    <div className="prose prose-sm max-w-none bg-gray-800/50 p-4 rounded-lg">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeHighlight]}
                                        >
                                            {viewingVersion.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VersionHistory;
