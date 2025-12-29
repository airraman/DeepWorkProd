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
          console.log(`[InsightGenerator] Cache hit for ${insightType}`);
          return this._formatCachedInsight(cachedInsight);
        }
      }

      console.log('[InsightGenerator] Cache miss or force regenerate - generating new insight');

      // Step 6: Aggregate data (reduce tokens from ~1250 to ~200)
      const aggregatedData = this.aggregator.aggregateSessions(
        filteredSessions,
        { timePeriod }
      );

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
      const cachedInsightId = await this.cacheRepo.upsert({
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
    console.error('[InsightGenerator] Error stack:', error.stack);
    console.log('[InsightGenerator] Using fallback insight');
    
    // DEFENSIVE FALLBACK - Extract data from ANY possible structure
    let totalSessions = 0;
    let totalMinutes = 0;
    
    // Try multiple possible structures
    if (aggregatedData?.summary) {
      totalSessions = aggregatedData.summary.totalSessions || 0;
      totalMinutes = aggregatedData.summary.totalMinutes || 0;
    } else if (aggregatedData?.totals) {
      totalSessions = aggregatedData.totals.sessions || 0;
      totalMinutes = aggregatedData.totals.minutes || 0;
    } else if (aggregatedData?.sessionCount !== undefined) {
      totalSessions = aggregatedData.sessionCount;
      totalMinutes = aggregatedData.totalDuration || 0;
    } else {
      // Last resort: log what we got and use generic message
      console.error('[InsightGenerator] Could not extract stats from aggregatedData:', 
        JSON.stringify(aggregatedData, null, 2).substring(0, 500));
      
      return `Keep up the great work on your focus sessions! Your consistent effort is building strong deep work habits.`;
    }
    
    // Convert minutes to hours
    const totalHours = (totalMinutes / 60).toFixed(1);
    
    console.log(`[InsightGenerator] Fallback stats: ${totalSessions} sessions, ${totalMinutes} minutes (${totalHours}h)`);
    
    if (totalSessions > 0) {
      return `You completed ${totalSessions} focus sessions totaling ${totalHours} hours. Keep up the great work building your deep work habit!`;
    } else {
      return `Keep building your deep work habit! Consistent focus sessions lead to remarkable productivity gains.`;
    }
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