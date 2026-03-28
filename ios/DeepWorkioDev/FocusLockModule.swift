import Foundation
import FamilyControls
import ManagedSettings
import SwiftUI

// MARK: - Dismissal-aware hosting controller
private class PickerHostingController<Content: View>: UIHostingController<Content> {
  var onDismiss: (() -> Void)?

  override func viewDidDisappear(_ animated: Bool) {
    super.viewDidDisappear(animated)
    onDismiss?()
  }
}

// MARK: - FocusLockModule
@objc(FocusLockModule)
@available(iOS 16.0, *)
class FocusLockModule: NSObject {

  private let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("deepwork.focuslock"))
  private var activitySelection = FamilyActivitySelection()
  private let selectionKey      = "focusLock_activitySelection"
  private let isBlockingKey     = "focusLock_isBlocking"

  override init() {
    super.init()
    loadPersistedSelection()
    restoreBlockingStateIfNeeded()
    // Session 8: On every launch, audit and self-heal state.
    // Catches the case where UserDefaults and OS shield state diverged
    // (e.g. authorization was revoked while the app was killed).
    auditAndHealState()
  }

  // MARK: - Initialization

  @objc
  func initialize(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let authStatus = currentAuthStatusString()
    // Session 8: If auth was revoked, ensure shields are cleared
    // so we don't report isBlocking: true with no enforcement capability.
    if authStatus == "denied" || authStatus == "notDetermined" {
      healRevokedAuthState()
    }

    resolve([
      "authorizationStatus": authStatus,
      "selection":           selectionSummary(),
      "blocking":            blockingStatus(),
    ])
  }

  // MARK: - Authorization

  @objc
  func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      do {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        DispatchQueue.main.async { resolve("authorized") }
      } catch {
        DispatchQueue.main.async {
          reject("AUTH_ERROR", error.localizedDescription, error)
        }
      }
    }
  }

  @objc
  func getAuthorizationStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(currentAuthStatusString())
  }

  // MARK: - App Selection

  @objc
  func selectAppsToBlock(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // Session 8: Guard — require authorization before showing picker.
    // Presenting the picker without authorization crashes on some iOS versions.
    guard AuthorizationCenter.shared.authorizationStatus == .approved else {
      reject("NOT_AUTHORIZED", "Screen Time authorization required before selecting apps.", nil)
      return
    }

    DispatchQueue.main.async {
      guard let rootVC = self.topViewController() else {
        reject("NO_ROOT_VC", "Could not find root view controller", nil)
        return
      }

      let pickerView = FamilyActivityPicker(
        selection: Binding(
          get: { self.activitySelection },
          set: { newSelection in self.activitySelection = newSelection }
        )
      )

      let hostingVC = PickerHostingController(rootView: pickerView)
      hostingVC.modalPresentationStyle = .formSheet
      hostingVC.onDismiss = {
        self.persistSelection()
        if UserDefaults.standard.bool(forKey: self.isBlockingKey) {
          self.applyShields()
        }
        resolve(self.selectionSummary())
      }

      rootVC.present(hostingVC, animated: true)
    }
  }

  @objc
  func getSelectionCount(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(selectionSummary())
  }

  @objc
  func clearSelection(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    removeShields()
    activitySelection = FamilyActivitySelection()
    UserDefaults.standard.removeObject(forKey: selectionKey)
    UserDefaults.standard.set(false, forKey: isBlockingKey)
    resolve(selectionSummary())
  }

  // MARK: - Blocking

  @objc
  func startBlocking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // Session 8: Verify authorization is still valid before applying shields.
    // User could have revoked between app launches.
    guard AuthorizationCenter.shared.authorizationStatus == .approved else {
      healRevokedAuthState()
      reject("NOT_AUTHORIZED", "Screen Time authorization was revoked. Please re-authorize in Settings.", nil)
      return
    }

    guard !activitySelection.applicationTokens.isEmpty
       || !activitySelection.categoryTokens.isEmpty
       || !activitySelection.webDomainTokens.isEmpty
    else {
      reject("NO_SELECTION", "No apps selected to block. Call selectAppsToBlock first.", nil)
      return
    }

    applyShields()
    UserDefaults.standard.set(true, forKey: isBlockingKey)
    resolve(blockingStatus())
  }

  @objc
  func stopBlocking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    removeShields()
    UserDefaults.standard.set(false, forKey: isBlockingKey)
    resolve(blockingStatus())
  }

  @objc
  func getBlockingStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(blockingStatus())
  }

  // MARK: - Session 8: Force Stop (Emergency Recovery)

  /// Nuclear option: clears all shields AND resets all persisted state.
  /// Call this when the user reports apps are stuck blocked, or when
  /// state is known to be corrupted (e.g. after authorization revocation
  /// detected mid-session).
  ///
  /// Safe to call at any time — idempotent, never throws.
  @objc
  func forceStopBlocking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // Clear OS-level shields
    removeShields()

    // Reset all UserDefaults state
    UserDefaults.standard.set(false, forKey: isBlockingKey)
    UserDefaults.standard.removeObject(forKey: selectionKey)

    // Reset in-memory selection so subsequent calls start clean
    activitySelection = FamilyActivitySelection()

    resolve([
      "success": true,
      "message": "Force stop complete. All shields removed and state reset.",
      "blocking": blockingStatus(),
      "selection": selectionSummary(),
    ])
  }

  // MARK: - Session 8: Private recovery helpers

  /// Called on init. Detects and heals diverged state before any
  /// JS interaction happens. Covers the auth-revoked-while-killed scenario.
  private func auditAndHealState() {
    let authStatus = AuthorizationCenter.shared.authorizationStatus
    let userDefaultsSaysBlocking = UserDefaults.standard.bool(forKey: isBlockingKey)

    // If we think we're blocking but auth was revoked, clear everything.
    // ManagedSettingsStore shields are automatically removed by iOS when
    // authorization is revoked, so we just need to sync our state.
    if userDefaultsSaysBlocking && authStatus != .approved {
      healRevokedAuthState()
    }
  }

  /// Clears shield state without touching the stored app selection.
  /// Call when authorization is revoked — user's app list is preserved
  /// so they don't have to re-select after re-authorizing.
  private func healRevokedAuthState() {
    store.shield.applications = nil
    store.shield.applicationCategories = nil
    store.shield.webDomains = nil
    UserDefaults.standard.set(false, forKey: isBlockingKey)
  }

  private func restoreBlockingStateIfNeeded() {
    guard UserDefaults.standard.bool(forKey: isBlockingKey) else { return }
    applyShields()
  }

  private func applyShields() {
    if !activitySelection.applicationTokens.isEmpty {
      store.shield.applications = activitySelection.applicationTokens
    }
    if !activitySelection.categoryTokens.isEmpty {
      store.shield.applicationCategories = .specific(activitySelection.categoryTokens)
    }
    if !activitySelection.webDomainTokens.isEmpty {
      store.shield.webDomains = activitySelection.webDomainTokens
    }
  }

  private func removeShields() {
    store.shield.applications = nil
    store.shield.applicationCategories = nil
    store.shield.webDomains = nil
  }

  private func currentAuthStatusString() -> String {
    switch AuthorizationCenter.shared.authorizationStatus {
    case .approved:      return "approved"
    case .denied:        return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default:    return "unknown"
    }
  }

  private func blockingStatus() -> [String: Any] {
    return [
      "isBlocking":             UserDefaults.standard.bool(forKey: isBlockingKey),
      "shieldedAppCount":       activitySelection.applicationTokens.count,
      "shieldedCategoryCount":  activitySelection.categoryTokens.count,
      "shieldedWebDomainCount": activitySelection.webDomainTokens.count,
    ]
  }

  private func selectionSummary() -> [String: Int] {
    return [
      "appTokenCount":       activitySelection.applicationTokens.count,
      "categoryTokenCount":  activitySelection.categoryTokens.count,
      "webDomainTokenCount": activitySelection.webDomainTokens.count,
      "totalCount":          activitySelection.applicationTokens.count
                           + activitySelection.categoryTokens.count
                           + activitySelection.webDomainTokens.count
    ]
  }

  private func persistSelection() {
    guard let data = try? JSONEncoder().encode(activitySelection) else { return }
    UserDefaults.standard.set(data, forKey: selectionKey)
  }

  private func loadPersistedSelection() {
    guard
      let data = UserDefaults.standard.data(forKey: selectionKey),
      let saved = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else { return }
    activitySelection = saved
  }

  private func topViewController() -> UIViewController? {
    guard let root = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .flatMap({ $0.windows })
      .first(where: { $0.isKeyWindow })?.rootViewController
    else { return nil }

    var top = root
    while let presented = top.presentedViewController {
      top = presented
    }
    return top
  }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}