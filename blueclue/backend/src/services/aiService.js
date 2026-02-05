// src/services/aiService.js
/**
 * AI Classification Service
 * Handles communication with the AI classification API for ticket categorization and prioritization
 */

/**
 * AI Service Configuration
 */
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';
const AI_SERVICE_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT) || 5000; // 5 seconds default

/**
 * Call the AI classification API to classify a ticket
 * @param {string} text - The ticket text to classify (subject + description)
 * @returns {Promise<Object>} Classification results { category, priority, confidence, ... }
 * @throws {Error} If the AI service is unavailable or returns an error
 */
export const classifyTicket = async (text) => {
    try {
        // Validate input
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            throw new Error('Text is required for classification');
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT);

        // Make request to AI service
        const response = await fetch(`${AI_SERVICE_URL}/classify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Handle non-200 responses
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.message || 
                `AI service returned status ${response.status}`
            );
        }

        // Parse and return classification results
        const data = await response.json();
        
        if (!data.success || !data.classification) {
            throw new Error('Invalid response format from AI service');
        }

        return data.classification;

    } catch (error) {
        // Handle timeout errors
        if (error.name === 'AbortError') {
            throw new Error('AI service request timed out');
        }

        // Handle network errors
        if (error.message.includes('fetch failed') || error.code === 'ECONNREFUSED') {
            throw new Error('AI service is unavailable');
        }

        // Re-throw other errors
        throw error;
    }
};

/**
 * Check if the AI service is available and healthy
 * @returns {Promise<boolean>} True if service is available, false otherwise
 */
export const checkAIServiceHealth = async () => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

        const response = await fetch(`${AI_SERVICE_URL}/health`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        return response.ok;

    } catch (error) {
        console.error('AI service health check failed:', error.message);
        return false;
    }
};

/**
 * Get AI classification with fallback to defaults if service is unavailable
 * @param {string} text - The ticket text to classify
 * @param {Object} fallbackValues - Default values to use if AI service fails
 * @returns {Promise<Object>} Classification results or fallback values
 */
export const classifyTicketWithFallback = async (text, fallbackValues = {}) => {
    try {
        const classification = await classifyTicket(text);
        return {
            category: classification.category,
            priority: classification.priority,
            aiClassified: true,
            confidence: classification.confidence,
            fallbackUsed: classification.fallback_used || false,
            category_keywords: classification.keywords_matched?.category || [],
            priority_keywords: classification.keywords_matched?.priority || []
        };

    } catch (error) {
        console.warn('AI classification failed, using fallback values:', error.message);
        
        return {
            category: fallbackValues.category || 'general',
            priority: fallbackValues.priority || 'low',
            aiClassified: false,
            confidence: 0,
            fallbackUsed: true,
            error: error.message
        };
    }
};

export default {
    classifyTicket,
    checkAIServiceHealth,
    classifyTicketWithFallback
};
