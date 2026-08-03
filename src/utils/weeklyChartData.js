// weeklyChartData.js — shared calculation for the last-7-days activity chart.
// Used by both the in-page MetricsScreen chart and the Insights bottom sheet
// weekly overview so both renderers stay in sync with one calculation.

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// `sessions` is the date-keyed object shape returned by deepWorkStore.getSessions()
// (e.g. { '2026-08-02': [session, ...] }).
export function generateWeeklyChartData(sessions) {
  const today = new Date();
  const weekData = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateString = date.toISOString().split('T')[0];

    const daySessions = sessions[dateString] || [];
    const totalMinutes = daySessions.reduce((sum, session) => sum + session.duration, 0);
    const totalHours = parseFloat((totalMinutes / 60).toFixed(1));

    weekData.push({
      day: DAY_NAMES[date.getDay()],
      fullDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      hours: totalHours,
      date: dateString,
      sessionsCount: daySessions.length,
    });
  }

  return weekData;
}
