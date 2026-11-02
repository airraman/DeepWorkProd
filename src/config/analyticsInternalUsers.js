// src/config/analyticsInternalUsers.js
//
// Firebase Auth uids of team and test accounts. Signing in with one of these
// sets the GA4 user property internal_user = 'true' on that device, so the
// account can be excluded from product reporting (see analyticsEvents.js and
// RELEASE_RUNBOOK.md). Dev builds and the .dev app are always internal, so
// only production-build accounts need to be listed here.
//
// Uids are pseudonymous identifiers, not credentials. Never add emails,
// names or anything else personal.

export const INTERNAL_UIDS = [
  // 'firebase-auth-uid',
];
