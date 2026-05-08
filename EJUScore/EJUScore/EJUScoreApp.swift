// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import SwiftUI

@main
struct EJUScoreApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

  var body: some Scene {
    WindowGroup("EJU 스코어") {
      ContentView()
        .frame(minWidth: 1100, minHeight: 680)
    }
    .commands {
      CommandGroup(replacing: .newItem) {}
    }
  }
}
