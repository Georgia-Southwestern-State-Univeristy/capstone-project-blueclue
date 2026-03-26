import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import SearchWithHistory from '../components/SearchWithHistory';

const FAQSearch = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState(query);

    useEffect(() => {
        if (query) {
            performSearch(query);
        } else {
            setLoading(false);
        }
    }, [query]);

    const performSearch = async (searchQuery) => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/knowledge-base/search?q=${encodeURIComponent(searchQuery)}`);
            setResults(response.data.results || []);
        } catch (error) {
            console.error('Error searching articles:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchInput.trim()) {
            navigate(`/faq/search?q=${encodeURIComponent(searchInput)}`);
        }
    };

    const handleSearchSubmit = () => {
        if (searchInput.trim()) {
            navigate(`/faq/search?q=${encodeURIComponent(searchInput)}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-700 py-12">
                <div className="max-w-4xl mx-auto px-4">
                    <h1 className="text-3xl font-bold text-white mb-6">Search Results</h1>
                    
                    {/* Search Bar */}
                    <form onSubmit={handleSearch}>
                        <SearchWithHistory
                            searchType="knowledge_base"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onSubmit={handleSearchSubmit}
                            placeholder="Search for help articles..."
                            className="w-full px-6 py-4 pr-12 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            showClearButton={false}
                        />
                    </form>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-12">
                {/* Breadcrumb */}
                <nav className="mb-8 text-sm" aria-label="Breadcrumb">
                    <ol className="flex items-center space-x-2 text-gray-400">
                        <li>
                            <button onClick={() => navigate('/faq')} className="hover:text-blue-400">
                                Home
                            </button>
                        </li>
                        <li><span className="mx-2">/</span></li>
                        <li className="text-gray-200">Search</li>
                    </ol>
                </nav>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-700 border-t-blue-500 mb-4"></div>
                        <p className="text-gray-400">Searching...</p>
                    </div>
                ) : (
                    <>
                        <div className="mb-6">
                            <h2 className="text-xl text-gray-300">
                                {results.length > 0 ? (
                                    <>Found <span className="font-bold text-blue-400">{results.length}</span> results for "{query}"</>
                                ) : (
                                    <>No results found for "{query}"</>
                                )}
                            </h2>
                        </div>

                        {results.length > 0 ? (
                            <div className="space-y-4">
                                {results.map(article => (
                                    <div
                                        key={article.id}
                                        className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-colors"
                                    >
                                        <button
                                            onClick={() => navigate(`/faq/article/${article.id}`)}
                                            className="text-xl font-semibold text-blue-400 hover:text-blue-300 mb-2 text-left w-full"
                                        >
                                            {article.title}
                                        </button>
                                        
                                        {article.excerpt && (
                                            <p className="text-gray-400 mb-3">{article.excerpt}</p>
                                        )}
                                        
                                        <div className="flex flex-wrap items-center gap-3 text-sm">
                                            {article.category && (
                                                <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded">
                                                    {article.category}
                                                </span>
                                            )}
                                            {article.difficulty && (
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    article.difficulty === 'beginner' ? 'bg-green-900 text-green-300' :
                                                    article.difficulty === 'intermediate' ? 'bg-yellow-900 text-yellow-300' :
                                                    'bg-red-900 text-red-300'
                                                }`}>
                                                    {article.difficulty}
                                                </span>
                                            )}
                                            <span className="text-gray-500 flex items-center">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                {article.views || 0} views
                                            </span>
                                            {article.helpfulness_percentage > 0 && (
                                                <span className="text-gray-500">
                                                    {article.helpfulness_percentage}% helpful
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-gray-900 border border-gray-700 rounded-lg p-12 text-center">
                                <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h3 className="text-xl font-bold text-gray-300 mb-2">No results found</h3>
                                <p className="text-gray-500 mb-6">Try adjusting your search terms or browse by category</p>
                                <button
                                    onClick={() => navigate('/faq')}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                                >
                                    Browse Categories
                                </button>
                            </div>
                        )}

                        {/* Help CTA */}
                        <div className="mt-12 bg-blue-900/30 border border-blue-700 rounded-lg p-8 text-center">
                            <h3 className="text-2xl font-bold text-gray-200 mb-3">Can't find what you're looking for?</h3>
                            <p className="text-gray-300 mb-6">Create a support ticket and our team will help you directly.</p>
                            <button
                                onClick={() => navigate('/submit-ticket')}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
                            >
                                Create a Ticket
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default FAQSearch;
