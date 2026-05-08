// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import SwiftUI
import WebKit

// MARK: - ContentView

struct ContentView: NSViewRepresentable {
  func makeCoordinator() -> Coordinator { Coordinator() }

  func makeNSView(context: Context) -> WKWebView {
    let config = WKWebViewConfiguration()
    config.setURLSchemeHandler(AppSchemeHandler(), forURLScheme: "app")
    config.userContentController.add(context.coordinator, name: "scoreData")

    let webView = WKWebView(frame: .zero, configuration: config)
    webView.setValue(false, forKey: "drawsBackground")

    #if DEBUG
    webView.configuration.preferences.setValue(true, forKey: "developerExtrasEnabled")
    #endif

    webView.load(URLRequest(url: URL(string: "app://localhost/")!))
    return webView
  }

  func updateNSView(_ nsView: WKWebView, context: Context) {}

  // MARK: - Coordinator (JS message bridge)

  class Coordinator: NSObject, WKScriptMessageHandler {
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
      guard message.name == "scoreData",
            let jsonString = message.body as? String,
            let data = jsonString.data(using: .utf8),
            let payload = try? JSONDecoder().decode(ScorePayload.self, from: data)
      else { return }

      AppDelegate.savePayload(payload)
      NotificationCenter.default.post(name: .ejuScoreUpdated, object: nil)
    }
  }
}

// MARK: - URL Scheme Handler

class AppSchemeHandler: NSObject, WKURLSchemeHandler {
  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    guard let url = task.request.url else {
      task.didFailWithError(URLError(.badURL)); return
    }

    var path = url.path
    if path.isEmpty || path == "/" { path = "/index.html" }

    guard let wwwURL = Bundle.main.url(forResource: "www", withExtension: nil) else {
      task.didFailWithError(URLError(.fileDoesNotExist)); return
    }

    let components = path.components(separatedBy: "/").filter { !$0.isEmpty }
    var fileURL = wwwURL
    for c in components { fileURL = fileURL.appendingPathComponent(c) }

    func respond(data: Data, mime: String) {
      let headers = ["Content-Type": mime, "Cache-Control": "no-cache"]
      let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
      task.didReceive(resp)
      task.didReceive(data)
      task.didFinish()
    }

    if let data = try? Data(contentsOf: fileURL) {
      respond(data: data, mime: mime(for: fileURL.pathExtension))
    } else {
      let index = wwwURL.appendingPathComponent("index.html")
      if let data = try? Data(contentsOf: index) {
        respond(data: data, mime: "text/html; charset=utf-8")
      } else {
        task.didFailWithError(URLError(.fileDoesNotExist))
      }
    }
  }

  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

  private func mime(for ext: String) -> String {
    switch ext.lowercased() {
    case "html":        return "text/html; charset=utf-8"
    case "js", "mjs":  return "application/javascript; charset=utf-8"
    case "css":         return "text/css; charset=utf-8"
    case "json":        return "application/json"
    case "svg":         return "image/svg+xml"
    case "png":         return "image/png"
    case "jpg","jpeg":  return "image/jpeg"
    case "ico":         return "image/x-icon"
    case "woff2":       return "font/woff2"
    case "woff":        return "font/woff"
    case "ttf":         return "font/ttf"
    default:            return "application/octet-stream"
    }
  }
}
