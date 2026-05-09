// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import AppKit
import Foundation

struct ScorePayload: Codable {
  var examCount: Int
  var latestJap: Int?
  var latestComp: Int?
  var latestExamName: String?
  var targetJap: Int?
  var targetComp: Int?
}

class AppDelegate: NSObject, NSApplicationDelegate {
  var statusItem: NSStatusItem?

  func applicationDidFinishLaunching(_ notification: Notification) {
    setupStatusItem()
    // Listen for data updates posted by ContentView
    NotificationCenter.default.addObserver(
      self, selector: #selector(refreshStatusItem),
      name: .ejuScoreUpdated, object: nil
    )
  }

  // MARK: - Status Item

  private func setupStatusItem() {
    statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    guard let btn = statusItem?.button else { return }
    btn.font = NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .medium)
    btn.action = #selector(showMenu)
    btn.target = self
    updateButtonTitle(payload: loadPayload())
  }

  @objc private func refreshStatusItem() {
    updateButtonTitle(payload: loadPayload())
  }

  private func updateButtonTitle(payload: ScorePayload?) {
    guard let btn = statusItem?.button else { return }
    guard let p = payload else { btn.title = "EJU"; return }

    var parts: [String] = []
    if let j = p.latestJap  { parts.append("日\(j)") }
    if let c = p.latestComp { parts.append("総\(c)") }
    btn.title = parts.isEmpty ? "EJU" : parts.joined(separator: " · ")
  }

  @objc private func showMenu() {
    let payload = loadPayload()
    let menu = NSMenu()

    // Header
    let header = NSMenuItem()
    header.view = makeHeaderView(payload: payload)
    menu.addItem(header)
    menu.addItem(.separator())

    // Progress toward targets
    if let p = payload {
      if let j = p.latestJap, let tj = p.targetJap {
        let remain = max(0, tj - j)
        let item = NSMenuItem(title: remain == 0 ? "🎉 일본어 목표 달성!" : "📖 일본어 목표까지 +\(remain)점 (\(j)/\(tj))", action: nil, keyEquivalent: "")
        item.isEnabled = false
        menu.addItem(item)
      }
      if let c = p.latestComp, let tc = p.targetComp {
        let remain = max(0, tc - c)
        let item = NSMenuItem(title: remain == 0 ? "🎉 종합과목 목표 달성!" : "📚 종합과목 목표까지 +\(remain)점 (\(c)/\(tc))", action: nil, keyEquivalent: "")
        item.isEnabled = false
        menu.addItem(item)
      }
      menu.addItem(.separator())
      let countItem = NSMenuItem(title: "총 \(p.examCount)회 시험 기록됨", action: nil, keyEquivalent: "")
      countItem.isEnabled = false
      menu.addItem(countItem)
      menu.addItem(.separator())
    }

    menu.addItem(withTitle: "EJU 스코어 열기", action: #selector(openMainWindow), keyEquivalent: "")
    menu.addItem(.separator())
    menu.addItem(withTitle: "종료", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

    statusItem?.menu = menu
    statusItem?.button?.performClick(nil)
    statusItem?.menu = nil
  }

  @objc private func openMainWindow() {
    NSApp.activate(ignoringOtherApps: true)
    NSApp.windows.forEach { $0.makeKeyAndOrderFront(nil) }
  }

  // MARK: - Header View

  private func makeHeaderView(payload: ScorePayload?) -> NSView {
    let view = NSView(frame: NSRect(x: 0, y: 0, width: 260, height: payload != nil ? 72 : 44))

    let title = NSTextField(labelWithString: "EJU 스코어")
    title.font = NSFont.boldSystemFont(ofSize: 13)
    title.textColor = .labelColor
    title.frame = NSRect(x: 14, y: view.bounds.height - 26, width: 200, height: 18)
    view.addSubview(title)

    if let p = payload, let name = p.latestExamName {
      let sub = NSTextField(labelWithString: "최신: \(name)")
      sub.font = NSFont.systemFont(ofSize: 11)
      sub.textColor = .secondaryLabelColor
      sub.frame = NSRect(x: 14, y: view.bounds.height - 44, width: 230, height: 16)
      view.addSubview(sub)

      var scoreStr = ""
      if let j = p.latestJap  { scoreStr += "일어 \(j)/400  " }
      if let c = p.latestComp { scoreStr += "종합 \(c)/200" }
      if !scoreStr.isEmpty {
        let score = NSTextField(labelWithString: scoreStr.trimmingCharacters(in: .whitespaces))
        score.font = NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .semibold)
        score.textColor = NSColor(red: 0.31, green: 0.56, blue: 0.97, alpha: 1)
        score.frame = NSRect(x: 14, y: 10, width: 230, height: 16)
        view.addSubview(score)
      }
    } else {
      let sub = NSTextField(labelWithString: "아직 기록이 없습니다")
      sub.font = NSFont.systemFont(ofSize: 11)
      sub.textColor = .secondaryLabelColor
      sub.frame = NSRect(x: 14, y: 10, width: 230, height: 16)
      view.addSubview(sub)
    }

    return view
  }

  // MARK: - Persistence

  private static var dataFileURL: URL {
    let dir = FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/Application Support/EJUScore", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir.appendingPathComponent("scores.json")
  }

  static func savePayload(_ payload: ScorePayload) {
    guard let data = try? JSONEncoder().encode(payload) else { return }
    try? data.write(to: dataFileURL, options: .atomic)
  }

  private func loadPayload() -> ScorePayload? {
    guard let data = try? Data(contentsOf: Self.dataFileURL),
          let p = try? JSONDecoder().decode(ScorePayload.self, from: data)
    else { return nil }
    return p
  }
}

extension Notification.Name {
  static let ejuScoreUpdated = Notification.Name("ejuScoreUpdated")
}
