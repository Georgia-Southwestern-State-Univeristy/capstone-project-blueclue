const ArticleList = ({ articles, onEdit, onDelete, onTogglePublish, onView }) => {
    if (articles.length === 0) {
        return (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-200">No articles found</h3>
                <p className="mt-1 text-sm text-gray-400">Get started by creating a new article.</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900/50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Title
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Views
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Helpful
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Author
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {articles.map((article) => (
                        <tr key={article.id} className="hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-4">
                                <div>
                                    <div className="text-sm font-medium text-gray-200">
                                        {article.title}
                                    </div>
                                    {article.excerpt && (
                                        <div className="text-sm text-gray-400 mt-1 line-clamp-2">
                                            {article.excerpt}
                                        </div>
                                    )}
                                    {article.tags && Array.isArray(article.tags) && article.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
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
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-700 text-gray-300">
                                    {article.category}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        article.is_published
                                            ? 'bg-green-900/50 text-green-300'
                                            : 'bg-yellow-900/50 text-yellow-300'
                                    }`}
                                >
                                    {article.is_published ? 'Published' : 'Draft'}
                                </span>
                                {article.is_public && (
                                    <span className="ml-1 px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-900/50 text-blue-300">
                                        Public
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                {article.views}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-200">
                                    {article.helpfulness_percentage || 0}%
                                </div>
                                <div className="text-xs text-gray-400">
                                    {article.helpful_votes}↑ {article.not_helpful_votes}↓
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                {article.author_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => onView(article)}
                                        className="text-gray-400 hover:text-gray-200 transition-colors"
                                        title="View article"
                                    >
                                        View
                                    </button>
                                    <button
                                        onClick={() => onEdit(article)}
                                        className="text-blue-400 hover:text-blue-300 transition-colors"
                                        title="Edit article"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => onTogglePublish(article.id, article.is_published)}
                                        className={`${
                                            article.is_published
                                                ? 'text-yellow-400 hover:text-yellow-300'
                                                : 'text-green-400 hover:text-green-300'
                                        } transition-colors`}
                                        title={article.is_published ? 'Unpublish' : 'Publish'}
                                    >
                                        {article.is_published ? 'Unpublish' : 'Publish'}
                                    </button>
                                    <button
                                        onClick={() => onDelete(article.id)}
                                        className="text-red-400 hover:text-red-300 transition-colors"
                                        title="Delete article"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ArticleList;
