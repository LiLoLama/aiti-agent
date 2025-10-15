import Foundation
import os.log

@MainActor
final class WebAppModel: ObservableObject {
    enum State: Equatable {
        case idle
        case loading
        case ready
        case missingAssets
        case failed(String)
    }

    @Published private(set) var state: State = .idle
    @Published private(set) var indexURL: URL?

    private let logger = Logger(subsystem: "com.aiti.explorer", category: "WebAppModel")

    func refresh() {
        guard state != .loading else { return }
        state = .loading

        do {
            let indexURL = try WebAppURLResolver.locateIndexHTML()
            self.indexURL = indexURL
            state = .ready
        } catch WebAppURLResolver.Error.indexFileMissing {
            state = .missingAssets
            indexURL = nil
        } catch {
            state = .failed(error.localizedDescription)
            indexURL = nil
            logger.error("Web bundle lookup failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}
