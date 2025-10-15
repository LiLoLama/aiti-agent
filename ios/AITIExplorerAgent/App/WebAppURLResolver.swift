import Foundation

enum WebAppURLResolver {
    enum Error: LocalizedError {
        case indexFileMissing
        case bundleResourceMissing

        var errorDescription: String? {
            switch self {
            case .indexFileMissing:
                return "Die Datei index.html konnte im WebAssets-Ordner nicht gefunden werden."
            case .bundleResourceMissing:
                return "Der WebAssets-Ordner ist nicht Bestandteil des App-Bundles."
            }
        }
    }

    static func locateIndexHTML(bundle: Bundle = .main) throws -> URL {
        guard let webAssetsURL = bundle.url(forResource: "WebAssets", withExtension: nil) else {
            throw Error.bundleResourceMissing
        }

        let indexURL = webAssetsURL.appendingPathComponent("index.html", isDirectory: false)
        guard FileManager.default.fileExists(atPath: indexURL.path) else {
            throw Error.indexFileMissing
        }

        return indexURL
    }
}
