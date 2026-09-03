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

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
