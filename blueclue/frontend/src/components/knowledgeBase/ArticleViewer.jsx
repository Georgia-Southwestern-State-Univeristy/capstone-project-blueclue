import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { formatDateTime as _fmtDateTime } from '../../utils/dateFormatter';

const ArticleViewer = ({ article, onClose }) => {
    if (!article) return null;

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

    const formatDate = (dateString) => {
        return _fmtDateTime(dateString, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm z-50 p-4">
            <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-5xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800 flex-shrink-0">
                    <div className="flex-1 mr-4">
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl font-bold text-gray-200">
                                {article.title}
                            </h2>
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                article.is_published
                                    ? 'bg-green-900/50 text-green-300'
                                    : 'bg-yellow-900/50 text-yellow-300'
                            }`}>
                                {article.is_published ? 'Published' : 'Draft'}
                            </span>
                            {article.is_public && (
                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-900/50 text-blue-300">
                                    Public
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>By {article.author_name}</span>
                            <span>•</span>
                            <span>{formatDate(article.created_at)}</span>
                            {article.updated_at !== article.created_at && (
                                <>
                                    <span>•</span>
                                    <span>Updated {formatDate(article.updated_at)}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
                        aria-label="Close"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Metadata */}
                <div className="px-6 py-4 border-b border-gray-800 flex-shrink-0">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Category */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">Category:</span>
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-700 text-gray-300">
                                {article.category}
                            </span>
                        </div>

                        {/* Difficulty */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">Difficulty:</span>
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getDifficultyColor(article.difficulty)}`}>
                                {article.difficulty}
                            </span>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 ml-auto text-sm text-gray-400">
                            <span>{article.views} views</span>
                            <span>•</span>
                            <span>{article.helpfulness_percentage || 0}% helpful</span>
                            <span>•</span>
                            <span>{article.helpful_votes}↑ {article.not_helpful_votes}↓</span>
                        </div>
                    </div>

                    {/* Tags */}
                    {article.tags && Array.isArray(article.tags) && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            <span className="text-sm text-gray-400">Tags:</span>
                            {article.tags.map((tag, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/50 text-blue-300"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Excerpt */}
                    {article.excerpt && (
                        <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-gray-300 italic">{article.excerpt}</p>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="prose prose-invert prose-blue max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                                h1: ({...props}) => <h1 className="text-3xl font-bold text-gray-100 mt-8 mb-4" {...props} />,
                                h2: ({...props}) => <h2 className="text-2xl font-bold text-gray-200 mt-6 mb-3" {...props} />,
                                h3: ({...props}) => <h3 className="text-xl font-bold text-gray-200 mt-4 mb-2" {...props} />,
                                h4: ({...props}) => <h4 className="text-lg font-bold text-gray-300 mt-3 mb-2" {...props} />,
                                p: ({...props}) => <p className="text-gray-300 mb-4 leading-relaxed" {...props} />,
                                ul: ({...props}) => <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2" {...props} />,
                                ol: ({...props}) => <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-2" {...props} />,
                                li: ({...props}) => <li className="text-gray-300" {...props} />,
                                a: ({...props}) => <a className="text-blue-400 hover:text-blue-300 underline" {...props} />,
                                code: ({inline, ...props}) => 
                                    inline 
                                        ? <code className="bg-gray-800 text-blue-300 px-1.5 py-0.5 rounded text-sm" {...props} />
                                        : <code className="block bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm" {...props} />,
                                pre: ({...props}) => <pre className="bg-gray-800 p-4 rounded-lg overflow-x-auto mb-4" {...props} />,
                                blockquote: ({...props}) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-400 my-4" {...props} />,
                                table: ({...props}) => <table className="min-w-full divide-y divide-gray-700 my-4" {...props} />,
                                thead: ({...props}) => <thead className="bg-gray-800" {...props} />,
                                tbody: ({...props}) => <tbody className="divide-y divide-gray-800" {...props} />,
                                tr: ({...props}) => <tr {...props} />,
                                th: ({...props}) => <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" {...props} />,
                                td: ({...props}) => <td className="px-4 py-2 text-gray-300" {...props} />,
                            }}
                        >
                            {article.content}
                        </ReactMarkdown>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-800 bg-gray-800/30 flex-shrink-0">
                    <div className="flex items-center justify-between text-sm text-gray-400">
                        <div>
                            Article ID: {article.id} | Version: {article.version_count || 1}
                        </div>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArticleViewer;
