import SwiftUI

struct MissingBundleView: View {
    let state: WebAppModel.State
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 56, weight: .regular))
                .foregroundColor(.orange)

            Text(title)
                .font(.title2)
                .multilineTextAlignment(.center)

            Text(message)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            if shouldShowRetryButton {
                Button(action: retry) {
                    Label("Erneut prüfen", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
    }

    private var title: String {
        switch state {
        case .loading:
            return "Bundledaten werden gesucht"
        case .missingAssets:
            return "WebAssets fehlen"
        case .failed:
            return "Fehler beim Laden"
        default:
            return "Inhalt wird geladen"
        }
    }

    private var message: String {
        switch state {
        case .loading:
            return "Die App sucht nach dem im Bundle gespeicherten Web-Build."
        case .missingAssets:
            return "Bitte stelle sicher, dass der dist-Ordner nach ios/AITIExplorerAgent/WebAssets kopiert und im Copy Bundle Resources Build-Step enthalten ist."
        case .failed(let description):
            return description
        case .idle:
            return "Tippe auf \"Erneut prüfen\", nachdem der Web-Build hinzugefügt wurde."
        case .ready:
            return ""
        }
    }

    private var shouldShowRetryButton: Bool {
        switch state {
        case .ready:
            return false
        default:
            return true
        }
    }
}

struct MissingBundleView_Previews: PreviewProvider {
    static var previews: some View {
        MissingBundleView(state: .missingAssets, retry: {})
            .previewLayout(.sizeThatFits)
    }
}
