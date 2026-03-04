// src/services/aiService.js
/**
 * AI / ML Classification Service
 * ================================
 * Communicates with the BlueClue ML Inference Service (FastAPI) for ticket
 * classification (category, priority) and resolution-time prediction.
 *
 * Features:
 *  - Separate endpoints for category / priority / time / combined
 *  - Circuit-breaker pattern to prevent cascading failures
 *  - Exponential-backoff retry for transient errors
 *  - In-memory cache with TTL
 *  - Graceful rule-based fallback when the ML service is down
 */

// -------------------------------------------------------------------------- //
// Configuration
// -------------------------------------------------------------------------- //

const _rawAiUrl     = process.env.AI_SERVICE_URL || 'http://localhost:5000';
const AI_SERVICE_URL = /^https?:\/\//i.test(_rawAiUrl) ? _rawAiUrl : `http://${_rawAiUrl}`;
const AI_SERVICE_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT, 10) || 5000;
const MAX_RETRIES = parseInt(process.env.AI_MAX_RETRIES, 10) || 2;
const RETRY_BASE_MS = 200;

// Circuit-breaker settings
const CB_FAILURE_THRESHOLD = 5;   // open circuit after N consecutive failures
const CB_RESET_TIMEOUT_MS = 30000; // try again after 30 s

// Cache settings
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_MAX_SIZE = 500;

// -------------------------------------------------------------------------- //
// Simple in-memory TTL cache
// -------------------------------------------------------------------------- //

class PredictionCache {
    constructor(maxSize = CACHE_MAX_SIZE, ttlMs = CACHE_TTL_MS) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
        /** @type {Map<string, {value: any, ts: number}>} */
        this._store = new Map();
    }

    _key(text, endpoint) {
        // Simple hash: use first 200 chars + endpoint to keep keys short
        return `${endpoint}:${text.slice(0, 200)}`;
    }

    get(text, endpoint) {
        const key = this._key(text, endpoint);
        const entry = this._store.get(key);
        if (!entry) return null;
        if (Date.now() - entry.ts > this.ttlMs) {
            this._store.delete(key);
            return null;
        }
        return entry.value;
    }

    set(text, endpoint, value) {
        const key = this._key(text, endpoint);
        this._store.set(key, { value, ts: Date.now() });
        // Evict oldest entries if over capacity
        if (this._store.size > this.maxSize) {
            const oldest = this._store.keys().next().value;
            this._store.delete(oldest);
        }
    }
}

const predictionCache = new PredictionCache();

// -------------------------------------------------------------------------- //
// Circuit breaker
// -------------------------------------------------------------------------- //

const circuitBreaker = {
    failures: 0,
    state: 'CLOSED',       // CLOSED | OPEN | HALF_OPEN
    lastFailureTime: 0,

    recordSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    },

    recordFailure() {
        this.failures += 1;
        this.lastFailureTime = Date.now();
        if (this.failures >= CB_FAILURE_THRESHOLD) {
            this.state = 'OPEN';
            console.warn(`[aiService] Circuit breaker OPEN after ${this.failures} failures`);
        }
    },

    canRequest() {
        if (this.state === 'CLOSED') return true;
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > CB_RESET_TIMEOUT_MS) {
                this.state = 'HALF_OPEN';
                return true;            // allow one probe request
            }
            return false;
        }
        // HALF_OPEN → allow
        return true;
    },
};

// -------------------------------------------------------------------------- //
// Rule-based fallback (mirrors the ML service fallback logic)
// -------------------------------------------------------------------------- //

const CATEGORY_KEYWORDS = {
    hardware: ['laptop', 'computer', 'monitor', 'printer', 'keyboard', 'mouse',
               'screen', 'battery', 'charger', 'hardware', 'device'],
    software: ['install', 'update', 'crash', 'application', 'software', 'windows',
               'office', 'excel', 'word', 'outlook', 'teams', 'app'],
    network:  ['wifi', 'internet', 'network', 'vpn', 'connection', 'wireless',
               'ethernet', 'bandwidth', 'dns', 'firewall'],
    account:  ['password', 'login', 'account', 'access', 'permission', 'locked',
               'reset', 'authentication', 'credentials'],
    billing:  ['invoice', 'billing', 'charge', 'payment', 'subscription', 'refund'],
    feature_request: ['feature', 'suggestion', 'enhancement', 'improvement', 'idea'],
};

const PRIORITY_KEYWORDS = {
    critical: ['urgent', 'emergency', 'down', 'outage', 'critical', 'production'],
    high:     ['important', 'asap', 'deadline', 'broken', 'cannot access', 'blocking'],
    medium:   ['issue', 'problem', 'error', 'slow'],
    low:      ['question', 'minor', 'cosmetic', 'feedback'],
};

function ruleBasedClassify(text) {
    const lower = (text || '').toLowerCase();

    let bestCat = 'general', bestCatScore = 0, matchedCatKws = [];
    for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
        const matched = kws.filter(kw => lower.includes(kw));
        if (matched.length > bestCatScore) {
            bestCat = cat;
            bestCatScore = matched.length;
            matchedCatKws = matched;
        }
    }

    let bestPri = 'low', bestPriScore = 0, matchedPriKws = [];
    for (const [pri, kws] of Object.entries(PRIORITY_KEYWORDS)) {
        const matched = kws.filter(kw => lower.includes(kw));
        if (matched.length > bestPriScore) {
            bestPri = pri;
            bestPriScore = matched.length;
            matchedPriKws = matched;
        }
    }

    return {
        category: bestCat,
        priority: bestPri,
        confidence: 0.3,
        fallbackUsed: true,
        category_keywords: matchedCatKws,
        priority_keywords: matchedPriKws,
    };
}

// -------------------------------------------------------------------------- //
// HTTP helper with timeout + retry
// -------------------------------------------------------------------------- //

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT);

        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                throw new Error(errBody.detail || errBody.message || `HTTP ${response.status}`);
            }

            circuitBreaker.recordSuccess();
            return await response.json();

        } catch (err) {
            clearTimeout(timeoutId);
            lastError = err;

            // Don't retry on client errors
            if (err.message && err.message.startsWith('HTTP 4')) break;

            // Exponential back-off before retrying
            if (attempt < retries) {
                const delay = RETRY_BASE_MS * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    circuitBreaker.recordFailure();
    throw lastError;
}

// -------------------------------------------------------------------------- //
// Public API
// -------------------------------------------------------------------------- //

/**
 * Classify ticket category using the ML service.
 * @param {string} text
 * @param {string} [subject]
 * @returns {Promise<{category: string, confidence: number, all_scores: object, model_version: string, low_confidence: boolean}>}
 */
export const classifyCategory = async (text, subject = null) => {
    if (!text || typeof text !== 'string' || !text.trim()) {
        throw new Error('Text is required for classification');
    }

    const cached = predictionCache.get(text, 'category');
    if (cached) return cached;

    if (!circuitBreaker.canRequest()) {
        console.warn('[aiService] Circuit open – using rule-based fallback for category');
        const fb = ruleBasedClassify(text);
        return { category: fb.category, confidence: fb.confidence, all_scores: {}, model_version: 'fallback', low_confidence: true };
    }

    const data = await fetchWithRetry(`${AI_SERVICE_URL}/classify/category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, subject }),
    });

    predictionCache.set(text, 'category', data);
    return data;
};

/**
 * Classify ticket priority using the ML service.
 */
export const classifyPriority = async (text, subject = null, category = null) => {
    if (!text || typeof text !== 'string' || !text.trim()) {
        throw new Error('Text is required for classification');
    }

    const cacheKey = `${text}|${category || ''}`;
    const cached = predictionCache.get(cacheKey, 'priority');
    if (cached) return cached;

    if (!circuitBreaker.canRequest()) {
        const fb = ruleBasedClassify(text);
        return { priority: fb.priority, confidence: fb.confidence, all_scores: {}, model_version: 'fallback', low_confidence: true };
    }

    const data = await fetchWithRetry(`${AI_SERVICE_URL}/classify/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, subject, category }),
    });

    predictionCache.set(cacheKey, 'priority', data);
    return data;
};

/**
 * Predict resolution time using the ML service.
 */
export const predictResolutionTime = async (text, subject = null, category = null, priority = null) => {
    if (!text) return null;

    const cacheKey = `${text}|${category || ''}|${priority || ''}`;
    const cached = predictionCache.get(cacheKey, 'time');
    if (cached) return cached;

    if (!circuitBreaker.canRequest()) {
        const fallbackHours = { critical: 4, high: 8, medium: 24, low: 48 };
        return { estimated_hours: fallbackHours[priority] || 24, model_version: 'fallback' };
    }

    const data = await fetchWithRetry(`${AI_SERVICE_URL}/predict/resolution_time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, subject, category, priority }),
    });

    predictionCache.set(cacheKey, 'time', data);
    return data;
};

/**
 * Combined classification (backward-compatible with old /classify endpoint).
 * Calls the FastAPI /classify endpoint which returns category + priority + time.
 */
export const classifyTicket = async (text) => {
    if (!text || typeof text !== 'string' || !text.trim()) {
        throw new Error('Text is required for classification');
    }

    const cached = predictionCache.get(text, 'combined');
    if (cached) return cached;

    if (!circuitBreaker.canRequest()) {
        console.warn('[aiService] Circuit open – using rule-based fallback');
        const fb = ruleBasedClassify(text);
        return {
            category: fb.category,
            priority: fb.priority,
            confidence: fb.confidence,
            category_confidence: fb.confidence,
            priority_confidence: fb.confidence,
            estimated_resolution_hours: null,
            fallback_used: true,
            model_versions: { category: 'fallback', priority: 'fallback' },
            low_confidence: true,
        };
    }

    const data = await fetchWithRetry(`${AI_SERVICE_URL}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
    });

    predictionCache.set(text, 'combined', data);
    return data;
};

/**
 * Check if the AI service is available and healthy.
 * @returns {Promise<{available: boolean, models: object}>}
 */
export const checkAIServiceHealth = async () => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${AI_SERVICE_URL}/health`, {
            method: 'GET',
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) return { available: false, models: {} };

        const data = await response.json();
        return { available: true, models: data.models_loaded || {} };

    } catch {
        return { available: false, models: {} };
    }
};

/**
 * Full classification with automatic fallback when the ML service is unavailable.
 * This is the main function called by the ticket controller.
 */
export const classifyTicketWithFallback = async (text, fallbackValues = {}) => {
    try {
        const classification = await classifyTicket(text);
        return {
            category: classification.category,
            priority: classification.priority,
            aiClassified: true,
            confidence: classification.confidence || classification.category_confidence,
            categoryConfidence: classification.category_confidence,
            priorityConfidence: classification.priority_confidence,
            estimatedResolutionHours: classification.estimated_resolution_hours,
            fallbackUsed: classification.fallback_used || false,
            modelVersions: classification.model_versions || {},
            lowConfidence: classification.low_confidence || false,
            category_keywords: [],   // ML models don't use keyword matching
            priority_keywords: [],
        };
    } catch (error) {
        console.warn('[aiService] ML classification failed, using fallback:', error.message);

        const fb = ruleBasedClassify(text);
        return {
            category: fallbackValues.category || fb.category,
            priority: fallbackValues.priority || fb.priority,
            aiClassified: false,
            confidence: 0,
            categoryConfidence: 0,
            priorityConfidence: 0,
            estimatedResolutionHours: null,
            fallbackUsed: true,
            error: error.message,
            lowConfidence: true,
            category_keywords: fb.category_keywords,
            priority_keywords: fb.priority_keywords,
        };
    }
};

export default {
    classifyTicket,
    classifyCategory,
    classifyPriority,
    predictResolutionTime,
    checkAIServiceHealth,
    classifyTicketWithFallback,
};
