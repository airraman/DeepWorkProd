//
//  DeepWorkWidgetControl.swift
//  DeepWorkWidget
//
//  Created by Raman Mama on 8/22/26.
//

import AppIntents
import SwiftUI
import WidgetKit

// Control Widgets (Lock Screen / Control Center) require iOS 18+ APIs.
// Out of scope for this sprint's Home Screen widget foundation — this file
// is unmodified Xcode template boilerplate, gated so it doesn't block
// building against the 17.0 deployment target the Home Screen widget needs.
@available(iOS 18.0, *)
struct DeepWorkWidgetControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(
            kind: "com.airraman.deepwork.DeepWorkWidget",
            provider: Provider()
        ) { value in
            ControlWidgetToggle(
                "Start Timer",
                isOn: value,
                action: StartTimerIntent()
            ) { isRunning in
                Label(isRunning ? "On" : "Off", systemImage: "timer")
            }
        }
        .displayName("Timer")
        .description("A an example control that runs a timer.")
    }
}

@available(iOS 18.0, *)
extension DeepWorkWidgetControl {
    struct Provider: ControlValueProvider {
        var previewValue: Bool {
            false
        }

        func currentValue() async throws -> Bool {
            let isRunning = true // Check if the timer is running
            return isRunning
        }
    }
}

@available(iOS 18.0, *)
struct StartTimerIntent: SetValueIntent {
    static let title: LocalizedStringResource = "Start a timer"

    @Parameter(title: "Timer is running")
    var value: Bool

    func perform() async throws -> some IntentResult {
        // Start / stop the timer based on `value`.
        return .result()
    }
}
