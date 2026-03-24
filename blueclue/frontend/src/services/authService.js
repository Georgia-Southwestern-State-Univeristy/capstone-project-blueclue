// ============================================================================
// Authentication Service
// ============================================================================
// Handles all authentication API calls and token management

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Store authentication token in localStorage
 */
const setToken = (token) => {
    localStorage.setItem('blueclue_token', token);
};

/**
 * Get authentication token from localStorage
 */
const getToken = () => {
    return localStorage.getItem('blueclue_token');
};

/**
 * Remove authentication token from localStorage
 */
const removeToken = () => {
    localStorage.removeItem('blueclue_token');
    localStorage.removeItem('blueclue_refresh_token');
    localStorage.removeItem('blueclue_user');
};

/**
 * Store refresh token in localStorage
 */
const setRefreshToken = (token) => {
    localStorage.setItem('blueclue_refresh_token', token);
};

/**
 * Get refresh token from localStorage
 */
const getRefreshToken = () => {
    return localStorage.getItem('blueclue_refresh_token');
};

/**
 * Store user data in localStorage
 */
const setUser = (user) => {
    localStorage.setItem('blueclue_user', JSON.stringify(user));
};

/**
 * Get user data from localStorage
 */
const getUser = () => {
    const user = localStorage.getItem('blueclue_user');
    return user ? JSON.parse(user) : null;
};

/**
 * Login - supports technicians (username) and customers (email)
 * 
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.username - Technician username (optional)
 * @param {string} credentials.email - Customer email (optional)
 * @param {string} credentials.password - Password (required)
 * @returns {Promise<Object>} Response with token and user data
 */
export const login = async (credentials) => {
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        // Store token and user data
        if (data.token) {
            setToken(data.token);
            if (data.refreshToken) {
                setRefreshToken(data.refreshToken);
            }
            if (data.user) {
                setUser(data.user);
            }
        }

        return data;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};

/**
 * Register new customer account
 * 
 * @param {Object} userData - Registration data
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Password
 * @param {string} userData.firstName - First name
 * @param {string} userData.lastName - Last name
 * @param {string} userData.phone - Phone number (optional)
 * @param {string} userData.company - Company name (optional)
 * @returns {Promise<Object>} Response with token and user data
 */
export const register = async (userData) => {
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        // Only store tokens if email verification is not required
        // After email verification implementation, registration won't return tokens
        if (data.token && !data.requiresVerification) {
            setToken(data.token);
            if (data.refreshToken) {
                setRefreshToken(data.refreshToken);
            }
            if (data.user) {
                setUser(data.user);
            }
        }

        return data;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
};

/**
 * Verify email address with token from email link
 * 
 * @param {string} token - Verification token from email
 * @returns {Promise<Object>} Response
 */
export const verifyEmail = async (token) => {
    try {
        const response = await fetch(`${API_URL}/auth/verify-email/${token}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Email verification failed');
        }

        return data;
    } catch (error) {
        console.error('Email verification error:', error);
        throw error;
    }
};

/**
 * Resend verification email
 * Rate limited: Max 3 requests per hour
 * 
 * @param {string} email - Email address
 * @returns {Promise<Object>} Response
 */
export const resendVerification = async (email) => {
    try {
        const response = await fetch(`${API_URL}/auth/resend-verification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to resend verification email');
        }

        return data;
    } catch (error) {
        console.error('Resend verification error:', error);
        throw error;
    }
};

/**
 * Change password
 * 
 * @param {string} currentPassword - Current password (optional for forced change)
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Response
 */
export const changePassword = async (currentPassword, newPassword) => {
    try {
        const token = getToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                currentPassword,
                newPassword,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Password change failed');
        }

        // Clear tokens after password change (user needs to re-login)
        removeToken();

        return data;
    } catch (error) {
        console.error('Change password error:', error);
        throw error;
    }
};

/**
 * Logout - revoke tokens and clear local storage
 * 
 * @returns {Promise<Object>} Response
 */
export const logout = async () => {
    try {
        const token = getToken();
        
        if (token) {
            // Call logout endpoint to revoke refresh tokens
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // Always clear local storage
        removeToken();
    }
};

/**
 * Refresh access token
 * 
 * @returns {Promise<string|null>} New access token or null if refresh failed
 */
export const refreshAccessToken = async () => {
    try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            return null;
        }

        const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
        });

        const data = await response.json();

        if (!response.ok) {
            removeToken();
            return null;
        }

        if (data.token) {
            setToken(data.token);
            return data.token;
        }

        return null;
    } catch (error) {
        console.error('Token refresh error:', error);
        removeToken();
        return null;
    }
};

/**
 * Get current user information
 * 
 * @returns {Promise<Object>} User data
 */
export const getCurrentUser = async () => {
    try {
        const token = getToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${API_URL}/auth/me`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            // Try to refresh token if expired
            if (response.status === 403 || response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    // Retry with new token
                    return getCurrentUser();
                }
            }
            throw new Error(data.message || 'Failed to get user data');
        }

        if (data.user) {
            setUser(data.user);
        }

        return data;
    } catch (error) {
        console.error('Get current user error:', error);
        throw error;
    }
};

/**
 * Check if user is authenticated
 * 
 * @returns {boolean} True if authenticated
 */
export const isAuthenticated = () => {
    return !!getToken();
};

/**
 * Get user data from localStorage (exported for components)
 */
export { getUser };

/**
 * Check if user needs to change password
 * 
 * @returns {boolean} True if password change is required
 */
export const needsPasswordChange = () => {
    const user = getUser();
    return user?.forcePasswordChange === true;
};

/**
 * Get user role
 * 
 * @returns {string|null} User role or null
 */
export const getUserRole = () => {
    const user = getUser();
    return user?.role || null;
};

/**
 * Get user ID
 * 
 * @returns {number|null} User ID or null
 */
export const getUserId = () => {
    const user = getUser();
    return user?.id || null;
};

/**
 * Update user profile (display name)
 * @param {Object} fields - { firstName, lastName }
 * @returns {Promise<Object>} Updated user + fresh token
 */
export const updateProfile = async ({ firstName, lastName }) => {
    const response = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ firstName, lastName }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Failed to update profile');
    }

    // Persist the refreshed token + user data
    if (data.token) setToken(data.token);
    if (data.user) setUser(data.user);

    return data;
};

export default {
    login,
    register,
    changePassword,
    logout,
    refreshAccessToken,
    getCurrentUser,
    updateProfile,
    isAuthenticated,
    needsPasswordChange,
    getUserRole,
    getToken,
    getUser,
};
