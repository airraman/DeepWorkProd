//
//  DeepWorkWidgetLiveActivity.swift
//  DeepWorkWidget
//
//  Created by Raman Mama on 8/22/26.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct DeepWorkWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct DeepWorkWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DeepWorkWidgetAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension DeepWorkWidgetAttributes {
    fileprivate static var preview: DeepWorkWidgetAttributes {
        DeepWorkWidgetAttributes(name: "World")
    }
}

extension DeepWorkWidgetAttributes.ContentState {
    fileprivate static var smiley: DeepWorkWidgetAttributes.ContentState {
        DeepWorkWidgetAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: DeepWorkWidgetAttributes.ContentState {
         DeepWorkWidgetAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: DeepWorkWidgetAttributes.preview) {
   DeepWorkWidgetLiveActivity()
} contentStates: {
    DeepWorkWidgetAttributes.ContentState.smiley
    DeepWorkWidgetAttributes.ContentState.starEyes
}
