# Widget Feasibility Spike — NOT WIRED INTO ANY BUILD TARGET

This directory is source-only reference code for Phase 2 of the widget
architecture spike. Nothing here is referenced by `DeepWorkio.xcodeproj` or
`DeepWorkioDev.xcodeproj` — it will not compile into any current build.

It exists to document the exact pattern Phase 3+ would implement once a
Widget Extension target exists, and to make the App Group / entitlement
requirements concrete rather than abstract.

## Files

- `FocusLockCore.swift` — the portion of `FocusLockModule.swift`'s logic that
  has zero dependency on React/RCT. This is what a Widget Extension's App
  Intent would call directly. It is NOT a second Focus Lock implementation —
  it is proposed as the thing `FocusLockModule.swift` itself would be
  refactored to wrap, so the app target and the widget target share one
  source of truth instead of forking logic.
- `StartFocusSessionIntent.swift` — a sketch of the `AppIntent` a widget
  button would invoke. Demonstrates: (a) running without opening the app
  (`openAppWhenRun = false`), (b) calling `FocusLockCore` directly so Focus
  Lock engages synchronously inside the intent's `perform()`, (c) writing a
  durable "pending session start" record into a shared App Group container
  so the RN app can pick it up whenever it next becomes ready.

## Why this can't be validated further without you

Turning this into something testable requires:
1. Creating an actual Widget Extension target in Xcode (File > New > Target).
2. Adding the App Groups capability to both the main app target and the new
   widget target in Signing & Capabilities (this touches provisioning
   profiles — prod appears to use manual signing, so this likely requires a
   profile regeneration in the Apple Developer portal).
3. Building and running on a physical iPhone — the Simulator does not
   enforce ManagedSettings shields, so nothing about the actual blocking
   behavior can be confirmed without real hardware.

See the Phase 2 report for exact step-by-step instructions.
