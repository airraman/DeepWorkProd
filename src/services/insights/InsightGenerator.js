// src/services/insights/InsightGenerator.js

import SessionRepository from '../database/SessionRepository';
import InsightCacheRepository from '../database/InsightCacheRepository';
import DataAggregator from './DataAggregator';
import { CacheManager } from './CacheManager';
import { hashSessions } from '../../utils/hashHelper'; // ✅ FIXED: was generateDataHash
import { 
  getStartOfDay, 
  getStartOfWeek, 
  getStartOfMonth,
  getDateDaysAgo 
} from '../../utils/dateHelpers';
import OpenAIService from './OpenAIService';
import PromptBuilder from './PromptBuilder';

const BEHAVIORAL_SYSTEM_PROMPT = `You are a behavioral data analyst for a deep work / focus app. You review a user's session history (durations, activities, self-reported focus and productivity ratings, timing) and identify the single most useful, evidence-backed pattern in how they work.

Rules:
- Interpret, don't just report totals — the user already sees session counts and total hours elsewhere in the app.
- Every claim must be grounded in the numbers you're given. Never invent a cause the data doesn't support.
- Use cautious language ("Your data suggests...", "You tend to..."), not certainty.
- If the data doesn't support a clear pattern, say so honestly rather than manufacturing one.
- Always respond with ONLY the JSON object requested — no prose, no markdown fences.`;

// Minimum rated sessions in the 30-day window before it's worth spending an
// API call — below this there's rarely enough signal for a real comparison.
const MIN_RATED_SESSIONS_FOR_AI = 5;

/**
 * InsightGenerator - Orchestrates the insight generation flow
 * 
 * Responsibilities:
 * 1. Load relevant sessions
 * 2. Check cache validity
 * 3. Coordinate generation with OpenAI
 * 4. Persist results
 * 
 * Pattern: Service Layer / Orchestrator
 * - Coordinates multiple repositories and utilities
 * - Contains business logic but delegates implementation
 */

export class InsightGenerator {
  constructor() {
    this.sessionRepo = SessionRepository;
    this.cacheRepo = InsightCacheRepository;
    this.aggregator = DataAggregator;
  }

  /**
   * Main entry point - generates or retrieves cached insight
   * 
   * @param {string} insightType - 'daily', 'weekly', 'monthly', 'activity_X_week'
   * @param {Object} options - Optional parameters
   * @param {Date} options.referenceDate - Date to generate insight for (defaults to now)
   * @param {string} options.activityType - Required if insightType starts with 'activity_'
   * @param {boolean} options.forceRegenerate - Bypass cache
   * @returns {Promise<Object>} - Insight object with text and metadata
   */
  async generate(insightType, options = {}) {
    try {
      const { 
        referenceDate = new Date(), 
        activityType = null,
        forceRegenerate = false 
      } = options;

      if (!(referenceDate instanceof Date) || isNaN(referenceDate.getTime())) {
        throw new Error(`Invalid referenceDate: ${referenceDate}`);
      }

      console.log(`[InsightGenerator] Generating ${insightType} insight...`);

      // Step 1: Calculate time period
      const timePeriod = this._getTimePeriod(insightType, referenceDate, activityType);


      console.log(`📅 [InsightGenerator] Time period calculated:`, {
        insightType,
        start: new Date(timePeriod.start).toISOString(),
        end: new Date(timePeriod.end).toISOString(),
        label: timePeriod.label
      });
      


      // Step 2: Load sessions for this time period
      const sessions = await this.sessionRepo.getSessionsByDateRange(
        timePeriod.start,
        timePeriod.end
      );

            // ✅ ADD THIS LOGGING
      console.log(`📊 [InsightGenerator] Sessions loaded:`, {
        count: sessions.length,
        firstSession: sessions[0] ? new Date(sessions[0].start_time).toISOString() : 'none',
        lastSession: sessions[sessions.length-1] ? new Date(sessions[sessions.length-1].start_time).toISOString() : 'none'
      });

      // Handle empty data case
      if (sessions.length === 0) {
        console.log('[InsightGenerator] No sessions found for period');
        return this._generateEmptyInsight(insightType, timePeriod);
      }

      // Step 3: Filter by activity if needed
      const filteredSessions = activityType
        ? sessions.filter(s => s.activity_type === activityType)
        : sessions;

      if (filteredSessions.length === 0) {
        console.log('[InsightGenerator] No sessions after filtering');
        return this._generateEmptyInsight(insightType, timePeriod);
      }

      // Step 4: Generate hash of current data
      const currentDataHash = hashSessions(filteredSessions); // ✅ FIXED: was generateDataHash

      // Step 5: Check cache (unless force regenerate)
      if (!forceRegenerate) {
        const cachedInsight = await this.cacheRepo.get(
          insightType,
          timePeriod.start,
          timePeriod.end
        );

        if (CacheManager.isCacheValid(cachedInsight, currentDataHash, insightType)) {
          // Reject cache entries that contain known error/fallback text — these
          // were written when the API key was missing and should be regenerated.
          const isErrorCached = cachedInsight.insight_text?.includes('Please check your API') ||
            cachedInsight.insight_text?.includes('Unable to generate insight at this time');
          if (!isErrorCached) {
            console.log(`[InsightGenerator] Cache hit for ${insightType}`);
            return this._formatCachedInsight(cachedInsight);
          }
          console.log(`[InsightGenerator] Cache hit but contains error text — regenerating`);
        }
      }

      console.log('[InsightGenerator] Cache miss or force regenerate - generating new insight');

      // Step 6: Aggregate data (reduce tokens from ~1250 to ~200)
      const aggregatedData = insightType === 'behavioral_30d'
        ? this.aggregator.aggregateBehavioralData(filteredSessions, { daysInWindow: 30 })
        : this.aggregator.aggregateSessions(filteredSessions, { timePeriod });

      // ✅ ADD THIS DEBUG BLOCK
console.log('[InsightGenerator] === DEBUG AGGREGATED DATA ===');
console.log('Keys:', Object.keys(aggregatedData));
console.log('Full structure:', JSON.stringify(aggregatedData, null, 2).substring(0, 1000));
console.log('==========================================');

      // Step 7: Generate insight using OpenAI
      const insightText = await this._generateInsightText(
        aggregatedData,
        insightType,
        activityType
      );

      // Step 8: Cache the result
      await this.cacheRepo.upsert({
        insight_type: insightType,
        generated_at: Date.now(),
        data_hash: currentDataHash,
        insight_text: insightText,
        time_period_start: timePeriod.start,
        time_period_end: timePeriod.end,
      });

      console.log('[InsightGenerator] Insight cached successfully');

      // Retrieve the cached insight to return
      const cachedInsight = await this.cacheRepo.get(
        insightType,
        timePeriod.start,
        timePeriod.end
      );

      return this._formatCachedInsight(cachedInsight);

    } catch (error) {
      console.error('[InsightGenerator] Error generating insight:', error);
      
      // Return graceful fallback instead of throwing
      return {
        success: false,
        insightText: 'Unable to generate insight at this time. Please try again later.',
        metadata: {
          error: error.message,
          insightType,
        },
      };
    }
  }

  /**
   * Calculate time period based on insight type
   * @private
   */
  _getTimePeriod(insightType, referenceDate, activityType) {
    const refTimestamp = referenceDate.getTime();

    switch (insightType) {
      case 'daily':
        return {
          start: getStartOfDay(refTimestamp) - 24 * 60 * 60 * 1000, // Yesterday
          end: getStartOfDay(refTimestamp) - 1, // End of yesterday
          label: 'Yesterday',
        };

      case 'weekly':
        const weekStart = getStartOfWeek(refTimestamp);
        return {
          start: weekStart - 7 * 24 * 60 * 60 * 1000, // Last week
          end: weekStart - 1, // End of last week
          label: 'Last 7 days',
        };

      case 'monthly':
        const monthStart = getStartOfMonth(refTimestamp);
        const prevMonthStart = getStartOfMonth(monthStart - 1);
        return {
          start: prevMonthStart,
          end: monthStart - 1,
          label: 'Last month',
        };

      case 'behavioral_30d':
        return {
          start: refTimestamp - 30 * 24 * 60 * 60 * 1000,
          end: refTimestamp,
          label: 'Last 30 days',
        };

      default:
        // Activity-specific: 'activity_work_week' -> last 7 days of 'work'
        if (insightType.startsWith('activity_')) {
          const sevenDaysAgo = getDateDaysAgo(7).getTime();
          return {
            start: sevenDaysAgo,
            end: refTimestamp,
            label: `Last 7 days - ${activityType}`,
          };
        }

        throw new Error(`Unknown insight type: ${insightType}`);
    }
  }

/**
 * Generate insight text using OpenAI
 * @private
 */
async _generateInsightText(aggregatedData, insightType, activityType) {
  if (insightType === 'behavioral_30d') {
    return this._generateBehavioralInsightText(aggregatedData);
  }

  try {
    // Debug: Log aggregated data structure
    console.log('[InsightGenerator] Aggregated data keys:', Object.keys(aggregatedData || {}));

    // Build appropriate prompt based on insight type
    let prompt;

    switch (insightType) {
      case 'daily':
        prompt = PromptBuilder.buildDailyPrompt(aggregatedData);
        break;

      case 'weekly':
        prompt = PromptBuilder.buildWeeklyPrompt(aggregatedData);
        break;

      case 'monthly':
        prompt = PromptBuilder.buildMonthlyPrompt(aggregatedData);
        break;

      default:
        if (insightType.startsWith('activity_')) {
          prompt = PromptBuilder.buildActivityPrompt(aggregatedData, activityType);
        } else {
          throw new Error(`Unknown insight type: ${insightType}`);
        }
    }

    console.log('[InsightGenerator] Calling OpenAI service...');
    console.log('[InsightGenerator] Prompt preview:', prompt.substring(0, 200));

    // Generate insight using OpenAI
    const insightText = await OpenAIService.generateInsight(prompt);

    console.log('[InsightGenerator] OpenAI generation successful');

    return insightText;

  } catch (error) {
    console.error('[InsightGenerator] Error generating insight text:', error);
    console.error('[InsightGenerator] Error message:', error.message);
    console.error('[InsightGenerator] Error code:', error.code || 'N/A');

    // ✅ ENHANCED: Log more details for debugging
    console.log('[InsightGenerator] Insight type:', insightType);
    console.log('[InsightGenerator] Aggregated data keys:', Object.keys(aggregatedData || {}));

    // ✅ FIXED: Use correct property names from DataAggregator
    if (aggregatedData && typeof aggregatedData === 'object') {
      const { totalSessions, totalHours } = aggregatedData;

      if (totalSessions !== undefined && totalSessions > 0) {
        console.log(`[InsightGenerator] Using fallback: ${totalSessions} sessions, ${totalHours}h`);

        const hoursText = totalHours ? totalHours.toFixed(1) : '0.0';
        return `• This period, you completed ${totalSessions} focus session${totalSessions === 1 ? '' : 's'} totaling ${hoursText} hours.\n• Keep showing up — consistency compounds faster than intensity.`;
      }
    }

    // Last resort fallback
    console.error('[InsightGenerator] Could not extract stats, using generic message');
    return `• This week, you showed up for your focus practice.\n• Keep logging sessions — the more data you add, the sharper your insights get.`;
  }
}

/**
 * Generate the structured {insight, evidence, category, confidence} JSON
 * for the 30-day behavioral insight card.
 * @private
 */
async _generateBehavioralInsightText(aggregatedData) {
  const { totalSessions, totalHours, ratedSessionCount } = aggregatedData;

  // Pre-flight: skip the API call entirely when there isn't enough rated
  // data to support a real comparison — cheaper and more honest than
  // asking the model to find a pattern in noise.
  if (!ratedSessionCount || ratedSessionCount < MIN_RATED_SESSIONS_FOR_AI) {
    console.log(`[InsightGenerator] Only ${ratedSessionCount || 0} rated sessions — skipping AI call, returning insufficient_data`);
    return JSON.stringify({
      insight: totalSessions > 0
        ? "Not enough rated sessions yet to identify a clear pattern."
        : "No focus sessions recorded in the last 30 days yet.",
      evidence: totalSessions > 0
        ? `${totalSessions} session${totalSessions === 1 ? '' : 's'} logged (${totalHours.toFixed(1)}h total), but only ${ratedSessionCount || 0} include a focus rating.`
        : 'Start a session and rate your focus afterward to unlock personalized insights.',
      category: 'insufficient_data',
      confidence: 'low',
    });
  }

  try {
    const prompt = PromptBuilder.buildBehavioralPrompt(aggregatedData);
    console.log('[InsightGenerator] Calling OpenAI service (behavioral_30d, json_object)...');

    const raw = await OpenAIService.generateInsight(prompt, {
      systemPrompt: BEHAVIORAL_SYSTEM_PROMPT,
      responseFormat: 'json_object',
      maxTokens: 400,
      temperature: 0.5,
    });

    const parsed = JSON.parse(raw);
    if (!parsed.insight || !parsed.evidence || !parsed.category) {
      throw new Error('Model response missing required fields');
    }

    console.log('[InsightGenerator] Behavioral insight generated:', parsed.category, parsed.confidence);
    return JSON.stringify(parsed);

  } catch (error) {
    console.error('[InsightGenerator] Error generating behavioral insight:', error.message);
    return JSON.stringify({
      insight: `You completed ${totalSessions} session${totalSessions === 1 ? '' : 's'} over the last 30 days.`,
      evidence: `Totaling ${totalHours.toFixed(1)} hours, with ${ratedSessionCount} sessions rated.`,
      category: 'insufficient_data',
      confidence: 'low',
    });
  }
}

  /**
   * Generate fallback insight for empty data
   * @private
   */
  _generateEmptyInsight(insightType, timePeriod) {
    return {
      success: true,
      insightText: `No focus sessions recorded during ${timePeriod.label}. Start a session to see personalized insights!`,
      metadata: {
        insightType,
        timePeriod,
        isEmpty: true,
        generatedAt: Date.now(),
        fromCache: false,
      },
    };
  }

  /**
   * Format cached insight for consistent return structure
   * @private
   */
  _formatCachedInsight(cachedInsight) {
    return {
      success: true,
      insightText: cachedInsight.insight_text,
      metadata: {
        insightType: cachedInsight.insight_type,
        generatedAt: cachedInsight.generated_at,
        timePeriod: {
          start: cachedInsight.time_period_start,
          end: cachedInsight.time_period_end,
        },
        fromCache: true,
      },
    };
  }
}

export default new InsightGenerator();