import Foundation
import FamilyControls
import ManagedSettings

// SPIKE / REFERENCE ONLY — not added to any Xcode target.
//
// This is the subset of FocusLockModule.swift's logic that has no
// dependency on React/RCT. It is proposed groundwork for a refactor,
// not a parallel implementation: FocusLockModule.swift would come to
// wrap this instead of talking to ManagedSettingsStore/UserDefaults
// directly, so the app target and a future widget extension target
// share the exact same Focus Lock behavior from one source file
// (added to both targets in Xcode, compiled twice, zero divergence).
//
// The one behavior change from FocusLockModule.swift as it exists today:
// persistence moves from UserDefaults.standard (app-container only, current
// production code) to UserDefaults(suiteName: appGroupID) (shared with any
// extension in the same App Group). That migration is required — a widget
// extension process cannot read UserDefaults.standard written by the main
// app process; they are different sandboxes.

@available(iOS 16.0, *)
struct FocusLockCore {
  static let appGroupID = "group.com.airraman.deepwork" // placeholder — confirm before real use

  private let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("deepwork.focuslock"))
  private let defaults = UserDefaults(suiteName: FocusLockCore.appGroupID) ?? .standard
  private let selectionKey = "focusLock_activitySelection"
  private let isBlockingKey = "focusLock_isBlocking"

  /// Read-only. A widget/App Intent process must NOT call
  /// requestAuthorization() — that requires foreground UI and is the main
  /// app's job during onboarding. The intent only ever checks status.
  var authorizationStatus: AuthorizationStatus {
    AuthorizationCenter.shared.authorizationStatus
  }

  var hasSelection: Bool {
    loadPersistedSelection() != nil
  }

  /// Applies the shield using whatever selection the main app most recently
  /// persisted. Returns false (no-op) rather than throwing if prerequisites
  /// aren't met — an App Intent's perform() should degrade gracefully, not
  /// crash the widget process.
  @discardableResult
  func startBlocking() -> Bool {
    guard authorizationStatus == .approved else { return false }
    guard let selection = loadPersistedSelection() else { return false }

    let hasAnySelection = !selection.applicationTokens.isEmpty
      || !selection.categoryTokens.isEmpty
      || !selection.webDomainTokens.isEmpty
    guard hasAnySelection else { return false }

    if !selection.applicationTokens.isEmpty {
      store.shield.applications = selection.applicationTokens
    }
    if !selection.categoryTokens.isEmpty {
      store.shield.applicationCategories = .specific(selection.categoryTokens)
    }
    if !selection.webDomainTokens.isEmpty {
      store.shield.webDomains = selection.webDomainTokens
    }

    defaults.set(true, forKey: isBlockingKey)
    return true
  }

  private func loadPersistedSelection() -> FamilyActivitySelection? {
    guard
      let data = defaults.data(forKey: selectionKey),
      let saved = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else { return nil }
    return saved
  }
}
