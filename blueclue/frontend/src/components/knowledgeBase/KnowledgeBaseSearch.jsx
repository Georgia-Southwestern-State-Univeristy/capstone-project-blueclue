import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Filter, X, ChevronDown, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const KnowledgeBaseSearch = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [totalResults, setTotalResults] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);

    // Filters
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedDifficulty, setSelectedDifficulty] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const [sortBy, setSortBy] = useState('relevance');
    const [showFilters, setShowFilters] = useState(false);

    // Available options
    const categories = [
        'Account Management',
        'Network & Connectivity',
        'Software & Applications',
        'Hardware & Devices',
        'Security & Compliance',
        'Support & Services',
        'Troubleshooting'
    ];

    const difficulties = ['beginner', 'intermediate', 'advanced'];
    const sortOptions = [
        { value: 'relevance', label: 'Most Relevant' },
        { value: 'date', label: 'Most Recent' },
        { value: 'popularity', label: 'Most Popular' },
        { value: 'helpful', label: 'Most Helpful' }
    ];

    const searchInputRef = useRef(null);
    const suggestionsRef = useRef(null);
    const debounceTimer = useRef(null);

    // Fetch search results
    const performSearch = useCallback(async (loadMore = false) => {
        if (!searchQuery.trim() && !selectedCategory && !selectedDifficulty && selectedTags.length === 0) {
            setResults([]);
            setTotalResults(0);
            return;
        }

        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery.trim()) params.append('q', searchQuery.trim());
            if (selectedCategory) params.append('category', selectedCategory);
            if (selectedDifficulty) params.append('difficulty', selectedDifficulty);
            selectedTags.forEach(tag => params.append('tags', tag));
            params.append('sort', sortBy);
            params.append('limit', '20');
            params.append('offset', loadMore ? offset : '0');

            const response = await axios.get(`${API_BASE_URL}/api/knowledge-base/search?${params}`);

            const newResults = Array.isArray(response.data.results) ? response.data.results : [];
            if (loadMore) {
                setResults(prev => [...prev, ...newResults]);
            } else {
                setResults(newResults);
                setOffset(0);
            }

            setTotalResults(response.data.total);
            setHasMore(response.data.hasMore);
            setOffset(loadMore ? offset + 20 : 20);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedCategory, selectedDifficulty, selectedTags, sortBy, offset]);

    // Fetch autocomplete suggestions
    const fetchSuggestions = async (query) => {
        if (!query || query.length < 2) {
            setSuggestions([]);
            return;
        }

        try {
            const response = await axios.get(
                `${API_BASE_URL}/api/knowledge-base/search/autocomplete?q=${encodeURIComponent(query)}`
            );
            setSuggestions(Array.isArray(response.data.suggestions) ? response.data.suggestions : []);
            setShowSuggestions(true);
        } catch (error) {
            console.error('Autocomplete error:', error);
        }
    };

    // Debounced search
    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
            fetchSuggestions(searchQuery);
        }, 300);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [searchQuery]);

    // Perform search when filters change
    useEffect(() => {
        performSearch();
    }, [selectedCategory, selectedDifficulty, selectedTags, sortBy, performSearch]);

    // Handle search submission
    const handleSearch = (e) => {
        e.preventDefault();
        setShowSuggestions(false);
        performSearch();
    };

    // Handle suggestion click
    const handleSuggestionClick = (suggestion) => {
        setSearchQuery(suggestion.title);
        setShowSuggestions(false);
        performSearch();
    };

    // Handle click outside suggestions
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) &&
                !searchInputRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Clear all filters
    const clearFilters = () => {
        setSelectedCategory('');
        setSelectedDifficulty('');
        setSelectedTags([]);
        setSortBy('relevance');
    };

    // Highlight search terms in text
    const highlightText = (text, query) => {
        if (!query || !text) return text;
        
        const terms = query.toLowerCase().split(' ').filter(t => t.length > 2);
        let highlightedText = text;
        
        terms.forEach(term => {
            const regex = new RegExp(`(${term})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-300 text-gray-900">$1</mark>');
        });
        
        return highlightedText;
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200">
            {/* Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-6">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-2xl font-bold text-white mb-4">Knowledge Base Search</h1>
                    
                    {/* Search Bar */}
                    <form onSubmit={handleSearch} className="relative">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search articles..."
                                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg pl-12 pr-4 py-3 text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSuggestions([]);
                                        setResults([]);
                                    }}
                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {/* Autocomplete Suggestions */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div 
                                ref={suggestionsRef}
                                className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto"
                            >
                                {suggestions.map((suggestion) => (
                                    <button
                                        key={suggestion.id}
                                        type="button"
                                        onClick={() => handleSuggestionClick(suggestion)}
                                        className="w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700 last:border-b-0 transition-colors"
                                    >
                                        <div className="font-medium text-gray-200">{suggestion.title}</div>
                                        <div className="text-sm text-gray-400">{suggestion.category}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </form>

                    {/* Filters Toggle */}
                    <div className="mt-4 flex items-center justify-between">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-2 text-gray-400 hover:text-gray-300 transition-colors"
                        >
                            <Filter className="w-4 h-4" />
                            <span>Filters</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Active Filters Count */}
                        {(selectedCategory || selectedDifficulty || selectedTags.length > 0) && (
                            <button
                                onClick={clearFilters}
                                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>

                    {/* Filters Panel */}
                    {showFilters && (
                        <div className="mt-4 p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Category Filter */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="">All Categories</option>
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Difficulty Filter */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Difficulty</label>
                                    <select
                                        value={selectedDifficulty}
                                        onChange={(e) => setSelectedDifficulty(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="">All Levels</option>
                                        {difficulties.map(diff => (
                                            <option key={diff} value={diff}>
                                                {diff.charAt(0).toUpperCase() + diff.slice(1)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Sort By */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Sort By</label>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        {sortOptions.map(option => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Results */}
            <div className="max-w-6xl mx-auto p-6">
                {/* Results Header */}
                {(searchQuery || selectedCategory || selectedDifficulty || selectedTags.length > 0) && (
                    <div className="mb-4 text-gray-400">
                        {loading && offset === 0 ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Searching...</span>
                            </div>
                        ) : (
                            <span>Found {totalResults} {totalResults === 1 ? 'article' : 'articles'}</span>
                        )}
                    </div>
                )}

                {/* Results List */}
                <div className="space-y-4">
                    {results.map((article) => (
                        <div
                            key={article.id}
                            className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <h3 className="text-xl font-semibold text-white">
                                    <a
                                        href={`/kb/${article.slug}`}
                                        className="hover:text-blue-400 transition-colors"
                                        dangerouslySetInnerHTML={{
                                            __html: highlightText(article.title, searchQuery)
                                        }}
                                    />
                                </h3>
                                <span className={`px-2 py-1 text-xs rounded ${
                                    article.difficulty === 'beginner' ? 'bg-green-900/50 text-green-300' :
                                    article.difficulty === 'intermediate' ? 'bg-yellow-900/50 text-yellow-300' :
                                    'bg-red-900/50 text-red-300'
                                }`}>
                                    {article.difficulty}
                                </span>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                                <span className="text-blue-400">{article.category}</span>
                                <span>•</span>
                                <span>{article.views} views</span>
                                {article.helpfulness_percentage > 0 && (
                                    <>
                                        <span>•</span>
                                        <span>{article.helpfulness_percentage}% helpful</span>
                                    </>
                                )}
                            </div>

                            <p
                                className="text-gray-300 mb-3"
                                dangerouslySetInnerHTML={{
                                    __html: highlightText(article.excerpt || article.snippet, searchQuery)
                                }}
                            />

                            {/* Tags */}
                            {article.tags && Array.isArray(article.tags) && article.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {article.tags.map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Load More Button */}
                {hasMore && !loading && (
                    <div className="mt-6 text-center">
                        <button
                            onClick={() => performSearch(true)}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            Load More Results
                        </button>
                    </div>
                )}

                {/* Loading More */}
                {loading && offset > 0 && (
                    <div className="mt-6 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </div>
                )}

                {/* No Results */}
                {!loading && results.length === 0 && (searchQuery || selectedCategory || selectedDifficulty) && (
                    <div className="text-center py-12 text-gray-400">
                        <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">No articles found matching your search</p>
                        <p className="text-sm mt-2">Try adjusting your filters or search query</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KnowledgeBaseSearch;
