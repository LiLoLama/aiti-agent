import SwiftUI

@main
struct AITIExplorerAgentApp: App {
    @StateObject private var webAppModel = WebAppModel()

    var body: some Scene {
        WindowGroup {
            ZStack {
                if let localIndexURL = webAppModel.indexURL {
                    WebAppView(indexURL: localIndexURL)
                        .ignoresSafeArea()
                } else {
                    MissingBundleView(state: webAppModel.state) {
                        webAppModel.refresh()
                    }
                    .task {
                        webAppModel.refresh()
                    }
                }
            }
            .background(Color(.systemBackground))
        }
    }
}
