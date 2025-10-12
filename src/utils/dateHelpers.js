// dateHelpers.js - Time period calculations

/**
 * Get start of day (midnight) for a given timestamp
 */
export function getStartOfDay(timestamp = Date.now()) {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }
  
  /**
   * Get start of week (Monday at midnight)
   */
  export function getStartOfWeek(timestamp = Date.now()) {
    const date = new Date(timestamp);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }
  
  /**
   * Get start of month (1st day at midnight)
   */
  export function getStartOfMonth(timestamp = Date.now()) {
    const date = new Date(timestamp);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }
  
  /**
   * Get start of year (Jan 1st at midnight)
   */
  export function getStartOfYear(timestamp = Date.now()) {
    const date = new Date(timestamp);
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  /**
 * Get a date X days ago from now
 * @param {number} daysAgo - Number of days to go back
 * @returns {Date} - Date object X days ago
 */
export function getDateDaysAgo(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }
  
  /**
   * Get date range for a specific period
   * @param {string} period - 'day', 'week', 'month', 'year'
   * @param {number} timestamp - Reference timestamp (defaults to now)
   * @returns {{ start: number, end: number }}
   */
  export function getDateRangeForPeriod(period, timestamp = Date.now()) {
    const end = timestamp;
    let start;
    
    switch (period) {
      case 'day':
        start = getStartOfDay(timestamp);
        break;
      case 'week':
        start = getStartOfWeek(timestamp);
        break;
      case 'month':
        start = getStartOfMonth(timestamp);
        break;
      case 'year':
        start = getStartOfYear(timestamp);
        break;
      default:
        throw new Error(`Invalid period: ${period}. Use 'day', 'week', 'month', or 'year'`);
    }
    
    return { start, end };
  }
  
  /**
   * Get previous period's date range
   * Used for comparing trends (e.g., "this week vs last week")
   */
  export function getPreviousPeriodRange(period, timestamp = Date.now()) {
    const current = getDateRangeForPeriod(period, timestamp);
    const duration = current.end - current.start;
    
    return {
      start: current.start - duration,
      end: current.start
    };
  }
  
  /**
   * Format timestamp to readable date string
   */
  export function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  /**
   * Convert seconds to hours (rounded to 1 decimal)
   */
  export function secondsToHours(seconds) {
    return Math.round((seconds / 3600) * 10) / 10;
  }
  
  /**
   * Convert seconds to minutes
   */
  export function secondsToMinutes(seconds) {
    return Math.round(seconds / 60);
  }