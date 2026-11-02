// activityNames.js — pure helper shared by SessionRepository and tests.
/**
 * Display name for a session's activity. Sessions store only the activity
 * id; names live in local settings. Ids created in Settings are slugs of the
 * name ('deep-work'), so an unmatched slug is turned back into readable text.
 * Unmatched numeric ids (onboarding's '1', '2') carry no name — return null
 * rather than surfacing a meaningless label.
 */
export function resolveActivityName(activityId, activities) {
  if (typeof activityId !== 'string' || !activityId) return null;
  const match = (activities || []).find(a => a.id === activityId);
  if (match?.name) return match.name;
  if (/^\d+$/.test(activityId)) return null;
  const text = activityId.replace(/-/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
}
