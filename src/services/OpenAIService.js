// src/services/insights/OpenAIService.js

import OpenAI from 'openai';
import { OPENAI_API_KEY, OPENAI_CONFIG } from '../../config/openai';

/**
 * OpenAIService - Handles all OpenAI API interactions
 * 
 * Key Responsibilities:
 * 1. API authentication
 * 2. Error handling and retries
 * 3. Rate limiting
 * 4. Response validation
 * 
 * IMPORTANT CONCEPTS FOR INTERVIEWS:
 * - API error handling (network failures, rate limits)
 * - Retry logic with exponential backoff
 * - Response parsing and validation
 */

class OpenAIService {
  constructor() {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'sk-proj-your-key-here') {
      console.warn('⚠️ OpenAI API key not configured. Insights will use placeholder text.');
      this.client = null;
    } else {
      this.client = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });
    }
    
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }

  /**
   * Generate insight text from aggregated data
   * 
   * @param {string} prompt - The formatted prompt
   * @param {Object} options - Generation options
   * @returns {Promise<string>} - Generated insight text
   */
  async generateInsight(prompt, options = {}) {
    // Fallback if API not configured
    if (!this.client) {
      return this._getFallbackInsight();
    }

    const {
      maxTokens = OPENAI_CONFIG.maxTokens,
      temperature = OPENAI_CONFIG.temperature,
      retryCount = 0,
    } = options;

    try {
      // Rate limiting: Prevent too many requests
      await this._enforceRateLimit();

      console.log(`[OpenAI] Generating insight (attempt ${retryCount + 1})...`);
      
      // API call to OpenAI
      const response = await this.client.chat.completions.create({
        model: OPENAI_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: 'You are a productivity coach providing personalized insights based on focus session data. Be encouraging, specific, and actionable. Keep responses under 150 words.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: maxTokens,
        temperature: temperature,
      });

      // Extract and validate response
      const insightText = response.choices[0]?.message?.content;
      
      if (!insightText) {
        throw new Error('Empty response from OpenAI');
      }

      this.requestCount++;
      console.log(`[OpenAI] ✅ Insight generated (${response.usage.total_tokens} tokens)`);
      
      return insightText.trim();

    } catch (error) {
      return this._handleError(error, prompt, { maxTokens, temperature, retryCount });
    }
  }

  /**
   * Error handling with retry logic
   * @private
   */
  async _handleError(error, prompt, options) {
    const { retryCount } = options;
    
    console.error(`[OpenAI] Error (attempt ${retryCount + 1}):`, error.message);

    // Check if we should retry
    if (this._shouldRetry(error, retryCount)) {
      const delay = this._getRetryDelay(retryCount);
      console.log(`[OpenAI] Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.generateInsight(prompt, {
        ...options,
        retryCount: retryCount + 1,
      });
    }

    // Max retries exceeded or non-retryable error
    console.error('[OpenAI] ❌ Failed after retries, using fallback');
    return this._getFallbackInsight();
  }

  /**
   * Determine if error is retryable
   * @private
   */
  _shouldRetry(error, retryCount) {
    if (retryCount >= OPENAI_CONFIG.maxRetries) {
      return false;
    }

    // Retry on rate limits and network errors
    const retryableErrors = [
      'rate_limit_exceeded',
      'timeout',
      'network',
      'ECONNRESET',
      'ETIMEDOUT',
    ];

    return retryableErrors.some(type => 
      error.message?.toLowerCase().includes(type.toLowerCase())
    );
  }

  /**
   * Calculate retry delay with exponential backoff
   * Pattern: 1s, 2s, 4s, 8s...
   * @private
   */
  _getRetryDelay(retryCount) {
    return OPENAI_CONFIG.retryDelay * Math.pow(2, retryCount);
  }

  /**
   * Rate limiting: Prevent too many requests per minute
   * @private
   */
  async _enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Minimum 1 second between requests
    const MIN_REQUEST_INTERVAL = 1000;
    
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`[OpenAI] Rate limiting: waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Fallback insight when API fails
   * @private
   */
  _getFallbackInsight() {
    return `Great work on your focus sessions! Keep building your deep work habit. Track your progress over time to see improvements in your productivity patterns.`;
  }

  /**
   * Get usage statistics
   */
  getStats() {
    return {
      totalRequests: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      configured: !!this.client,
    };
  }
}

export default new OpenAIService();