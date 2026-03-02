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
class FocusLockModule: NSObject {

  private let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("deepwork.focuslock"))
  private var activitySelection = FamilyActivitySelection()
  private let selectionKey   = "focusLock_activitySelection"
  private let isBlockingKey  = "focusLock_isBlocking"

  override init() {
    super.init()
    loadPersistedSelection()
    // Advanced: If the app was killed while blocking, the OS-level shields
    // from ManagedSettingsStore persist automatically. However we defensively
    // re-apply them here so our in-memory store instance is always in sync
    // with what UserDefaults says should be active.
    restoreBlockingStateIfNeeded()
  }

  // MARK: - Session 4: Initialization

  /// Returns full Focus Lock state in a single call.
  /// Use this on app launch instead of three separate calls —
  /// reduces bridge overhead and ensures atomic state snapshot.
  @objc
  func initialize(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let authStatus: String
    switch AuthorizationCenter.shared.authorizationStatus {
    case .approved:      authStatus = "approved"
    case .denied:        authStatus = "denied"
    case .notDetermined: authStatus = "notDetermined"
    @unknown default:    authStatus = "unknown"
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
    let status = AuthorizationCenter.shared.authorizationStatus
    switch status {
    case .approved:      resolve("approved")
    case .denied:        resolve("denied")
    case .notDetermined: resolve("notDetermined")
    @unknown default:    resolve("unknown")
    }
  }

  // MARK: - App Selection

  @objc
  func selectAppsToBlock(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
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
        // If blocking is active, update shields to reflect new selection
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

  // MARK: - Private helpers

  private func applyShields() {
    if !activitySelection.applicationTokens.isEmpty {
      store.shield.applications = activitySelection.applicationTokens
    }
    if !activitySelection.categoryTokens.isEmpty {
      store.shield.applicationCategories = .specific(activitySelection.categoryTokens)
    }
    if !activitySelection.webDomainTokens.isEmpty {
      store.shield.webDomains = .specific(activitySelection.webDomainTokens)
    }
  }

  private func removeShields() {
    store.shield.applications = nil
    store.shield.applicationCategories = nil
    store.shield.webDomains = nil
  }

  // Advanced: Called on init. If UserDefaults says we were blocking when
  // the app was last killed, re-apply shields to this store instance.
  // ManagedSettingsStore is OS-persisted so the user is still blocked —
  // this just ensures our in-memory instance matches that state so
  // subsequent calls to startBlocking/stopBlocking behave correctly.
  private func restoreBlockingStateIfNeeded() {
    guard UserDefaults.standard.bool(forKey: isBlockingKey) else { return }
    applyShields()
  }

  private func blockingStatus() -> [String: Any] {
    return [
      "isBlocking":            UserDefaults.standard.bool(forKey: isBlockingKey),
      "shieldedAppCount":      activitySelection.applicationTokens.count,
      "shieldedCategoryCount": activitySelection.categoryTokens.count,
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