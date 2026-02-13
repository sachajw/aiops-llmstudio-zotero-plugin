/**
 * Security Utilities for LLM Studio Zotero Plugin
 *
 * Provides HTML sanitization, URL validation, secure fetch with timeout/retry,
 * and error notification helpers.
 */

const SecurityUtils = (() => {
    "use strict";

    // Private IP ranges for SSRF protection
    const PRIVATE_IP_RANGES = [
        /^10\./,                          // 10.0.0.0/8
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
        /^192\.168\./,                     // 192.168.0.0/16
        /^127\./,                          // 127.0.0.0/8 (except 127.0.0.1)
        /^169\.254\./,                     // 169.254.0.0/16 (link-local)
        /^0\./,                            // 0.0.0.0/8
    ];

    // Cloud metadata service IPs
    const METADATA_IPS = [
        '169.254.169.254',  // AWS, Azure, GCP
        '100.100.100.200',  // Alibaba Cloud
        'metadata.google.internal',
    ];

    // Allowed HTML tags for LLM responses
    const ALLOWED_TAGS = [
        'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'code', 'pre',
        'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'a', 'span', 'div'
    ];

    // Dangerous attributes to strip
    const DANGEROUS_ATTRS = [
        'onclick', 'onerror', 'onload', 'onmouseover', 'onfocus',
        'onblur', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup'
    ];

    /**
     * Sanitize HTML to prevent XSS attacks
     * @param {string} html - Raw HTML string
     * @returns {string} Sanitized HTML
     */
    function sanitizeHTML(html) {
        if (!html || typeof html !== 'string') {
            return '';
        }

        let sanitized = html;

        // Remove script tags and content
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        // Remove dangerous tags
        const dangerousTags = ['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta', 'base', 'form'];
        dangerousTags.forEach(tag => {
            const regex = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi');
            sanitized = sanitized.replace(regex, '');
            // Also remove self-closing versions
            const selfClosing = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
            sanitized = sanitized.replace(selfClosing, '');
        });

        // Remove javascript: and data: URLs
        sanitized = sanitized.replace(/href\s*=\s*["']?\s*javascript:/gi, 'href="#"');
        sanitized = sanitized.replace(/href\s*=\s*["']?\s*data:/gi, 'href="#"');
        sanitized = sanitized.replace(/src\s*=\s*["']?\s*javascript:/gi, 'src=""');
        sanitized = sanitized.replace(/src\s*=\s*["']?\s*data:/gi, 'src=""');

        // Remove dangerous event handlers
        DANGEROUS_ATTRS.forEach(attr => {
            const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
            sanitized = sanitized.replace(regex, '');
            const regex2 = new RegExp(`\\s${attr}\\s*=\\s*[^\\s>]*`, 'gi');
            sanitized = sanitized.replace(regex2, '');
        });

        // Remove any remaining on* attributes
        sanitized = sanitized.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
        sanitized = sanitized.replace(/\son\w+\s*=\s*[^\s>]*/gi, '');

        return sanitized;
    }

    /**
     * Validate if a URL is safe for LLM server connections
     * @param {string} url - URL to validate
     * @returns {boolean} True if URL is safe
     */
    function isValidLLMServerURL(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        try {
            const parsed = new URL(url);

            // Only allow http and https
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return false;
            }

            // Check for dangerous protocols in hostname
            if (parsed.hostname.match(/^(file|ftp|data|javascript):/i)) {
                return false;
            }

            // Check if strict validation is enabled
            const strictValidation = Zotero?.LMStudio?.prefs?.get('security.enableStrictValidation', false);

            // If strict validation is disabled, allow all http/https URLs (local-only use case)
            if (!strictValidation) {
                return true;
            }

            // Strict validation enabled - check localhost and remote server settings
            const isLocalhost = [
                'localhost',
                '127.0.0.1',
                '[::1]',
                '::1'
            ].includes(parsed.hostname.toLowerCase());

            if (isLocalhost) {
                return true;
            }

            // Check if remote servers are allowed
            const allowRemote = Zotero?.LMStudio?.prefs?.get('security.allowRemoteServers');
            if (!allowRemote) {
                return false;  // Only localhost allowed by default
            }

            // Check against metadata service IPs
            if (METADATA_IPS.includes(parsed.hostname)) {
                return false;
            }

            // Check against private IP ranges (except 127.0.0.1 which we already allowed)
            const hostname = parsed.hostname;
            if (hostname !== '127.0.0.1') {
                for (const range of PRIVATE_IP_RANGES) {
                    if (range.test(hostname)) {
                        return false;
                    }
                }
            }

            // Check trusted hosts list
            const trustedHosts = Zotero?.LMStudio?.prefs?.get('security.trustedHosts') || '';
            const trustedList = trustedHosts.split(',').map(h => h.trim()).filter(h => h);

            if (trustedList.length > 0) {
                const isInTrustedList = trustedList.some(trusted => {
                    // Allow exact match or subdomain match
                    return hostname === trusted || hostname.endsWith('.' + trusted);
                });

                if (!isInTrustedList) {
                    return false;
                }
            }

            // Validate port
            if (parsed.port) {
                const port = parseInt(parsed.port, 10);
                if (isNaN(port) || port < 1 || port > 65535) {
                    return false;
                }
            }

            return true;
        } catch (e) {
            // Invalid URL format
            return false;
        }
    }

    /**
     * Validate chat request data
     * @param {object} data - Request data
     * @throws {Error} If validation fails
     */
    function validateChatRequest(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid request data');
        }

        if (!Array.isArray(data.messages)) {
            throw new Error('messages must be an array');
        }

        if (data.messages.length === 0) {
            throw new Error('messages array cannot be empty');
        }

        // Validate each message
        data.messages.forEach((msg, idx) => {
            if (!msg || typeof msg !== 'object') {
                throw new Error(`Invalid message at index ${idx}`);
            }
            if (!msg.role || typeof msg.role !== 'string') {
                throw new Error(`Missing or invalid role at index ${idx}`);
            }
            if (!msg.content || typeof msg.content !== 'string') {
                throw new Error(`Missing or invalid content at index ${idx}`);
            }
        });

        // Validate options if present
        if (data.options) {
            const opts = data.options;

            if (opts.temperature !== undefined) {
                const temp = parseFloat(opts.temperature);
                if (isNaN(temp) || temp < 0 || temp > 2) {
                    throw new Error('temperature must be between 0 and 2');
                }
            }

            if (opts.maxTokens !== undefined) {
                const tokens = parseInt(opts.maxTokens, 10);
                if (isNaN(tokens) || tokens < 1 || tokens > 100000) {
                    throw new Error('maxTokens must be between 1 and 100000');
                }
            }

            if (opts.topP !== undefined) {
                const topP = parseFloat(opts.topP);
                if (isNaN(topP) || topP < 0 || topP > 1) {
                    throw new Error('topP must be between 0 and 1');
                }
            }
        }

        // Validate model if present
        if (data.model !== undefined && typeof data.model !== 'string') {
            throw new Error('model must be a string');
        }
    }

    /**
     * Validate search query
     * @param {string} query - Search query
     * @throws {Error} If validation fails
     */
    function validateSearchQuery(query) {
        if (!query || typeof query !== 'string') {
            throw new Error('Query must be a non-empty string');
        }

        if (query.length > 1000) {
            throw new Error('Query too long (max 1000 characters)');
        }

        if (query.trim().length === 0) {
            throw new Error('Query cannot be empty or whitespace only');
        }
    }

    /**
     * Fetch with timeout using AbortController (if available) or fallback
     * @param {string} url - URL to fetch
     * @param {object} options - Fetch options
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Response>} Fetch response
     */
    async function fetchWithTimeout(url, options = {}, timeout = 30000) {
        // Check if AbortController is available (not in all Zotero versions)
        if (typeof AbortController !== 'undefined') {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                return response;
            } catch (e) {
                clearTimeout(timeoutId);
                if (e.name === 'AbortError') {
                    throw new Error(`Request timeout after ${timeout}ms`);
                }
                throw e;
            }
        } else {
            // Fallback without AbortController - just use fetch with manual timeout tracking
            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Request timeout after ${timeout}ms`));
                }, timeout);

                fetch(url, options)
                    .then(response => {
                        clearTimeout(timeoutId);
                        resolve(response);
                    })
                    .catch(error => {
                        clearTimeout(timeoutId);
                        reject(error);
                    });
            });
        }
    }

    /**
     * Fetch with retry logic and exponential backoff
     * @param {string} url - URL to fetch
     * @param {object} options - Fetch options
     * @param {number} retries - Number of retries
     * @param {number} timeout - Timeout per attempt in milliseconds
     * @returns {Promise<Response>} Fetch response
     */
    async function fetchWithRetry(url, options = {}, retries = 3, timeout = 30000) {
        let lastError;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await fetchWithTimeout(url, options, timeout);
            } catch (e) {
                lastError = e;

                // Don't retry on HTTP errors (4xx, 5xx) - only on network errors
                if (e.response) {
                    throw e;
                }

                // Don't retry on last attempt
                if (attempt === retries) {
                    break;
                }

                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }

    /**
     * Secure fetch with URL validation, timeout, and retry
     * @param {string} url - URL to fetch
     * @param {object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    async function secureFetch(url, options = {}) {
        // Validate URL
        if (!isValidLLMServerURL(url)) {
            throw new Error('Invalid or unsafe server URL');
        }

        // Get timeout and retry settings from preferences
        const timeout = Zotero?.LMStudio?.prefs?.get('timeout') || 30000;
        const retryCount = Zotero?.LMStudio?.prefs?.get('retryCount') || 3;

        // Fetch with retry and timeout
        return await fetchWithRetry(url, options, retryCount, timeout);
    }

    /**
     * Show error notification to user
     * @param {string} message - Error message
     * @param {string} details - Error details
     */
    function notifyError(message, details = '') {
        try {
            const pw = new Zotero.ProgressWindow();
            pw.changeHeadline('LM Studio Error');
            pw.addDescription(message);
            if (details) {
                pw.addDescription(`Details: ${details}`);
            }
            pw.show();
            pw.startCloseTimer(5000);
        } catch (e) {
            // Fallback to console if ProgressWindow fails
            console.error(`[LM Studio] ${message}`, details);
        }
    }

    /**
     * Show success notification to user
     * @param {string} message - Success message
     */
    function notifySuccess(message) {
        try {
            const pw = new Zotero.ProgressWindow();
            pw.changeHeadline('LM Studio');
            pw.addDescription(message);
            pw.show();
            pw.startCloseTimer(3000);
        } catch (e) {
            // Fallback to console
            console.log(`[LM Studio] ${message}`);
        }
    }

    /**
     * Generate a random API key
     * @returns {string} Random API key (hex string)
     */
    function generateAPIKey() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // Public API
    return {
        sanitizeHTML,
        isValidLLMServerURL,
        validateChatRequest,
        validateSearchQuery,
        fetchWithTimeout,
        fetchWithRetry,
        secureFetch,
        notifyError,
        notifySuccess,
        generateAPIKey
    };
})();

// Make available globally in Zotero context and plugin context
// Export to Zotero global
if (typeof Zotero !== 'undefined') {
    Zotero.SecurityUtils = SecurityUtils;
}
// Also export to the script context's globalThis (for bootstrap loaded scripts)
if (typeof _globalThis !== 'undefined') {
    _globalThis.SecurityUtils = SecurityUtils;
}
