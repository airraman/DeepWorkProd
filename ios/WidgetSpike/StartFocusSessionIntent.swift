import AppIntents
import Foundation

// SPIKE / REFERENCE ONLY — not added to any Xcode target.
//
// Sketches the AppIntent a Home Screen widget's FOCUS button would invoke.
// This file demonstrates the pattern, not production code: real error
// handling, localized strings, and the actual "last used session config"
// bridging (owned by sessionStateService.js today, would need to be
// mirrored into the App Group by the RN app on every session-config change)
// are intentionally left as TODOs.

@available(iOS 17.0, *)
struct StartFocusSessionIntent: AppIntent {
  static var title: LocalizedStringResource = "Start Focus Session"

  // The critical line for the zero-tap requirement: by leaving this false
  // (the default), perform() runs in the widget extension's process without
  // launching/foregrounding the containing app. Focus Lock engages
  // synchronously here, independent of whether the RN app is running,
  // backgrounded, or terminated.
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    let focusLock = FocusLockCore()
    let didLock = focusLock.startBlocking()

    // Durable handoff record for the RN app to consume whenever it next
    // becomes ready (foreground now, or cold-launched later). Written to
    // the App Group so it survives the widget process's own short lifetime
    // and is visible to the main app regardless of its current state.
    if let defaults = UserDefaults(suiteName: FocusLockCore.appGroupID) {
      defaults.set(true, forKey: "pendingSessionStart")
      defaults.set(Date().timeIntervalSince1970, forKey: "pendingSessionStartRequestedAt")
      defaults.set(didLock, forKey: "pendingSessionStartFocusLockApplied")
    }

    // TODO (Phase 3+): if didLock == false (no authorization or no
    // selection yet), this intent should still be able to signal the RN
    // app to open to onboarding rather than silently doing nothing —
    // likely via the same pendingSessionStart record plus a reason code.

    return .result()
  }
}
