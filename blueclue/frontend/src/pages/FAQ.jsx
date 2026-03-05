import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const FAQ = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const selectedCategory = searchParams.get('category');
    
    const [categories, setCategories] = useState([]);
    const [articles, setArticles] = useState([]);
    const [featuredArticles, setFeaturedArticles] = useState({ mostHelpful: [], mostViewed: [] });
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([
                fetchCategories(),
                fetchFeaturedArticles()
            ]);
            setLoading(false);
        };
        
        loadData();
        
        if (selectedCategory) {
            fetchArticlesByCategory(selectedCategory);
        }
    }, [selectedCategory]);

    const fetchCategories = async () => {
        try {
            console.log('[FAQ] Fetching categories...');
            const response = await axios.get('/api/knowledge-base/search?limit=1000');
            console.log('[FAQ] Search response:', response.data);
            const allArticles = response.data.results || [];
            console.log('[FAQ] Number of articles:', allArticles.length);
            
            // Group by category and count articles
            const categoryMap = {};
            allArticles.forEach(article => {
                const cat = article.category || 'Other';
                if (!categoryMap[cat]) {
                    categoryMap[cat] = { name: cat, count: 0, articles: [] };
                }
                categoryMap[cat].count++;
                categoryMap[cat].articles.push(article);
            });
            
            console.log('[FAQ] Category map:', categoryMap);
            const categoriesArray = Object.values(categoryMap);
            console.log('[FAQ] Categories array:', categoriesArray);
            setCategories(categoriesArray);
        } catch (error) {
            console.error('[FAQ] Error fetching categories:', error);
            console.error('[FAQ] Error response:', error.response);
        }
    };

    const fetchFeaturedArticles = async () => {
        try {
            // Most helpful (sort by helpful_votes)
            const helpfulRes = await axios.get('/api/knowledge-base/search?sort=helpful_votes&limit=5');
            
            // Most viewed (sort by views)
            const viewedRes = await axios.get('/api/knowledge-base/search?sort=views&limit=5');
            
            setFeaturedArticles({
                mostHelpful: helpfulRes.data.results || [],
                mostViewed: viewedRes.data.results || []
            });
        } catch (error) {
            console.error('Error fetching featured articles:', error);
        }
    };

    const fetchArticlesByCategory = async (category) => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/knowledge-base/search?category=${encodeURIComponent(category)}&limit=100`);
            setArticles(response.data.results || []);
        } catch (error) {
            console.error('Error fetching articles:', error);
            setArticles([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        
        navigate(`/faq/search?q=${encodeURIComponent(searchQuery)}`);
    };

    const handleCategoryClick = (categoryName) => {
        navigate(`/faq?category=${encodeURIComponent(categoryName)}`);
    };

    const getCategoryIcon = (categoryName) => {
        const icons = {
            'Hardware': '',
            'Software': '',
            'Network': '',
            'Account': '',
            'Email': '',
            'Security': '',
            'Printer': '',
            'Mobile': '',
            'Access': '',
            'Other': ''
        };
        return icons[categoryName] || '';
    };

    if (loading && !selectedCategory) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-700 border-t-blue-500 mb-4"></div>
                    <p className="text-gray-400">Loading FAQ...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-700 py-16">
                <div className="max-w-6xl mx-auto px-4">
                    <h1 className="text-4xl font-bold text-white mb-4">Knowledge Base</h1>
                    <p className="text-blue-100 text-lg mb-8">Find answers to common questions and troubleshooting guides</p>
                    
                    {/* Search Bar */}
                    <form onSubmit={handleSearch} className="max-w-2xl">
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for help articles..."
                                className="w-full px-6 py-4 pr-12 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Search knowledge base"
                            />
                            <button
                                type="submit"
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-blue-600"
                                aria-label="Submit search"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-12">
                {/* Breadcrumb Navigation */}
                {selectedCategory && (
                    <nav className="mb-8 text-sm" aria-label="Breadcrumb">
                        <ol className="flex items-center space-x-2 text-gray-400">
                            <li>
                                <button onClick={() => navigate('/faq')} className="hover:text-blue-400">
                                    Home
                                </button>
                            </li>
                            <li><span className="mx-2">/</span></li>
                            <li className="text-gray-200">{selectedCategory}</li>
                        </ol>
                    </nav>
                )}

                {!selectedCategory ? (
                    <>
                        {/* Featured Articles */}
                        <section className="mb-12">
                            <h2 className="text-2xl font-bold text-gray-200 mb-6">Featured Articles</h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Most Helpful */}
                                <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                                    <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center">
                                        <span className="mr-2"></span>
                                        Most Helpful Articles
                                    </h3>
                                    <ul className="space-y-3">
                                        {featuredArticles.mostHelpful.slice(0, 5).map(article => (
                                            <li key={article.id}>
                                                <button
                                                    onClick={() => navigate(`/faq/article/${article.id}`)}
                                                    className="text-blue-400 hover:text-blue-300 text-left w-full"
                                                >
                                                    {article.title}
                                                </button>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {article.helpful_votes || 0} helpful votes
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Most Viewed */}
                                <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                                    <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center">
                                        <span className="mr-2"></span>
                                        Most Viewed This Week
                                    </h3>
                                    <ul className="space-y-3">
                                        {featuredArticles.mostViewed.slice(0, 5).map(article => (
                                            <li key={article.id}>
                                                <button
                                                    onClick={() => navigate(`/faq/article/${article.id}`)}
                                                    className="text-blue-400 hover:text-blue-300 text-left w-full"
                                                >
                                                    {article.title}
                                                </button>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {article.views || 0} views
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* Category Cards */}
                        <section>
                            <h2 className="text-2xl font-bold text-gray-200 mb-6">Browse by Category</h2>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {categories.map(category => (
                                    <button
                                        key={category.name}
                                        onClick={() => handleCategoryClick(category.name)}
                                        className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:border-blue-500 hover:bg-gray-800 transition-all text-left group"
                                    >
                                        <div className="text-4xl mb-3">{getCategoryIcon(category.name)}</div>
                                        <h3 className="text-xl font-semibold text-gray-200 mb-2 group-hover:text-blue-400">
                                            {category.name}
                                        </h3>
                                        <p className="text-gray-400 text-sm">
                                            {category.count} {category.count === 1 ? 'article' : 'articles'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </section>
                    </>
                ) : (
                    /* Category Articles List */
                    <section>
                        <h2 className="text-3xl font-bold text-gray-200 mb-6">
                            {getCategoryIcon(selectedCategory)} {selectedCategory}
                        </h2>
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-700 border-t-blue-500"></div>
                            </div>
                        ) : articles.length === 0 ? (
                            <div className="bg-gray-900 border border-gray-700 rounded-lg p-12 text-center">
                                <p className="text-gray-400">No articles found in this category</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {articles.map(article => (
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
                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                            <span className="flex items-center">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                {article.views || 0} views
                                            </span>
                                            {article.difficulty && (
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    article.difficulty === 'beginner' ? 'bg-green-900 text-green-300' :
                                                    article.difficulty === 'intermediate' ? 'bg-yellow-900 text-yellow-300' :
                                                    'bg-red-900 text-red-300'
                                                }`}>
                                                    {article.difficulty}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Help CTA */}
                <div className="mt-12 bg-blue-900/30 border border-blue-700 rounded-lg p-8 text-center">
                    <h3 className="text-2xl font-bold text-gray-200 mb-3">Still need help?</h3>
                    <p className="text-gray-300 mb-6">Can't find what you're looking for? Create a support ticket and our team will assist you.</p>
                    <button
                        onClick={() => navigate('/submit-ticket')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
                    >
                        Create a Ticket
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FAQ;
