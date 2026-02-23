// src/services/priorityService.js
/**
 * Priority Calculation Service
 * Implements weighted priority algorithm combining user input and AI predictions
 */

/**
 * Priority weights configuration
 * These can be overridden by admin settings
 */
const DEFAULT_CONFIG = {
    aiWeight: 0.7,           // Weight for AI recommendation
    userWeight: 0.3,         // Weight for user selection
    highConfidenceThreshold: 0.8,  // Threshold for high confidence
    mediumConfidenceThreshold: 0.5, // Threshold for medium confidence
    enableAIPriority: true,  // Master switch for AI priority
    showWarningOnOverride: true // Show warning when user overrides high-confidence AI
};

// Priority values for calculation
const PRIORITY_VALUES = {
    'critical': 4,
    'high': 3,
    'medium': 2,
    'low': 1
};

// Reverse mapping
const VALUE_TO_PRIORITY = {
    4: 'critical',
    3: 'high',
    2: 'medium',
    1: 'low'
};

/**
 * Get confidence level text
 * @param {number} confidence - Confidence score (0-1)
 * @returns {string} Confidence level (high, medium, low)
 */
export const getConfidenceLevel = (confidence) => {
    if (confidence >= DEFAULT_CONFIG.highConfidenceThreshold) {
        return 'high';
    } else if (confidence >= DEFAULT_CONFIG.mediumConfidenceThreshold) {
        return 'medium';
    } else {
        return 'low';
    }
};

/**
 * Check if priorities differ significantly
 * @param {string} priority1 
 * @param {string} priority2 
 * @returns {boolean} True if priorities differ by more than one level
 */
export const prioritiesDifferSignificantly = (priority1, priority2) => {
    const val1 = PRIORITY_VALUES[priority1] || 1;
    const val2 = PRIORITY_VALUES[priority2] || 1;
    return Math.abs(val1 - val2) > 1;
};

/**
 * Calculate final priority using weighted algorithm
 * @param {Object} params
 * @param {string|null} params.userPriority - Priority selected by user (null if not specified)
 * @param {string} params.aiPriority - Priority predicted by AI
 * @param {number} params.aiConfidence - AI confidence score (0-1)
 * @param {Object} params.config - Configuration overrides
 * @returns {Object} { finalPriority, requiresConfirmation, warning, metadata }
 */
export const calculateFinalPriority = ({ 
    userPriority, 
    aiPriority, 
    aiConfidence, 
    config = {} 
}) => {
    // Merge config with defaults
    const settings = { ...DEFAULT_CONFIG, ...config };

    // If AI priority is disabled, use user selection or default
    if (!settings.enableAIPriority) {
        return {
            finalPriority: userPriority || 'low',
            requiresConfirmation: false,
            warning: null,
            metadata: {
                method: 'user_only',
                aiEnabled: false
            }
        };
    }

    // If user didn't specify a priority, use AI prediction directly
    if (!userPriority) {
        return {
            finalPriority: aiPriority || 'low',
            requiresConfirmation: false,
            warning: null,
            metadata: {
                method: 'ai_direct',
                aiConfidence,
                confidenceLevel: getConfidenceLevel(aiConfidence)
            }
        };
    }

    // User specified a priority - check for conflicts with AI
    const confidenceLevel = getConfidenceLevel(aiConfidence);
    const significantDifference = prioritiesDifferSignificantly(userPriority, aiPriority);

    // High confidence AI + significant difference = show warning
    if (confidenceLevel === 'high' && significantDifference && settings.showWarningOnOverride) {
        return {
            finalPriority: userPriority, // Still use user selection initially
            requiresConfirmation: true,
            warning: {
                message: `AI recommends "${aiPriority}" priority with ${Math.round(aiConfidence * 100)}% confidence, but you selected "${userPriority}". Would you like to use the AI recommendation?`,
                aiPriority,
                userPriority,
                confidence: aiConfidence,
                confidenceLevel
            },
            metadata: {
                method: 'user_override_with_warning',
                aiConfidence,
                confidenceLevel,
                significantDifference: true
            }
        };
    }

    // Medium-high confidence: Use weighted average
    if (aiConfidence >= DEFAULT_CONFIG.mediumConfidenceThreshold) {
        const userValue = PRIORITY_VALUES[userPriority] || 1;
        const aiValue = PRIORITY_VALUES[aiPriority] || 1;

        // Adjust AI weight based on confidence
        const adjustedAiWeight = settings.aiWeight * aiConfidence;
        const adjustedUserWeight = settings.userWeight;
        
        // Normalize weights
        const totalWeight = adjustedAiWeight + adjustedUserWeight;
        const normalizedAiWeight = adjustedAiWeight / totalWeight;
        const normalizedUserWeight = adjustedUserWeight / totalWeight;

        // Calculate weighted average
        const weightedValue = (userValue * normalizedUserWeight) + (aiValue * normalizedAiWeight);
        
        // Round to nearest priority level
        const finalValue = Math.round(weightedValue);
        const finalPriority = VALUE_TO_PRIORITY[finalValue] || 'low';

        return {
            finalPriority,
            requiresConfirmation: false,
            warning: null,
            metadata: {
                method: 'weighted_average',
                userValue,
                aiValue,
                weightedValue,
                finalValue,
                aiWeight: normalizedAiWeight,
                userWeight: normalizedUserWeight,
                aiConfidence,
                confidenceLevel
            }
        };
    }

    // Low AI confidence: Trust user selection
    return {
        finalPriority: userPriority,
        requiresConfirmation: false,
        warning: null,
        metadata: {
            method: 'user_priority_low_confidence',
            aiConfidence,
            confidenceLevel,
            reason: 'AI confidence too low, using user selection'
        }
    };
};

/**
 * Generate explanation for priority decision
 * @param {Object} result - Result from calculateFinalPriority
 * @param {string} userPriority
 * @param {string} aiPriority
 * @returns {string} Human-readable explanation
 */
export const explainPriorityDecision = (result, userPriority, aiPriority) => {
    const { metadata } = result;

    switch (metadata.method) {
        case 'ai_direct':
            return `Using AI recommendation: ${result.finalPriority} (${Math.round(metadata.aiConfidence * 100)}% confidence)`;
        
        case 'weighted_average':
            return `Balanced decision between your selection (${userPriority}) and AI recommendation (${aiPriority}): ${result.finalPriority}`;
        
        case 'user_override_with_warning':
            return `Using your selection (${userPriority}), but AI strongly recommends ${aiPriority}`;
        
        case 'user_priority_low_confidence':
            return `Using your selection (${userPriority}) - AI confidence is low`;
        
        case 'user_only':
            return `Using your selection (${userPriority}) - AI priority is disabled`;
        
        default:
            return `Final priority: ${result.finalPriority}`;
    }
};

/**
 * Track priority override for analytics
 * @param {Object} override - Override details
 * @returns {Object} Formatted override record
 */
export const createOverrideRecord = ({ 
    ticketId, 
    userId, 
    userPriority, 
    aiPriority, 
    finalPriority, 
    aiConfidence, 
    reason 
}) => {
    return {
        ticket_id: ticketId,
        user_id: userId,
        user_priority: userPriority,
        ai_recommended_priority: aiPriority,
        final_priority: finalPriority,
        ai_confidence: aiConfidence,
        override_reason: reason,
        confidence_level: getConfidenceLevel(aiConfidence),
        significant_difference: prioritiesDifferSignificantly(userPriority, aiPriority),
        created_at: new Date().toISOString()
    };
};

export default {
    calculateFinalPriority,
    getConfidenceLevel,
    prioritiesDifferSignificantly,
    explainPriorityDecision,
    createOverrideRecord,
    DEFAULT_CONFIG
};
