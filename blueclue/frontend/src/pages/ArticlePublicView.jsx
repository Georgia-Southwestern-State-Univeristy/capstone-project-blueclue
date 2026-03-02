import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

const ArticlePublicView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [article, setArticle] = useState(null);
    const [relatedArticles, setRelatedArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [voted, setVoted] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchArticle = useCallback(async () => {
        try {
            const response = await axios.get(`/api/knowledge-base/public/articles/${id}`);
            setArticle(response.data);
        } catch (error) {
            console.error('Error fetching article:', error);
            if (error.response?.status === 404) {
                console.error('Article not found');
            }
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchRelatedArticles = useCallback(async () => {
        try {
            const response = await axios.get(`/api/knowledge-base/articles/${id}/related`);
            setRelatedArticles(response.data.related || []);
        } catch (error) {
            console.error('Error fetching related articles:', error);
        }
    }, [id]);

    const incrementViewCount = useCallback(async () => {
        try {
            await axios.post(`/api/knowledge-base/articles/${id}/view`);
        } catch (error) {
            console.error('Error incrementing view count:', error);
        }
    }, [id]);

    useEffect(() => {
        if (id) {
            fetchArticle();
            fetchRelatedArticles();
            incrementViewCount();
        }
    }, [id, fetchArticle, fetchRelatedArticles, incrementViewCount]);

    const handleVote = async (wasHelpful) => {
        try {
            setSubmitting(true);
            await axios.post(`/api/knowledge-base/articles/${id}/feedback`, {
                wasHelpful,
                feedback: feedbackText || null
            });
            
            setVoted(true);
            setShowFeedback(false);
            
            // Refresh article to get updated vote counts
            setTimeout(fetchArticle, 500);
        } catch (error) {
            console.error('Error submitting feedback:', error);
            if (error.response?.status === 409) {
                alert('You have already voted on this article');
                setVoted(true);
            } else {
                alert('Failed to submit feedback. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const getDifficultyBadge = (difficulty) => {
        const badges = {
            'beginner': { bg: 'bg-green-900', text: 'text-green-300', label: 'Beginner' },
            'intermediate': { bg: 'bg-yellow-900', text: 'text-yellow-300', label: 'Intermediate' },
            'advanced': { bg: 'bg-red-900', text: 'text-red-300', label: 'Advanced' }
        };
        return badges[difficulty] || badges.beginner;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-700 border-t-blue-500 mb-4"></div>
                    <p className="text-gray-400">Loading article...</p>
                </div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-200 mb-4">Article Not Found</h2>
                    <p className="text-gray-400 mb-6">The article you're looking for doesn't exist or has been removed.</p>
                    <button
                        onClick={() => navigate('/faq')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                        Back to Knowledge Base
                    </button>
                </div>
            </div>
        );
    }

    const difficultyBadge = getDifficultyBadge(article.difficulty);
    const helpfulPercentage = article.helpfulness_percentage || 0;

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-700 py-8">
                <div className="max-w-4xl mx-auto px-4">
                    {/* Breadcrumb */}
                    <nav className="mb-4 text-sm" aria-label="Breadcrumb">
                        <ol className="flex items-center space-x-2 text-blue-100">
                            <li>
                                <button onClick={() => navigate('/faq')} className="hover:text-white">
                                    Home
                                </button>
                            </li>
                            {article.category && (
                                <>
                                    <li><span className="mx-2">/</span></li>
                                    <li>
                                        <button 
                                            onClick={() => navigate(`/faq?category=${encodeURIComponent(article.category)}`)}
                                            className="hover:text-white"
                                        >
                                            {article.category}
                                        </button>
                                    </li>
                                </>
                            )}
                            <li><span className="mx-2">/</span></li>
                            <li className="text-white">Article</li>
                        </ol>
                    </nav>

                    <h1 className="text-3xl font-bold text-white mb-4">{article.title}</h1>
                    
                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-blue-100">
                        {article.category && (
                            <span className="px-3 py-1 bg-blue-800 rounded-full">{article.category}</span>
                        )}
                        {article.difficulty && (
                            <span className={`px-3 py-1 rounded-full ${difficultyBadge.bg} ${difficultyBadge.text}`}>
                                {difficultyBadge.label}
                            </span>
                        )}
                        <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            {article.views || 0} views
                        </span>
                        <span>
                            {helpfulPercentage}% found this helpful
                        </span>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-12">
                {/* Excerpt */}
                {article.excerpt && (
                    <div className="mb-8 p-4 bg-blue-900/20 border-l-4 border-blue-500 rounded">
                        <p className="text-gray-300 italic">{article.excerpt}</p>
                    </div>
                )}

                {/* Article Content */}
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 mb-8">
                    <div className="prose prose-invert prose-blue max-w-none">
                        <ReactMarkdown
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                                h1: ({children}) => <h1 className="text-3xl font-bold text-gray-100 mb-4 mt-6">{children}</h1>,
                                h2: ({children}) => <h2 className="text-2xl font-bold text-gray-200 mb-3 mt-5">{children}</h2>,
                                h3: ({children}) => <h3 className="text-xl font-semibold text-gray-200 mb-2 mt-4">{children}</h3>,
                                h4: ({children}) => <h4 className="text-lg font-semibold text-gray-300 mb-2 mt-3">{children}</h4>,
                                p: ({children}) => <p className="text-gray-300 mb-4 leading-relaxed">{children}</p>,
                                ul: ({children}) => <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">{children}</ul>,
                                ol: ({children}) => <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-1">{children}</ol>,
                                li: ({children}) => <li className="ml-4">{children}</li>,
                                code: ({inline, children}) => 
                                    inline ? (
                                        <code className="bg-gray-800 text-blue-300 px-1.5 py-0.5 rounded text-sm">{children}</code>
                                    ) : (
                                        <code className="block bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">{children}</code>
                                    ),
                                pre: ({children}) => <pre className="bg-gray-800 rounded-lg overflow-x-auto mb-4">{children}</pre>,
                                blockquote: ({children}) => (
                                    <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-400 my-4">{children}</blockquote>
                                ),
                                a: ({href, children}) => (
                                    <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
                                        {children}
                                    </a>
                                ),
                                table: ({children}) => (
                                    <div className="overflow-x-auto mb-4">
                                        <table className="min-w-full border border-gray-700">{children}</table>
                                    </div>
                                ),
                                thead: ({children}) => <thead className="bg-gray-800">{children}</thead>,
                                th: ({children}) => <th className="border border-gray-700 px-4 py-2 text-left text-gray-200">{children}</th>,
                                td: ({children}) => <td className="border border-gray-700 px-4 py-2 text-gray-300">{children}</td>,
                            }}
                        >
                            {article.content}
                        </ReactMarkdown>
                    </div>
                </div>

                {/* Tags */}
                {article.tags && article.tags.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-sm font-semibold text-gray-400 mb-2">Tags:</h3>
                        <div className="flex flex-wrap gap-2">
                            {article.tags.map((tag, idx) => (
                                <span key={idx} className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Was This Helpful Section */}
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 mb-8">
                    <h3 className="text-xl font-bold text-gray-200 mb-4 text-center">Was this article helpful?</h3>
                    
                    {!voted ? (
                        <div className="space-y-4">
                            <div className="flex justify-center gap-4">
                                <button
                                    onClick={() => {
                                        handleVote(true);
                                        setShowFeedback(true);
                                    }}
                                    disabled={submitting}
                                    className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                    </svg>
                                    Yes, this helped!
                                </button>
                                <button
                                    onClick={() => {
                                        setShowFeedback(true);
                                    }}
                                    disabled={submitting}
                                    className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                                    </svg>
                                    No, needs improvement
                                </button>
                            </div>

                            {showFeedback && (
                                <div className="mt-6">
                                    <label className="block text-gray-300 mb-2 text-sm">
                                        Tell us more (optional):
                                    </label>
                                    <textarea
                                        value={feedbackText}
                                        onChange={(e) => setFeedbackText(e.target.value)}
                                        placeholder="What could we improve?"
                                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows={3}
                                    />
                                    <button
                                        onClick={() => handleVote(false)}
                                        disabled={submitting}
                                        className="mt-3 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                                    >
                                        {submitting ? 'Submitting...' : 'Submit Feedback'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="inline-flex items-center gap-2 text-green-400 mb-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="font-semibold">Thank you for your feedback!</span>
                            </div>
                            <p className="text-gray-400 text-sm">Your input helps us improve our knowledge base.</p>
                        </div>
                    )}
                </div>

                {/* Related Articles */}
                {relatedArticles.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-2xl font-bold text-gray-200 mb-4">Related Articles</h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                            {relatedArticles.slice(0, 4).map(related => (
                                <button
                                    key={related.id}
                                    onClick={() => navigate(`/faq/article/${related.id}`)}
                                    className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors text-left"
                                >
                                    <h4 className="text-blue-400 hover:text-blue-300 font-semibold mb-2">
                                        {related.title}
                                    </h4>
                                    {related.excerpt && (
                                        <p className="text-gray-400 text-sm line-clamp-2">{related.excerpt}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Still Need Help CTA */}
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-8 text-center">
                    <h3 className="text-2xl font-bold text-gray-200 mb-3">Still need help?</h3>
                    <p className="text-gray-300 mb-6">
                        If this article didn't solve your issue, our support team is here to help.
                    </p>
                    <button
                        onClick={() => navigate('/submit-ticket')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
                    >
                        Create a Support Ticket
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ArticlePublicView;
