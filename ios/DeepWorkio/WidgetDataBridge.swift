//
//  WidgetDataBridge.swift
//  DeepWorkio
//
//  Write side of the widget's shared-data contract, plus the RN-facing side
//  of the widget-triggered session-start handoff.
//
//  Two independent App Group keys, two independent concerns:
//   - widgetSharedState: app -> widget (read side: DeepWorkWidget.swift's
//     WidgetSharedStore).
//   - @widget_pending_session_start: widget -> app (write side:
//     WidgetHandoffStore + StartFocusSessionIntent in DeepWorkWidget.swift).
//     This bridge only exposes get/clear for that key — it never writes it;
//     the widget extension is the only writer.
//
//  This bridge stays a dumb pipe for both: it does not validate business
//  logic (expiration, active-session conflicts, config resolution) — that
//  all lives in the RN-side widgetHandoffService.js, per the constraint that
//  the native layer must not duplicate session-start business logic.

import Foundation
import WidgetKit
import React

@objc(WidgetDataBridge)
class WidgetDataBridge: NSObject {

  private static let appGroupID = "group.com.airraman.deepwork"
  private static let stateKey = "widgetSharedState"
  // Must match WidgetHandoffStore.pendingKey in DeepWorkWidget.swift exactly
  // — the two targets don't share a framework, so this key is the contract.
  private static let pendingSessionStartKey = "@widget_pending_session_start"

  @objc
  func setSharedState(
    _ jsonString: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: WidgetDataBridge.appGroupID) else {
      reject("NO_APP_GROUP", "Could not open App Group UserDefaults suite", nil)
      return
    }

    guard let data = jsonString.data(using: .utf8) else {
      reject("INVALID_JSON", "jsonString could not be encoded as UTF-8", nil)
      return
    }

    defaults.set(data, forKey: WidgetDataBridge.stateKey)

    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }

    resolve(true)
  }

  /// Returns the pending session-start request as a plain JS object (parsed
  /// JSON), or null if none exists or it can't be parsed. Does NOT clear it
  /// — callers must call clearPendingSessionStart() explicitly once they've
  /// finished processing it. Never rejects — a missing/malformed record is
  /// reported as null, not an error, since "nothing pending" is a normal
  /// outcome, not a failure.
  @objc
  func getPendingSessionStart(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard
      let defaults = UserDefaults(suiteName: WidgetDataBridge.appGroupID),
      let data = defaults.data(forKey: WidgetDataBridge.pendingSessionStartKey),
      let json = try? JSONSerialization.jsonObject(with: data, options: [])
    else {
      NSLog("[WidgetHandoff] getPendingSessionStart: nothing pending (App Group=\(WidgetDataBridge.appGroupID))")
      resolve(NSNull())
      return
    }
    NSLog("[WidgetHandoff] getPendingSessionStart: found pending record: \(json)")
    resolve(json)
  }

  /// Clears the pending session-start request. Safe/idempotent to call even
  /// when nothing is pending.
  @objc
  func clearPendingSessionStart(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if let defaults = UserDefaults(suiteName: WidgetDataBridge.appGroupID) {
      defaults.removeObject(forKey: WidgetDataBridge.pendingSessionStartKey)
    }
    resolve(true)
  }

  // App-side mirrors of the types declared in DeepWorkWidget.swift
  // (WidgetSharedState/DefaultSessionConfig/PendingSessionStartRequest) —
  // that file belongs only to the DeepWorkWidgetExtension target and the
  // two targets share no framework, so these structs cannot reference it
  // directly. They exist solely to decode/encode the same JSON contract;
  // they do not define a new one. Only the field this bridge needs
  // (defaultSessionConfig) is modeled — the rest of the shared-state shape
  // is irrelevant here and is intentionally left undecoded.
  private struct AppSideDefaultSessionConfig: Codable {
    var activity: String?
    var durationMinutes: Double?
    var musicChoice: String?
    var focusLockEnabled: Bool?
  }

  private struct AppSideWidgetSharedState: Codable {
    var defaultSessionConfig: AppSideDefaultSessionConfig?
  }

  // Mirrors PendingSessionStartRequest in DeepWorkWidget.swift exactly —
  // field names, optionality, and the ms-epoch Double for createdAt.
  private struct AppSidePendingSessionStartRequest: Codable {
    var requestId: String
    var createdAt: Double
    var activity: String?
    var durationMinutes: Double?
    var musicChoice: String?
    var focusLockEnabled: Bool?
  }

  /// App-side equivalent of StartFocusSessionIntent's App Group write —
  /// used by the lucid://start-focus deep-link path, which runs in the app
  /// process rather than the widget extension. Produces the exact same
  /// pending-request JSON shape the widget extension writes, sourced from
  /// the same cached defaultSessionConfig the widget itself reads.
  @objc
  func createPendingSessionStart(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: WidgetDataBridge.appGroupID) else {
      reject("NO_APP_GROUP", "Could not open App Group UserDefaults suite", nil)
      return
    }

    // Missing shared state (fresh install, never synced) means there's no
    // defaultSessionConfig to source a request from — writing a request
    // with everything nil would leave the JS-side handoff no better off
    // than not writing one at all, so this fails clearly rather than
    // reporting success for a no-op.
    guard let stateData = defaults.data(forKey: WidgetDataBridge.stateKey) else {
      reject("NO_SHARED_STATE", "No widgetSharedState found in App Group", nil)
      return
    }

    let state: AppSideWidgetSharedState
    do {
      state = try JSONDecoder().decode(AppSideWidgetSharedState.self, from: stateData)
    } catch {
      reject("DECODE_FAILED", "Could not decode widgetSharedState: \(error.localizedDescription)", error)
      return
    }

    let request = AppSidePendingSessionStartRequest(
      requestId: UUID().uuidString,
      createdAt: Date().timeIntervalSince1970 * 1000,
      activity: state.defaultSessionConfig?.activity,
      durationMinutes: state.defaultSessionConfig?.durationMinutes,
      musicChoice: state.defaultSessionConfig?.musicChoice,
      focusLockEnabled: state.defaultSessionConfig?.focusLockEnabled
    )

    guard let requestData = try? JSONEncoder().encode(request) else {
      reject("ENCODE_FAILED", "Could not encode pending session-start request", nil)
      return
    }

    defaults.set(requestData, forKey: WidgetDataBridge.pendingSessionStartKey)
    resolve(true)
  }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
