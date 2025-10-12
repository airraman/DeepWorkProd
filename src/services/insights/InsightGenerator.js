// src/services/insights/InsightGenerator.js

import SessionRepository from '../database/SessionRepository';
import InsightCacheRepository from '../database/InsightCacheRepository';
import DataAggregator from './DataAggregator';
import { CacheManager } from './CacheManager';
import { generateDataHash } from '../../utils/hashHelper';
import { 
  getStartOfDay, 
  getStartOfWeek, 
  getStartOfMonth,
  getDateDaysAgo 
} from '../../utils/dateHelpers';
// Session 4: Add OpenAI imports
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

      // Step 1: Calculate time period
      const timePeriod = this._getTimePeriod(insightType, referenceDate, activityType);

      // Step 2: Load sessions for this time period
      const sessions = await this.sessionRepo.getSessionsByDateRange(
        timePeriod.start,
        timePeriod.end
      );

      // Handle empty data case
      if (sessions.length === 0) {
        return this._generateEmptyInsight(insightType, timePeriod);
      }

      // Step 3: Filter by activity if needed
      const filteredSessions = activityType
        ? sessions.filter(s => s.activity_type === activityType)
        : sessions;

      if (filteredSessions.length === 0) {
        return this._generateEmptyInsight(insightType, timePeriod);
      }

      // Step 4: Generate hash of current data
      const currentDataHash = generateDataHash(filteredSessions);

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

      // Step 6: Aggregate data (reduce tokens from ~1250 to ~200)
      const aggregatedData = this.aggregator.aggregateSessions(
        filteredSessions,
        { timePeriod }
      );

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

      // Generate insight using OpenAI
      const insightText = await OpenAIService.generateInsight(prompt);
      
      return insightText;

    } catch (error) {
      console.error('[InsightGenerator] Error generating insight:', error);
      
      // Return fallback instead of crashing
      const { summary } = aggregatedData;
      const totalSessions = summary?.totalSessions || 0;
      const totalHours = summary?.totalHours || 0;
      
      return `You completed ${totalSessions} focus sessions totaling ${totalHours.toFixed(1)} hours. Keep up the great work building your deep work habit!`;
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