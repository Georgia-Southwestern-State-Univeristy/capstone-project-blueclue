import { useState, useEffect } from 'react';
import axios from 'axios';

const getAuthHeaders = () => {
    const token = localStorage.getItem('blueclue_token');
    return {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
        }
    };
};

const KBAnalytics = () => {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        setFetchError(null);
        try {
            const response = await axios.get('/api/knowledge-base/analytics', getAuthHeaders());
            setAnalytics(response.data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
            const status = error.response?.status;
            const msg = error.response?.data?.message || error.response?.data?.error || error.message;
            setFetchError(`Failed to load analytics (${status || 'network error'}): ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-700 border-t-blue-500"></div>
                <p className="mt-4 text-gray-400">Loading analytics...</p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="bg-gray-900 rounded-lg border border-red-700 p-8 text-center">
                <p className="text-red-400 font-medium mb-2">Error loading analytics</p>
                <p className="text-gray-400 text-sm">{fetchError}</p>
                <button onClick={fetchAnalytics} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                    Retry
                </button>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-12 text-center text-gray-400">
                <p>No analytics data available</p>
            </div>
        );
    }

    const { overview = {}, most_viewed, least_viewed, by_category } = analytics;

    return (
        <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-400">Total Articles</p>
                            <p className="text-3xl font-bold text-gray-200 mt-2">
                                {overview.total_articles || 0}
                            </p>
                        </div>
                        <div className="p-3 bg-blue-900/50 rounded-lg">
                            <svg className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <span className="text-xs text-green-600 font-medium">
                            {overview.published_articles} Published
                        </span>
                        <span className="text-xs text-yellow-600 font-medium">
                            {overview.draft_articles} Drafts
                        </span>
                    </div>
                </div>

                <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-400">Total Views</p>
                            <p className="text-3xl font-bold text-gray-200 mt-2">
                                {overview.total_views || 0}
                            </p>
                        </div>
                        <div className="p-3 bg-purple-900/50 rounded-lg">
                            <svg className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">
                        Avg {overview.total_articles > 0 ? Math.round(overview.total_views / overview.total_articles) : 0} views per article
                    </p>
                </div>

                <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-400">Helpful Votes</p>
                            <p className="text-3xl font-bold text-gray-200 mt-2">
                                {overview.total_helpful_votes || 0}
                            </p>
                        </div>
                        <div className="p-3 bg-green-900/50 rounded-lg">
                            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">
                        {overview.total_feedback_submitted || 0} feedback submissions
                    </p>
                </div>

                <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-400">Categories</p>
                            <p className="text-3xl font-bold text-gray-200 mt-2">
                                {overview.total_categories || 0}
                            </p>
                        </div>
                        <div className="p-3 bg-yellow-900/50 rounded-lg">
                            <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">
                        {overview.total_versions_saved || 0} versions saved
                    </p>
                </div>
            </div>

            {/* Most Viewed Articles */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-200 mb-4">Most Viewed Articles</h3>
                {most_viewed && most_viewed.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-800">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Rank
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Title
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Views
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Helpfulness
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-gray-900 divide-y divide-gray-800">
                                {most_viewed.map((article, idx) => (
                                    <tr key={article.id} className="hover:bg-gray-800/50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-200">
                                            #{idx + 1}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-200">
                                            {article.title}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-700 text-gray-800">
                                                {article.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200 font-semibold">
                                            {article.views}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="text-sm text-gray-200 font-medium">
                                                    {article.helpfulness_percentage || 0}%
                                                </div>
                                                <div className="ml-2 text-xs text-gray-400">
                                                    ({article.helpful_votes}↑ {article.not_helpful_votes}↓)
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-gray-400 text-center py-8">No data available</p>
                )}
            </div>

            {/* Least Viewed Articles (Content Gaps) */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-200">Least Viewed Articles</h3>
                    <span className="text-sm text-gray-400">Potential content gaps</span>
                </div>
                {least_viewed && least_viewed.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-800">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Title
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Views
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Published
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-gray-900 divide-y divide-gray-800">
                                {least_viewed.map((article) => (
                                    <tr key={article.id} className="hover:bg-gray-800/50">
                                        <td className="px-6 py-4 text-sm text-gray-200">
                                            {article.title}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-700 text-gray-800">
                                                {article.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                                            {article.views}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                            {new Date(article.published_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-gray-400 text-center py-8">No data available</p>
                )}
            </div>

            {/* Category Performance */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-200 mb-4">Performance by Category</h3>
                {by_category && by_category.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-800">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Articles
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Total Views
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Avg Views
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Helpful/Not Helpful
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-gray-900 divide-y divide-gray-800">
                                {by_category.map((cat) => (
                                    <tr key={cat.category} className="hover:bg-gray-800/50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 text-sm font-semibold rounded-full bg-gray-700 text-gray-800">
                                                {cat.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                                            {cat.article_count}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200 font-semibold">
                                            {cat.total_views || 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                                            {cat.avg_views ? Math.round(parseFloat(cat.avg_views)) : 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                                            <span className="text-green-600">{cat.total_helpful || 0}↑</span>
                                            {' / '}
                                            <span className="text-red-600">{cat.total_not_helpful || 0}↓</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-gray-400 text-center py-8">No data available</p>
                )}
            </div>
        </div>
    );
};

export default KBAnalytics;
