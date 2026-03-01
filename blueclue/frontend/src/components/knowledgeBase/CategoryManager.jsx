import { useState } from 'react';
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

const CategoryManager = ({ categories, onCategoriesChange }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        display_name: '',
        description: '',
        icon: '',
        sort_order: 0
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            if (editingId) {
                await axios.put(`/api/knowledge-base/categories/${editingId}`, formData, getAuthHeaders());
                alert('Category updated successfully');
            } else {
                await axios.post('/api/knowledge-base/categories', formData, getAuthHeaders());
                alert('Category created successfully');
            }
            
            resetForm();
            onCategoriesChange();
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Failed to save category: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleEdit = (category) => {
        setEditingId(category.id);
        setFormData({
            name: category.name,
            display_name: category.display_name,
            description: category.description || '',
            icon: category.icon || '',
            sort_order: category.sort_order || 0
        });
        setIsCreating(true);
    };

    const handleDelete = async (categoryId) => {
        if (!confirm('Are you sure you want to delete this category?')) return;

        try {
            await axios.delete(`/api/knowledge-base/categories/${categoryId}`, getAuthHeaders());
            alert('Category deleted successfully');
            onCategoriesChange();
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Failed to delete category: ' + (error.response?.data?.error || error.message));
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            display_name: '',
            description: '',
            icon: '',
            sort_order: 0
        });
        setIsCreating(false);
        setEditingId(null);
    };

    return (
        <div className="space-y-6">
            {/* Create/Edit Form */}
            {!isCreating ? (
                <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        + Create New Category
                    </button>
                </div>
            ) : (
                <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-200 mb-4">
                        {editingId ? 'Edit Category' : 'Create New Category'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Name (slug) *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., account-management"
                                    required
                                    disabled={editingId !== null}
                                />
                                <p className="text-xs text-gray-400 mt-1">Lowercase with hyphens (cannot be changed after creation)</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Display Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.display_name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                                    className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., Account Management"
                                    required
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                rows={2}
                                className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Brief description of this category"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Icon
                                </label>
                                <input
                                    type="text"
                                    value={formData.icon}
                                    onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                                    className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., user, wrench, book"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Sort Order
                                </label>
                                <input
                                    type="number"
                                    value={formData.sort_order}
                                    onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) }))}
                                    className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                {editingId ? 'Update Category' : 'Create Category'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 bg-gray-900/50 border border-gray-700 text-gray-200 text-gray-400 text-sm font-medium rounded-lg hover:bg-gray-800/50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Category List */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-800">
                    <thead className="bg-gray-800/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Display Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Slug
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Description
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Articles
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Order
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-900 divide-y divide-gray-800">
                        {categories.map((category) => (
                            <tr key={category.id} className="hover:bg-gray-800/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        {category.icon && (
                                            <span className="mr-2 text-gray-400">{category.icon}</span>
                                        )}
                                        <span className="text-sm font-medium text-gray-200">
                                            {category.display_name}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                    {category.name}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-400">
                                    {category.description || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                    {category.article_count || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                    {category.sort_order}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleEdit(category)}
                                        className="text-blue-400 hover:text-blue-300 mr-4 transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(category.id)}
                                        className="text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CategoryManager;
