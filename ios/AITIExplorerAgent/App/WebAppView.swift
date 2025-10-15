import SwiftUI
import WebKit

struct WebAppView: UIViewRepresentable {
    let indexURL: URL

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.backgroundColor = .systemBackground
        webView.scrollView.backgroundColor = .systemBackground

        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }

        loadIndex(in: webView)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        guard context.coordinator.requestedReload else { return }
        loadIndex(in: uiView)
        context.coordinator.requestedReload = false
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    private func loadIndex(in webView: WKWebView) {
        let baseURL = indexURL.deletingLastPathComponent()
        webView.loadFileURL(indexURL, allowingReadAccessTo: baseURL)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var requestedReload = false
        private let parent: WebAppView

        init(parent: WebAppView) {
            self.parent = parent
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            requestedReload = true
            parent.loadIndex(in: webView)
        }
    }
}
