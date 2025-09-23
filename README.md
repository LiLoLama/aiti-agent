# AITI Explorer Agent

Der AITI Explorer Agent ist eine moderne React-Anwendung, mit der Teams ihre KI-gestützten Workflows orchestrieren, Agents verwalten und Chat-Konversationen mit externen Automationen verbinden können. Die Anwendung kombiniert eine hochwertige Benutzeroberfläche mit einer Supabase-gestützten Persistenzschicht und flexiblen Webhook-Integrationen.

## Inhaltsverzeichnis
- [Überblick](#überblick)
- [Funktionsumfang](#funktionsumfang)
  - [Chat-Workspace](#chat-workspace)
  - [Agenten- & Profilverwaltung](#agenten--profilverwaltung)
  - [Einstellungen & Integrationen](#einstellungen--integrationen)
  - [Authentifizierung & Rollen](#authentifizierung--rollen)
  - [Datenhaltung & Synchronisation](#datenhaltung--synchronisation)
- [Architektur & Projektstruktur](#architektur--projektstruktur)
- [Installation & lokale Entwicklung](#installation--lokale-entwicklung)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Supabase-Konfiguration](#supabase-konfiguration)
- [Webhook-Anbindung](#webhook-anbindung)
- [Lokale Speicherung & Branding](#lokale-speicherung--branding)

## Überblick
Die App stellt drei geschützte Bereiche (Chat, Einstellungen, Profil) sowie eine Login- und Registrierungsstrecke bereit und erzwingt die Anmeldung über einen zentralen Auth-Guard.【F:src/App.tsx†L1-L18】 Die Oberflächen wurden vollständig auf Deutsch gestaltet, um Agentenarbeit in deutschsprachigen Teams zu unterstützen.

## Funktionsumfang

### Chat-Workspace
- Übersichtliches Chat-Board mit Ordnerverwaltung, Chat-Anlage, Umbenennung und Löschung direkt aus dem Seitenpanel.【F:src/pages/ChatPage.tsx†L796-L814】【F:src/components/ChatOverviewPanel.tsx†L31-L119】
- Agenten können per Header-Menü gewechselt oder direkt aus dem Chat heraus neu erstellt werden; Benutzer-Avatar und Profilzugriff sind integriert.【F:src/pages/ChatPage.tsx†L817-L831】【F:src/components/ChatHeader.tsx†L24-L119】
- Nachrichten unterstützen Dateiuploads, Audionachrichten (inklusive Push-to-Talk) und erzeugen automatisch strukturierte Vorschauen für die Chatliste.【F:src/pages/ChatPage.tsx†L624-L688】【F:src/components/ChatInput.tsx†L42-L305】
- Antworten werden über konfigurierbare Webhooks eingeholt; Fehlerfälle werden als Systemnachrichten dokumentiert, sodass der Verlauf vollständig bleibt.【F:src/pages/ChatPage.tsx†L688-L793】
- Ohne korrektes Supabase-Profil blendet der Chat einen deutlichen Hinweis zur fehlenden Policy-Konfiguration ein, damit Admins schnell reagieren können.【F:src/pages/ChatPage.tsx†L858-L867】

### Agenten- & Profilverwaltung
- Nutzer bearbeiten Profilname, Biografie, Avatar, Farbschema und können Änderungen speichern oder verwerfen; der aktuelle Status wird visuell hervorgehoben.【F:src/pages/ProfilePage.tsx†L261-L617】
- Agenten lassen sich anlegen, bearbeiten, testen und löschen – inklusive Tool-Liste, individuellem Webhook und optionalem Agentenavatar.【F:src/pages/ProfilePage.tsx†L217-L894】
- Administratoren erhalten eine Teamübersicht mit Aktivierung/Deaktivierung von Nutzerzugängen; Fehler bei der Statusänderung werden angezeigt.【F:src/pages/ProfilePage.tsx†L203-L707】

### Einstellungen & Integrationen
- Globale Einstellungen decken Profilbranding, Agentenbranding, Webhook-Ziel, Authentifizierung (API-Key, Basic, OAuth) sowie Farbschemata ab.【F:src/pages/SettingsPage.tsx†L14-L463】
- Webhooks können direkt aus den Einstellungen getestet werden; Statusmeldungen informieren über Erfolg oder Fehler.【F:src/pages/SettingsPage.tsx†L280-L389】

### Authentifizierung & Rollen
- Login- und Registrierungsformular teilen sich eine Oberfläche, bieten Statusmeldungen und wechseln per Tabs zwischen beiden Modi.【F:src/pages/LoginPage.tsx†L22-L275】
- Die Supabase-gestützte Authentifizierung stellt Login, Registrierung, Session-Handling, Profilupdates, Agentenverwaltung und Admin-Funktionen bereit.【F:src/context/AuthContext.tsx†L23-L638】
- Benutzer können deaktiviert werden; gesperrte Accounts werden nach dem Loginversuch sofort wieder abgemeldet.【F:src/context/AuthContext.tsx†L357-L378】

### Datenhaltung & Synchronisation
- Chats, Ordner und Nachrichten werden aus Supabase geladen, nach Foldern gruppiert und bei Änderungen synchronisiert; lokale Optimistic-Updates sorgen für reaktionsschnelle UI-Erlebnisse.【F:src/pages/ChatPage.tsx†L200-L793】
- Der Chat-Service normalisiert Supabase-Daten, erstellt oder aktualisiert Zeilen, behandelt fehlende Spalten und räumt Ordnerzuweisungen auf.【F:src/services/chatService.ts†L5-L312】
- Bei fehlenden Row-Level-Security-Policies wird ein Fallback-Profil erzeugt und ein aussagekräftiger Fehler ausgelöst, damit das Setup korrigiert werden kann.【F:src/context/AuthContext.tsx†L200-L314】

## Architektur & Projektstruktur
- React 18, React Router und TypeScript liefern das SPA-Framework; Vite dient als Build-Tool.【F:package.json†L6-L27】
- Tailwind CSS, Heroicons und clsx unterstützen das UI-Design.【F:package.json†L11-L26】
- Der Code ist nach Domänen organisiert (Pages, Components, Context, Services, Utils, Types). Die Hauptrouten liegen in `App.tsx` und greifen auf diese Module zurück.【F:src/App.tsx†L1-L18】
- Supabase wird über einen dedizierten Client eingebunden, der URL und Public Key aus der Vite-Umgebung bezieht.【F:src/utils/supabase.ts†L1-L10】

## Installation & lokale Entwicklung
1. Repository klonen und Abhängigkeiten installieren:
   ```bash
   npm install
   ```
2. Entwicklung starten:
   ```bash
   npm run dev
   ```
3. Produktionsbuild erzeugen:
   ```bash
   npm run build
   ```
4. Lokale Vorschau anzeigen:
   ```bash
   npm run preview
   ```
Die Script-Bezeichnungen entsprechen den Vite-Standards und sind in `package.json` hinterlegt.【F:package.json†L6-L27】

## Umgebungsvariablen
Legen Sie eine `.env` oder `.env.local` im Projektwurzelverzeichnis an und befüllen Sie mindestens:
```bash
VITE_SUPABASE_URL="https://<projekt>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY="<public-anon-key>"
```
Ohne diese Werte bricht der Supabase-Client beim Start ab, damit keine unbeabsichtigten Requests gesendet werden.【F:src/utils/supabase.ts†L3-L10】

## Supabase-Konfiguration
Richten Sie in Supabase folgende Tabellen mit passenden Row-Level-Security-Policies ein:

| Tabelle | Zweck | Wichtige Spalten |
| --- | --- | --- |
| `profiles` | Speichert Nutzerprofil, Rolle, Avatar, Aktivitätsstatus und Agenten-JSON. | `id`, `email`, `display_name`, `avatar_url`, `role`, `agents`, `bio`, `email_verified`, `is_active`, `name`, Timestamps.【F:src/context/AuthContext.tsx†L39-L122】 |
| `chats` | Persistiert Chat-Verläufe pro Nutzer inkl. Zuordnung zu Ordnern. | `id`, `profile_id`, `title`/`name`, `messages` (JSON), `folder_id`, `summary`, `last_message_at`, `created_at`, `updated_at`. Fehlende Spalten werden beim Insert automatisch toleriert.【F:src/services/chatService.ts†L13-L308】 |
| `chat_folders` | Verwaltet benutzerdefinierte Chat-Ordner. | `id`, `profile_id`, `name`, `created_at`, `updated_at`.【F:src/services/chatService.ts†L5-L123】 |

Aktivieren Sie RLS und erlauben Sie Nutzern den Zugriff auf ihre eigenen Zeilen. Die Anwendung weist explizit auf fehlende Policies hin, damit Administratoren das Setup abschließen können.【F:src/context/AuthContext.tsx†L200-L314】【F:src/pages/ChatPage.tsx†L858-L867】

## Webhook-Anbindung
Chatnachrichten werden zusammen mit Dateianhängen, Audioaufnahmen und Chatverlauf per `FormData` an den konfigurierten Webhook gesendet. Je nach Authentifizierungsmodus werden API-Key-, Basic- oder OAuth-Header ergänzt. Antworten (JSON oder Text) werden normalisiert und im Verlauf gespeichert, Fehler führen zu klaren Meldungen im Chat.【F:src/utils/webhook.ts†L4-L146】【F:src/pages/ChatPage.tsx†L688-L793】 Der Chat weist darauf hin, dass Nachrichten typischerweise an n8n-Workflows ausgeliefert werden.【F:src/pages/ChatPage.tsx†L887-L888】

## Lokale Speicherung & Branding
Persönliche Einstellungen wie Profilname, Agenten-Branding, Farbschema, sowie lokal erstellte Chats und Ordner werden zusätzlich im Browser `localStorage` abgelegt. Bilder werden bei Bedarf komprimiert, um Speicher zu sparen. Änderungen lösen Events aus, die sowohl Profil- als auch Einstellungsseiten synchron halten.【F:src/utils/storage.ts†L1-L170】【F:src/pages/SettingsPage.tsx†L98-L389】【F:src/pages/ProfilePage.tsx†L82-L311】 Dadurch bleiben individuelle Anpassungen selbst ohne Supabase-Verbindung verfügbar.

