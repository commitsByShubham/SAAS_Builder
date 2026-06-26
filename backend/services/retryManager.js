/**
 * RetryManager - Exponential backoff with jitter for Gemini free-tier resilience.
 * Handles: HTTP 429 (rate limit), 503 (overloaded), network errors.
 * Strategy: 5 attempts, base 5s, max ~80s total wait.
 */

const logger = require('../utils/logger');

/**
 * @param {Function} fn      - Async function to call
 * @param {Array}    args    - Arguments for fn
 * @param {number}   maxAttempts - Max retry attempts (default 5)
 * @param {number}   baseDelayMs - Base delay in ms (default 5000)
 * @returns {{ result: any, retryCount: number }}
 */
async function executeWithRetry(fn, args = [], maxAttempts = 5, baseDelayMs = 5000) {
  let attempt = 0;
  let retryCount = 0;

  while (true) {
    try {
      const result = await fn(...args);
      return { result, retryCount };
    } catch (error) {
      attempt++;
      retryCount++;
      const msg = error.message || '';

      const isRateLimit =
        msg.includes('429') ||
        msg.toLowerCase().includes('quota') ||
        msg.toLowerCase().includes('exhausted') ||
        msg.toLowerCase().includes('rate_limit') ||
        msg.toLowerCase().includes('rate limit');

      const isOverloaded =
        msg.includes('503') ||
        msg.toLowerCase().includes('unavailable') ||
        msg.toLowerCase().includes('overloaded') ||
        msg.toLowerCase().includes('high demand');

      const isNetwork =
        msg.toLowerCase().includes('fetch') ||
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('timeout') ||
        msg.toLowerCase().includes('econnreset') ||
        msg.toLowerCase().includes('enotfound');

      if (attempt >= maxAttempts) {
        logger.log(
          `[RetryManager] All ${maxAttempts} attempts exhausted. Final error: ${msg}`,
          'error'
        );
        throw error;
      }

      // Exponential backoff with ±20% jitter to avoid thundering-herd
      const expDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = expDelay * 0.2 * (Math.random() * 2 - 1); // ±20%
      const delay = Math.round(expDelay + jitter);

      const reason = isRateLimit
        ? 'Rate-Limit (429)'
        : isOverloaded
        ? 'API Overloaded (503)'
        : isNetwork
        ? 'Network Error'
        : 'API Failure';

      logger.log(
        `[RetryManager] Attempt ${attempt}/${maxAttempts} failed — ${reason}. ` +
          `Retrying in ${(delay / 1000).toFixed(1)}s…`,
        'warn'
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

module.exports = { executeWithRetry };
