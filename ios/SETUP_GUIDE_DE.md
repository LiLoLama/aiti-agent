# iOS-Integration der AITI Explorer Web-App

Diese Anleitung erklärt Schritt für Schritt, wie du die bestehende React-Anwendung in ein natives iOS-Projekt auf Basis von SwiftUI einbindest. Ziel ist, den mit Vite erzeugten Web-Build als gebundelte Ressourcen in einer iOS-App mit `WKWebView` bereitzustellen.

## 1. Voraussetzungen

- Xcode 15 oder neuer
- Node.js 18+ und npm
- Optional: Ein echter iOS-Gerät oder der iOS-Simulator

## 2. Web-App bauen

1. Im Projektstamm die Abhängigkeiten installieren (falls noch nicht geschehen):
   ```bash
   npm install
   ```
2. Produktions-Build erstellen:
   ```bash
   npm run build
   ```
   Der fertige Web-Build liegt danach im Ordner `dist/`.

## 3. Web-Build für iOS vorbereiten

1. Lege (falls noch nicht vorhanden) den Ordner `ios/AITIExplorerAgent/WebAssets` an.
2. Kopiere den Inhalt des `dist/`-Ordners in `ios/AITIExplorerAgent/WebAssets`.
   ```bash
   rm -rf ios/AITIExplorerAgent/WebAssets
   mkdir -p ios/AITIExplorerAgent/WebAssets
   cp -R dist/* ios/AITIExplorerAgent/WebAssets/
   ```
3. Prüfe, dass sich innerhalb von `WebAssets` eine `index.html` und alle referenzierten Assets (JS, CSS, Fonts, Medien) befinden. Die Swift-App lädt exakt diese Struktur.

> Tipp: Wiederhole Schritt 2 und 3 immer dann, wenn du Änderungen an der React-App vorgenommen hast. Automatisieren lässt sich das z. B. mit einem npm-Skript oder einem kleinen Shell-Skript.

## 4. Neues Xcode-Projekt anlegen

1. Starte Xcode und wähle **File → New → Project…**
2. Template **App** unter **iOS** wählen und auf **Next** klicken.
3. Produktname z. B. „AITIExplorerAgent“ eingeben, Team und Bundle Identifier festlegen.
4. Programmiersprache **Swift**, Interface **SwiftUI**, Lifecycle **SwiftUI App**.
5. Projekt speichern (z. B. im Ordner `ios/AITIExplorerAgent` neben den bereitgestellten Swift-Dateien).

## 5. Swift-Dateien übernehmen

Im Ordner `ios/AITIExplorerAgent/App` liegen vorbereitete Swift-Dateien. Ziehe die folgenden Dateien per Drag & Drop (oder via **File → Add Files…**) in dein Xcode-Projekt und achte darauf, dass **Copy items if needed** aktiviert ist und der Target-Haken gesetzt ist:

- `AITIExplorerAgentApp.swift`
- `WebAppModel.swift`
- `WebAppURLResolver.swift`
- `WebAppView.swift`
- `MissingBundleView.swift`

Diese Dateien ersetzen den Standard-Inhalt des automatisch generierten SwiftUI-Projektes.

## 6. WebAssets ins App-Bundle einbinden

1. Ziehe den kompletten Ordner `ios/AITIExplorerAgent/WebAssets` in das Xcode-Projekt (z. B. in eine Gruppe namens „Resources“).
2. Aktiviere beim Import die Optionen **Create folder references** und **Copy items if needed**. Die Ordner-Referenz stellt sicher, dass die Ordnerstruktur 1:1 im Bundle landet.
3. In den **Build Phases** deines Targets kontrollieren, dass `WebAssets` unter **Copy Bundle Resources** auftaucht.

## 7. App starten

1. Wähle im Xcode-Scheme den gewünschten Simulator oder ein verbundenes iOS-Gerät.
2. Starte die App mit `Cmd + R`.
3. Beim ersten Start sucht die App nach `WebAssets/index.html`. Falls der Ordner fehlt, zeigt sie eine Hinweisseite mit einem Button „Erneut prüfen“. Nach dem Kopieren der Assets genügt ein erneuter Start oder ein Tippen auf den Button.

## 8. Optional: Live-Reload während der Entwicklung

- Während der lokalen Web-Entwicklung kannst du anstelle des gebauten Bundles auch den Vite-Dev-Server verwenden, indem du den `WKWebView` auf `http://<deine-ip>:5173` zeigst. Passe dafür in `AITIExplorerAgentApp.swift` und `WebAppView.swift` den Ladevorgang an (z. B. durch eine Debug-Flag, die `load(URLRequest(url:))` anstößt).
- Achte darauf, das Laden unsicherer (http) Inhalte auf echten Geräten über App-Transport-Security anzupassen (`Info.plist`).

## 9. Aktualisierung für App Store Builds

- Vor jedem Release `npm run build` ausführen und den `dist/`-Inhalt nach `WebAssets` kopieren.
- Danach das Projekt archivieren (`Product → Archive`) und wie gewohnt signieren.

## 10. Häufige Fehlerquellen

| Problem | Ursache | Lösung |
| --- | --- | --- |
| Startbildschirm bleibt leer | `WebAssets` fehlen im Bundle | Ordner als Folder Reference ins Projekt ziehen und Build erneut ausführen |
| Konsole meldet „index.html nicht gefunden“ | Build nicht nach `WebAssets` kopiert | Schritt 3 wiederholen |
| Keine Styles / Broken Layout | Nicht alle Dateien aus `dist/` kopiert | Ordner komplett löschen und frisch kopieren |
| Audio-Aufnahme funktioniert nicht | `WKWebView` benötigt Mikrofon-Berechtigung | In `Info.plist` den Schlüssel `NSMicrophoneUsageDescription` ergänzen |

## 11. Weiterführende Anpassungen

- Über `WKUserContentController` lassen sich native und webbasierte Funktionen koppeln (z. B. Push-Notifications, Dateiauswahl).
- Für Offline-Fähigkeit kann der Web-Build um Service Worker erweitert werden.
- Swift-spezifische Funktionen (z. B. Kamera) kannst du über `WKScriptMessageHandler` mit dem bestehenden JavaScript verknüpfen.

Damit steht einer lauffähigen iOS-App nichts mehr im Wege. Viel Erfolg beim Testen und Deployen!
