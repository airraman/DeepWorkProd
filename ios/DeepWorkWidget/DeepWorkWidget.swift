//
//  DeepWorkWidget.swift
//  DeepWorkWidget
//
//  Reads the shared session-state contract from the App Group and renders
//  the real 7-day activity visualization. Never depends on the RN JS
//  runtime being alive — every read is crash-safe with a defined fallback.
//

import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Shared data contract
//
// Mirrors the JSON written by the RN app (via widgetSyncService.js ->
// widgetDataBridge.js -> WidgetDataBridge.swift in the main app target).
// The JSON shape itself is the source of truth, not this struct — this
// struct is redeclared here for compile-time decoding safety only.
// AsyncStorage/Firestore remain the actual session-history source of truth
// on the RN side; this struct never stores anything beyond one JSON blob's
// worth of already-computed, derived values.
struct WidgetSharedState: Codable {
    var sessionsCompletedToday: Int
    var weeklyActivity: [DayActivity]
    var activeSession: ActiveSessionState?
    var lastCompletedSession: LastSessionSummary?
    var defaultSessionConfig: DefaultSessionConfig?
    var updatedAt: Double // ms epoch

    static let empty = WidgetSharedState(
        sessionsCompletedToday: 0,
        weeklyActivity: [],
        activeSession: nil,
        lastCompletedSession: nil,
        defaultSessionConfig: nil,
        updatedAt: 0
    )
}

struct DayActivity: Codable {
    var date: String // 'YYYY-MM-DD'
    var sessionsCount: Int
    var isToday: Bool
}

struct ActiveSessionState: Codable {
    var isActive: Bool
    var startTime: Double?
    var endTime: Double?
    var durationMinutes: Double?
}

struct LastSessionSummary: Codable {
    var activity: String?
    var durationMinutes: Double?
    var completedAt: Double?
}

struct DefaultSessionConfig: Codable {
    var activity: String?
    var durationMinutes: Double?
    var musicChoice: String?
    var focusLockEnabled: Bool?
}

// MARK: - Shared-store access

enum WidgetSharedStore {
    static let appGroupID = "group.com.airraman.deepwork"
    static let stateKey = "widgetSharedState"

    /// Reads and decodes the shared state. Never throws, never crashes the
    /// widget process — returns .empty for a missing App Group suite, a
    /// missing key, or malformed/undecodable JSON.
    static func read() -> WidgetSharedState {
        guard let defaults = UserDefaults(suiteName: appGroupID) else {
            return .empty
        }
        guard let data = defaults.data(forKey: stateKey) else {
            return .empty
        }
        do {
            return try JSONDecoder().decode(WidgetSharedState.self, from: data)
        } catch {
            return .empty
        }
    }
}

// MARK: - Session-start handoff (widget -> app)
//
// The widget never starts a session itself — it only writes a durable
// request the RN app discovers and validates on next launch/foreground
// (see widgetHandoffService.js, which owns all the actual business logic:
// expiration, active-session conflicts, config fallback). This struct and
// store are the write side only; nothing here decides whether a session
// should actually start.

struct PendingSessionStartRequest: Codable {
    var requestId: String
    var createdAt: Double // ms epoch
    var activity: String?
    var durationMinutes: Double?
    var musicChoice: String?
    var focusLockEnabled: Bool?
}

enum WidgetHandoffStore {
    // Must match WidgetDataBridge.pendingSessionStartKey in the main app
    // target exactly — the two targets don't share a framework, so this
    // string is the contract.
    static let pendingKey = "@widget_pending_session_start"

    /// Writes a new pending session-start request, sourced from whatever
    /// defaultSessionConfig is currently cached in shared state (itself a
    /// mirror of the RN app's real last-used config — see
    /// widgetSyncService.js). The RN side re-validates/falls back on read,
    /// so a stale or missing cached config here is not fatal — it just
    /// means the RN side does more of the resolution work.
    static func writePendingRequest(from config: DefaultSessionConfig?) {
        guard let defaults = UserDefaults(suiteName: WidgetSharedStore.appGroupID) else { return }

        let request = PendingSessionStartRequest(
            requestId: UUID().uuidString,
            createdAt: Date().timeIntervalSince1970 * 1000,
            activity: config?.activity,
            durationMinutes: config?.durationMinutes,
            musicChoice: config?.musicChoice,
            focusLockEnabled: config?.focusLockEnabled
        )

        guard let data = try? JSONEncoder().encode(request) else { return }
        defaults.set(data, forKey: pendingKey)
    }
}

@available(iOS 17.0, *)
struct StartFocusSessionIntent: AppIntent {
    static var title: LocalizedStringResource = "Start Focus Session"
    // This milestone's flow requires the app itself to open (it consumes the
    // handoff and drives the existing DeepWorkSession start path) — unlike a
    // Focus-Lock-only intent, this is not meant to stay silent in-extension.
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        NSLog("[WidgetHandoff] StartFocusSessionIntent.perform() entered")
        let state = WidgetSharedStore.read()
        NSLog("[WidgetHandoff] last-session config read: activity=\(state.defaultSessionConfig?.activity ?? "nil") duration=\(String(describing: state.defaultSessionConfig?.durationMinutes)) focusLock=\(String(describing: state.defaultSessionConfig?.focusLockEnabled))")
        WidgetHandoffStore.writePendingRequest(from: state.defaultSessionConfig)
        NSLog("[WidgetHandoff] pending handoff written to App Group")
        return .result()
    }
}

// MARK: - Timeline provider

struct DeepWorkWidgetEntry: TimelineEntry {
    let date: Date
    let state: WidgetSharedState
}

struct DeepWorkWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> DeepWorkWidgetEntry {
        DeepWorkWidgetEntry(date: Date(), state: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (DeepWorkWidgetEntry) -> ()) {
        completion(DeepWorkWidgetEntry(date: Date(), state: WidgetSharedStore.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DeepWorkWidgetEntry>) -> ()) {
        let entry = DeepWorkWidgetEntry(date: Date(), state: WidgetSharedStore.read())

        // Periodic refresh as a safety net. The real-time trigger is
        // WidgetCenter.reloadAllTimelines(), called from WidgetDataBridge
        // whenever the RN app writes fresh state (session start/complete,
        // app foreground — see widgetSyncService.js).
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 15, to: entry.date) ?? entry.date
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

// MARK: - Entry view

private let dayLetters = ["S", "M", "T", "W", "T", "F", "S"]

private func dayLetter(for dateString: String) -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.timeZone = TimeZone.current
    guard let date = formatter.date(from: dateString) else { return "?" }
    let weekday = Calendar.current.component(.weekday, from: date) // 1 = Sunday
    return dayLetters[weekday - 1]
}

struct ActivityBar: View {
    let day: DayActivity
    let maxCount: Int

    private var heightFraction: CGFloat {
        guard maxCount > 0 else { return 0.08 } // flat baseline when the week has zero sessions
        return max(CGFloat(day.sessionsCount) / CGFloat(maxCount), 0.08)
    }

    var body: some View {
        VStack(spacing: 4) {
            GeometryReader { geo in
                RoundedRectangle(cornerRadius: 3)
                    .fill(day.isToday ? Color.accentColor : Color.secondary.opacity(0.35))
                    .frame(height: max(geo.size.height * heightFraction, 4))
                    .frame(maxHeight: .infinity, alignment: .bottom)
            }
            Text(dayLetter(for: day.date))
                .font(.system(size: 9, weight: day.isToday ? .bold : .regular))
                .foregroundStyle(day.isToday ? .primary : .secondary)
        }
    }
}

struct DeepWorkWidgetEntryView: View {
    var entry: DeepWorkWidgetProvider.Entry
    @Environment(\.widgetFamily) private var family

    private var maxCount: Int {
        entry.state.weeklyActivity.map(\.sessionsCount).max() ?? 0
    }

    var body: some View {
        switch family {
        case .accessoryRectangular:
            lockScreenRectangularView
        default:
            // .systemMedium — the only Home Screen family this widget
            // supports (product spec: medium only in v1). Any other family
            // falls back here rather than crashing on an unhandled case.
            mediumBody
        }
    }

    // MARK: Lock Screen (minimal — per product spec's "eventually, minimal
    // logo/control" requirement, not the full Home Screen layout)

    private var lockScreenRectangularView: some View {
        HStack(spacing: 6) {
            VStack(alignment: .leading, spacing: 0) {
                Text("\(entry.state.sessionsCompletedToday)")
                    .font(.headline)
                Text("today")
                    .font(.caption2)
            }
            Spacer()
            Image(systemName: "target")
        }
        // Lock Screen accessory widgets can't hold a Link, so the whole widget
        // opens the same lucid://start-focus flow as the Home Screen button.
        // Without a last-used config there's nothing to start: just open Lucid.
        .widgetURL(entry.state.defaultSessionConfig == nil ? nil : URL(string: "lucid://start-focus"))
    }

    // MARK: Home Screen (.systemMedium)

    private var mediumBody: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(entry.state.sessionsCompletedToday)")
                        .font(.title2)
                        .bold()
                    Text(entry.state.sessionsCompletedToday == 1 ? "session today" : "sessions today")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                if entry.state.weeklyActivity.isEmpty {
                    // No shared state yet (fresh install / not synced) — the
                    // widget still renders cleanly rather than showing blank
                    // space or a crash.
                    Text("No activity yet")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                } else {
                    HStack(alignment: .bottom, spacing: 6) {
                        ForEach(entry.state.weeklyActivity, id: \.date) { day in
                            ActivityBar(day: day, maxCount: maxCount)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack {
                Spacer()
                if entry.state.defaultSessionConfig == nil {
                    // Fresh/unconfigured install (no last-used session
                    // exists yet) — a tap here would just no-op in
                    // widgetHandoffService (no_usable_session_config), so
                    // show a plain, non-interactive hint instead of a dead
                    // button. Minimal setup guidance, not a new onboarding
                    // system.
                    Text("Open Lucid\nto get started")
                        .font(.caption2)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                } else if #available(iOS 17.0, *) {
                    // Circular CTA per product design intent — restored
                    // here (was a capsule/pill in the prior pass, which
                    // wasn't the intended treatment). .contentShape(Circle())
                    // guarantees the entire circular area is tappable, not
                    // just the icon glyph.
                    Link(destination: URL(string: "lucid://start-focus")!) {
                        ZStack {
                            Circle()
                                .fill(Color.accentColor)
                            Image(systemName: "play.fill")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 56, height: 56)
                        .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                } else {
                    // Unreachable at this target's 17.0 deployment minimum —
                    // kept only so the view compiles independent of that
                    // setting, same pattern as the widget body's own
                    // #available branch below.
                    ZStack {
                        Circle().fill(Color.accentColor)
                        Image(systemName: "play.fill")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    .frame(width: 56, height: 56)
                }
                Spacer()
            }
        }
        .padding()
    }
}

struct DeepWorkWidget: Widget {
    let kind: String = "DeepWorkWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DeepWorkWidgetProvider()) { entry in
            if #available(iOS 17.0, *) {
                DeepWorkWidgetEntryView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                DeepWorkWidgetEntryView(entry: entry)
                    .padding()
                    .background()
            }
        }
        .configurationDisplayName("Lucid")
        .description("See today's focus sessions at a glance.")
        // .systemMedium is the primary/v1 Home Screen family per product spec.
        // .accessoryRectangular is the minimum Lock Screen configuration
        // (Milestone 6) — same extension, same provider/data, no new target
        // or Control Center functionality.
        .supportedFamilies([.systemMedium, .accessoryRectangular])
    }
}

#Preview(as: .systemMedium) {
    DeepWorkWidget()
} timeline: {
    DeepWorkWidgetEntry(date: .now, state: .empty)
    DeepWorkWidgetEntry(
        date: .now,
        state: WidgetSharedState(
            sessionsCompletedToday: 3,
            weeklyActivity: [
                DayActivity(date: "2026-08-20", sessionsCount: 1, isToday: false),
                DayActivity(date: "2026-08-21", sessionsCount: 0, isToday: false),
                DayActivity(date: "2026-08-22", sessionsCount: 2, isToday: false),
                DayActivity(date: "2026-08-23", sessionsCount: 4, isToday: false),
                DayActivity(date: "2026-08-24", sessionsCount: 1, isToday: false),
                DayActivity(date: "2026-08-25", sessionsCount: 0, isToday: false),
                DayActivity(date: "2026-08-26", sessionsCount: 3, isToday: true),
            ],
            activeSession: nil,
            lastCompletedSession: nil,
            defaultSessionConfig: nil,
            updatedAt: Date().timeIntervalSince1970 * 1000
        )
    )
}
