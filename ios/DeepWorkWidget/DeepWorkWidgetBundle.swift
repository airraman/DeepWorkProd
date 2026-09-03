//
//  DeepWorkWidgetBundle.swift
//  DeepWorkWidget
//
//  Created by Raman Mama on 8/22/26.
//

import WidgetKit
import SwiftUI

@main
struct DeepWorkWidgetBundle: WidgetBundle {
    var body: some Widget {
        DeepWorkWidget()
        // Control Widgets require iOS 18+ — see DeepWorkWidgetControl.swift.
        if #available(iOS 18.0, *) {
            DeepWorkWidgetControl()
        }
        DeepWorkWidgetLiveActivity()
    }
}
