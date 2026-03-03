import React, { useState, useEffect } from 'react';
import { FileText, TrendingUp, Loader2, ArrowRight } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const RelatedArticles = ({ articleId, limit = 5 }) => {
    const [relatedArticles, setRelatedArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!articleId) return;

        const fetchRelatedArticles = async () => {
            setLoading(true);
            setError(null);
            
            try {
                const response = await axios.get(
                    `${API_BASE_URL}/api/knowledge-base/articles/${articleId}/related?limit=${limit}`
                );
                setRelatedArticles(response.data.related || []);
            } catch (err) {
                console.error('Error fetching related articles:', err);
                setError('Failed to load related articles');
            } finally {
                setLoading(false);
            }
        };

        fetchRelatedArticles();
    }, [articleId, limit]);

    // Don't render if no article ID
    if (!articleId) return null;

    // Loading state
    if (loading) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-semibold text-white">Related Articles</h3>
                </div>
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-semibold text-white">Related Articles</h3>
                </div>
                <p className="text-gray-400 text-sm">{error}</p>
            </div>
        );
    }

    // No related articles found
    if (!relatedArticles || relatedArticles.length === 0) {
        return null; // Don't show the section if no related articles
    }

    // Get difficulty color
    const getDifficultyColor = (difficulty) => {
        switch (difficulty) {
            case 'beginner':
                return 'bg-green-900/50 text-green-300';
            case 'intermediate':
                return 'bg-yellow-900/50 text-yellow-300';
            case 'advanced':
                return 'bg-red-900/50 text-red-300';
            default:
                return 'bg-gray-700 text-gray-300';
        }
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Related Articles</h3>
            </div>

            {/* Related Articles List */}
            <div className="space-y-3">
                {relatedArticles.map((article) => (
                    <a
                        key={article.id}
                        href={`/kb/${article.slug}`}
                        className="block group"
                    >
                        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:bg-gray-900 transition-all">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                        <h4 className="font-medium text-gray-200 group-hover:text-blue-400 transition-colors truncate">
                                            {article.title}
                                        </h4>
                                    </div>
                                    
                                    {article.excerpt && (
                                        <p className="text-sm text-gray-400 line-clamp-2 mb-2">
                                            {article.excerpt}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                        <span className="text-blue-400">{article.category}</span>
                                        <span>•</span>
                                        <span>{article.views} views</span>
                                        {article.helpful_votes > 0 && (
                                            <>
                                                <span>•</span>
                                                <span>{article.helpful_votes} helpful</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    <span className={`px-2 py-1 text-xs rounded ${getDifficultyColor(article.difficulty)}`}>
                                        {article.difficulty}
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>

                            {/* Tags */}
                            {article.tags && Array.isArray(article.tags) && article.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                    {article.tags.slice(0, 3).map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                    {article.tags.length > 3 && (
                                        <span className="px-2 py-0.5 text-gray-500 text-xs">
                                            +{article.tags.length - 3} more
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </a>
                ))}
            </div>

            {/* View All Link (optional) */}
            {relatedArticles.length >= limit && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                    <a
                        href="/kb/search"
                        className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                    >
                        <span>Browse all articles</span>
                        <ArrowRight className="w-4 h-4" />
                    </a>
                </div>
            )}
        </div>
    );
};

export default RelatedArticles;
