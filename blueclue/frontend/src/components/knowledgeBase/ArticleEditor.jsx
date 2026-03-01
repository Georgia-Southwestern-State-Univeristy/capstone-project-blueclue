import { useState, useEffect } from 'react';
import axios from 'axios';
import MDEditor from '@uiw/react-md-editor';
import VersionHistory from './VersionHistory';

const getAuthHeaders = () => {
    const token = localStorage.getItem('blueclue_token');
    return {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
        }
    };
};

const ArticleEditor = ({ article, categories, tags, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        category: '',
        tags: [],
        difficulty: 'beginner',
        is_public: true,
        is_published: false,
        excerpt: '',
        meta_description: ''
    });
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [showVersionHistory, setShowVersionHistory] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [tagSuggestions, setTagSuggestions] = useState([]);

    useEffect(() => {
        if (article) {
            setFormData({
                title: article.title || '',
                content: article.content || '',
                category: article.category || '',
                tags: article.tags || [],
                difficulty: article.difficulty || 'beginner',
                is_public: article.is_public ?? true,
                is_published: article.is_published ?? false,
                excerpt: article.excerpt || '',
                meta_description: article.meta_description || ''
            });
        }
    }, [article]);

    useEffect(() => {
        // Filter tag suggestions based on input
        if (tagInput) {
            const suggestions = tags
                .filter(t => 
                    t.tag.toLowerCase().includes(tagInput.toLowerCase()) &&
                    !formData.tags.includes(t.tag)
                )
                .slice(0, 5);
            setTagSuggestions(suggestions);
        } else {
            setTagSuggestions([]);
        }
    }, [tagInput, tags, formData.tags]);

    const handleSubmit = async (e, publish = false) => {
        e.preventDefault();
        
        if (!formData.title || !formData.content || !formData.category) {
            alert('Please fill in title, content, and category');
            return;
        }

        setSaving(true);
        try {
            const dataToSend = {
                ...formData,
                is_published: publish || formData.is_published
            };

            if (article) {
                await axios.put(`/api/knowledge-base/articles/${article.id}`, dataToSend, getAuthHeaders());
                alert('Article updated successfully');
            } else {
                await axios.post('/api/knowledge-base/articles', dataToSend, getAuthHeaders());
                alert('Article created successfully');
            }
            
            onSave();
        } catch (error) {
            console.error('Error saving article:', error);
            alert('Failed to save article: ' + (error.response?.data?.error || error.message));
        } finally {
            setSaving(false);
        }
    };

    const handleAddTag = (tag) => {
        if (tag && !formData.tags.includes(tag)) {
            setFormData(prev => ({
                ...prev,
                tags: [...prev.tags, tag]
            }));
        }
        setTagInput('');
        setTagSuggestions([]);
    };

    const handleRemoveTag = (tagToRemove) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.filter(t => t !== tagToRemove)
        }));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && tagInput) {
            e.preventDefault();
            handleAddTag(tagInput);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center backdrop-blur-sm z-50 p-4 pt-8 overflow-y-auto">
            <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-6xl my-8 mb-16">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-200">
                            {article ? 'Edit Article' : 'Create New Article'}
                        </h2>
                        {article && (
                            <p className="text-sm text-gray-400 mt-1">
                                Created by {article.author_name} • {article.version_count || 0} versions
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {article && (
                            <button
                                type="button"
                                onClick={() => setShowVersionHistory(true)}
                                className="px-4 py-2 text-sm font-medium text-blue-400 hover:text-blue-700 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                                View Versions
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowPreview(!showPreview)}
                            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg hover:bg-gray-800/50 transition-colors"
                        >
                            {showPreview ? 'Edit Mode' : 'Preview'}
                        </button>
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
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Content - 2 columns */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Title *
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter article title"
                                    required
                                />
                            </div>

                            {/* Excerpt */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Excerpt (Summary for previews)
                                </label>
                                <textarea
                                    value={formData.excerpt}
                                    onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                                    rows={2}
                                    className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Brief summary of the article (recommended 150-300 characters)"
                                    maxLength={300}
                                />
                                <p className="text-xs text-gray-400 mt-1">{formData.excerpt.length}/300 characters</p>
                            </div>

                            {/* Content Editor */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Content * (Markdown supported)
                                </label>
                                <div className="border border-gray-700 rounded-lg overflow-hidden" data-color-mode="dark">
                                    <MDEditor
                                        value={formData.content}
                                        onChange={(value) => setFormData(prev => ({ ...prev, content: value || '' }))}
                                        preview={showPreview ? 'preview' : 'edit'}
                                        height={500}
                                        enableScroll={true}
                                        highlightEnable={true}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                    Supports markdown formatting including **bold**, *italic*, code blocks, lists, and more
                                </p>
                            </div>
                        </div>

                        {/* Sidebar - 1 column */}
                        <div className="space-y-6">
                            {/* Category */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Category *
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                    className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                >
                                    <option value="">Select category</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.name}>
                                            {cat.display_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Difficulty */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Difficulty Level
                                </label>
                                <select
                                    value={formData.difficulty}
                                    onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
                                    className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="beginner">Beginner</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="advanced">Advanced</option>
                                </select>
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Tags
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Add tags (press Enter)"
                                    />
                                    {tagSuggestions.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-lg">
                                            {tagSuggestions.map((suggestion, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => handleAddTag(suggestion.tag)}
                                                    className="w-full px-4 py-2 text-left hover:bg-gray-700 flex justify-between items-center"
                                                >
                                                    <span>{suggestion.tag}</span>
                                                    <span className="text-xs text-gray-400">
                                                        {suggestion.usage_count} articles
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {formData.tags.map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900/50 text-blue-300"
                                        >
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveTag(tag)}
                                                className="ml-2 text-blue-400 hover:text-blue-300"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* SEO Meta Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Meta Description (SEO)
                                </label>
                                <textarea
                                    value={formData.meta_description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                                    rows={2}
                                    className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Meta description for search engines"
                                    maxLength={160}
                                />
                                <p className="text-xs text-gray-400 mt-1">{formData.meta_description.length}/160 characters</p>
                            </div>

                            {/* Visibility Settings */}
                            <div className="space-y-3 p-4 bg-gray-800/50 rounded-lg">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="is_public"
                                        checked={formData.is_public}
                                        onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
                                        className="h-4 w-4 text-blue-400 focus:ring-blue-500 border-gray-700 rounded"
                                    />
                                    <label htmlFor="is_public" className="ml-2 block text-sm text-gray-400">
                                        Public (visible to customers)
                                    </label>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="is_published"
                                        checked={formData.is_published}
                                        onChange={(e) => setFormData(prev => ({ ...prev, is_published: e.target.checked }))}
                                        className="h-4 w-4 text-blue-400 focus:ring-blue-500 border-gray-700 rounded"
                                    />
                                    <label htmlFor="is_published" className="ml-2 block text-sm text-gray-400">
                                        Published
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-6 flex justify-end gap-3 pt-6 border-t border-gray-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 text-gray-400 text-sm font-medium rounded-lg hover:bg-gray-800/50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? 'Saving...' : 'Save as Draft'}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => handleSubmit(e, true)}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? 'Publishing...' : article?.is_published ? 'Update Published' : 'Publish'}
                        </button>
                    </div>
                </form>

                {/* Version History Modal */}
                {showVersionHistory && article && (
                    <VersionHistory
                        articleId={article.id}
                        onClose={() => setShowVersionHistory(false)}
                        onRestore={() => {
                            setShowVersionHistory(false);
                            onSave();
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default ArticleEditor;
