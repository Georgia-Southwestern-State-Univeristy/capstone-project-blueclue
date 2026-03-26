import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ArticleList from '../components/knowledgeBase/ArticleList';
import ArticleEditor from '../components/knowledgeBase/ArticleEditor';
import ArticleViewer from '../components/knowledgeBase/ArticleViewer';
import CategoryManager from '../components/knowledgeBase/CategoryManager';
import KBAnalytics from '../components/knowledgeBase/KBAnalytics';
import SearchWithHistory from '../components/SearchWithHistory';

const getAuthHeaders = () => {
    const token = localStorage.getItem('blueclue_token');
    return {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
        }
    };
};

const KnowledgeBaseManagement = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('articles');
    const [articles, setArticles] = useState([]);
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState([]);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewingArticle, setViewingArticle] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterPublished, setFilterPublished] = useState('');
    const [accessDenied, setAccessDenied] = useState(false);
    const isFetchingRef = useRef(false);

    // Check user role on mount
    useEffect(() => {
        const userData = localStorage.getItem('blueclue_user');
        if (!userData) {
            navigate('/login');
            return;
        }

        try {
            const user = JSON.parse(userData);
            if (!['admin', 'technician', 'senior_technician', 'management'].includes(user.role)) {
                setAccessDenied(true);
            }
        } catch (error) {
            console.error('Error parsing user data:', error);
            navigate('/login');
        }
    }, [navigate]);

    // Fetch articles
    const fetchArticles = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const params = {};
            if (filterCategory) params.category = filterCategory;
            if (filterPublished !== '') params.published = filterPublished;
            if (searchTerm) params.search = searchTerm;

            const token = localStorage.getItem('blueclue_token');
            console.log('[KB] token present:', !!token);
            console.log('[KB] fetching articles with params:', params);

            const response = await axios.get('/api/knowledge-base/articles', { params, ...getAuthHeaders() });
            console.log('[KB] response status:', response.status);
            console.log('[KB] response data:', response.data);
            const fetched = response.data.articles || [];
            console.log('[KB] articles count:', fetched.length);
            setArticles(fetched);
        } catch (error) {
            console.error('[KB] Error fetching articles:', error);
            console.error('[KB] response:', error.response?.status, error.response?.data);
            const status = error.response?.status;
            const msg = error.response?.data?.message || error.response?.data?.error || error.message;
            setFetchError(`Failed to load articles (${status || 'network error'}): ${msg}`);
        } finally {
            setLoading(false);
        }
    }, [filterCategory, filterPublished, searchTerm]);

    // Fetch categories
    const fetchCategories = async () => {
        try {
            const response = await axios.get('/api/knowledge-base/categories', getAuthHeaders());
            setCategories(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    // Fetch tags
    const fetchTags = async () => {
        try {
            const response = await axios.get('/api/knowledge-base/tags', getAuthHeaders());
            setTags(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching tags:', error);
        }
    };

    useEffect(() => {
        fetchArticles();
        fetchCategories();
        fetchTags();
    }, [fetchArticles]);

    // Handle create new article
    const handleCreateArticle = () => {
        setSelectedArticle(null);
        setIsEditorOpen(true);
    };

    // Handle view article
    const handleViewArticle = (article) => {
        setViewingArticle(article);
        setIsViewerOpen(true);
    };

    // Handle edit article
    const handleEditArticle = (article) => {
        setSelectedArticle(article);
        setIsEditorOpen(true);
    };

    // Handle close editor
    const handleCloseEditor = () => {
        setIsEditorOpen(false);
        setSelectedArticle(null);
        fetchArticles(); // Refresh list
    };

    // Handle close viewer
    const handleCloseViewer = () => {
        setIsViewerOpen(false);
        setViewingArticle(null);
    };

    // Handle delete article
    const handleDeleteArticle = async (articleId) => {
        if (!confirm('Are you sure you want to delete this article?')) return;

        try {
            await axios.delete(`/api/knowledge-base/articles/${articleId}`, getAuthHeaders());
            fetchArticles();
            alert('Article deleted successfully');
        } catch (error) {
            console.error('Error deleting article:', error);
            alert('Failed to delete article');
        }
    };

    // Handle toggle publish
    const handleTogglePublish = async (articleId, isPublished) => {
        try {
            await axios.patch(`/api/knowledge-base/articles/${articleId}/publish`, {
                is_published: !isPublished
            }, getAuthHeaders());
            fetchArticles();
        } catch (error) {
            console.error('Error toggling publish status:', error);
            alert('Failed to update publish status');
        }
    };

    return (
        <div className="p-4 md:p-8 bg-gray-950 min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Access Denied Message */}
                {accessDenied ? (
                    <div className="bg-gray-800 rounded-xl border border-red-700 p-12 text-center">
                        <div className="text-red-500 text-6xl mb-4"></div>
                        <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                        <p className="text-gray-400 mb-6">
                            You need admin or technician privileges to access Knowledge Base Management.
                        </p>
                        <button
                            onClick={() => navigate(-1)}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Go Back
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-white">Knowledge Base Management</h1>
                            <p className="text-sm text-gray-400 mt-1">
                                Create, edit, and manage support articles for customers and chatbot
                            </p>
                        </div>

                {/* Tabs */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 mb-6">
                    <div className="border-b border-gray-700">
                        <nav className="-mb-px flex space-x-8 px-6">
                            <button
                                onClick={() => setActiveTab('articles')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === 'articles'
                                        ? 'border-blue-500 text-blue-400'
                                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                                }`}
                            >
                                Articles
                            </button>
                            <button
                                onClick={() => setActiveTab('categories')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === 'categories'
                                        ? 'border-blue-500 text-blue-400'
                                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                                }`}
                            >
                                Categories
                            </button>
                            <button
                                onClick={() => setActiveTab('analytics')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === 'analytics'
                                        ? 'border-blue-500 text-blue-400'
                                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                                }`}
                            >
                                Analytics
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Content */}
                {activeTab === 'articles' && (
                    <div>
                        {/* Filters and Create Button */}
                        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
                            <div className="flex flex-wrap gap-4 items-center">
                                <SearchWithHistory
                                    searchType="knowledge_base"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search articles..."
                                    className="flex-1 min-w-[200px] px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    showClearButton={false}
                                />
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">All Categories</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.name}>
                                            {cat.display_name}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={filterPublished}
                                    onChange={(e) => setFilterPublished(e.target.value)}
                                    className="px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">All Status</option>
                                    <option value="true">Published</option>
                                    <option value="false">Draft</option>
                                </select>
                                <button
                                    onClick={handleCreateArticle}
                                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    + Create Article
                                </button>
                            </div>
                        </div>

                        {/* Article List */}
                        {fetchError ? (
                            <div className="bg-gray-800 rounded-xl border border-red-700 p-8 text-center">
                                <p className="text-red-400 font-medium mb-2">Error loading articles</p>
                                <p className="text-gray-400 text-sm">{fetchError}</p>
                                <button onClick={fetchArticles} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                                    Retry
                                </button>
                            </div>
                        ) : loading ? (
                            <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-700 border-t-blue-500"></div>
                                <p className="mt-4 text-gray-400">Loading articles...</p>
                            </div>
                        ) : (
                            <ArticleList
                                articles={articles}
                                onView={handleViewArticle}
                                onEdit={handleEditArticle}
                                onDelete={handleDeleteArticle}
                                onTogglePublish={handleTogglePublish}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'categories' && (
                    <CategoryManager
                        categories={categories}
                        onCategoriesChange={fetchCategories}
                    />
                )}

                {activeTab === 'analytics' && (
                    <KBAnalytics />
                )}

                {/* Article Editor Modal */}
                {isEditorOpen && (
                    <ArticleEditor
                        article={selectedArticle}
                        categories={categories}
                        tags={tags}
                        onClose={handleCloseEditor}
                        onSave={handleCloseEditor}
                    />
                )}

                {/* Article Viewer Modal */}
                {isViewerOpen && (
                    <ArticleViewer
                        article={viewingArticle}
                        onClose={handleCloseViewer}
                    />
                )}
                    </>
                )}
            </div>
        </div>
    );
};

export default KnowledgeBaseManagement;
