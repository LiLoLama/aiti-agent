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
  - [Supabase Setup](#supabase-setup)
- [Architektur & Projektstruktur](#architektur--projektstruktur)
- [Installation & lokale Entwicklung](#installation--lokale-entwicklung)
- [Konfiguration](#konfiguration)
- [Webhook-Anbindung](#webhook-anbindung)
- [Lokale Speicherung & Branding](#lokale-speicherung--branding)

## Überblick
Die App stellt drei geschützte Bereiche (Chat, Einstellungen, Profil) sowie eine Login- und Registrierungsstrecke bereit und erzwingt die Anmeldung über einen zentralen Auth-Guard. Die Oberflächen wurden vollständig auf Deutsch gestaltet, um Agentenarbeit in deutschsprachigen Teams zu unterstützen.

## Funktionsumfang

### Chat-Workspace
- Übersichtliches Chat-Board mit Agentenvorschau und schneller Navigation im Seitenpanel.
- Nachrichten unterstützen Dateiuploads, Audionachrichten (inklusive Push-to-Talk) und erzeugen automatisch strukturierte Vorschauen für die Chatliste.
- Antworten werden über konfigurierbare Webhooks eingeholt; Fehlerfälle werden als Systemnachrichten dokumentiert, sodass der Verlauf vollständig bleibt.

### Agenten- & Profilverwaltung
- Nutzer bearbeiten Profilname, Biografie, Avatar, Farbschema und können Änderungen speichern oder verwerfen.
- Agenten lassen sich anlegen, bearbeiten, testen und löschen – inklusive Tool-Liste, individuellem Webhook und optionalem Agentenavatar.
- Administratoren erhalten eine Teamübersicht mit Aktivierung/Deaktivierung von Nutzerzugängen; Fehler bei der Statusänderung werden angezeigt.

### Einstellungen & Integrationen
- Globale Einstellungen decken Profilbranding, Agentenbranding, Webhook-Ziel, Authentifizierung (API-Key, Basic, OAuth) sowie Farbschemata ab.
- Webhooks können direkt aus den Einstellungen getestet werden; Statusmeldungen informieren über Erfolg oder Fehler.

### Authentifizierung & Rollen
- Login- und Registrierungsformular teilen sich eine Oberfläche, bieten Statusmeldungen und wechseln per Tabs zwischen beiden Modi.
- Die Authentifizierung läuft über Supabase Auth; Profile und Rollen (Nutzer/Admin) werden direkt in der `profiles`-Tabelle gepflegt.

### Datenhaltung & Synchronisation
- Chats, Nachrichten und Agenten werden in Supabase persistiert und bei jedem Login synchronisiert.
- Optimistic-Updates sorgen für reaktionsschnelle UI-Erlebnisse, während Webhook-Antworten unmittelbar in die Gesprächshistorie einfließen.

## Architektur & Projektstruktur
- React 18, React Router und TypeScript liefern das SPA-Framework; Vite dient als Build-Tool.
- Tailwind CSS, Heroicons und clsx unterstützen das UI-Design.
- Der Code ist nach Domänen organisiert (Pages, Components, Context, Services, Utils, Types). Die Hauptrouten liegen in `App.tsx` und greifen auf diese Module zurück.
- Supabase dient als zentrale Benutzer- und Chat-Datenbank. Profile, Agenten sowie Nachrichten werden in den Tabellen `profiles` und `agent_conversations` gespeichert; Integrationsgeheimnisse landen in `integration_secrets`.

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

Die Script-Bezeichnungen entsprechen den Vite-Standards und sind in `package.json` hinterlegt.

## Konfiguration
### Supabase Setup

Die App erwartet eine Supabase-Instanz mit den Tabellen `profiles`, `agent_conversations` und `integration_secrets`. Alle notwendigen Spalten und Policies sind in [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) dokumentiert. Nach dem Einrichten müssen die folgenden Umgebungsvariablen gesetzt werden:

```bash
VITE_SUPABASE_URL=<deine-supabase-url>
VITE_SUPABASE_ANON_KEY=<dein-supabase-anon-key>
# alternativ kann VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY verwendet werden
```

Die Werte werden zur Initialisierung des Supabase-Clients genutzt und sind für Login, Agentenverwaltung und das Speichern der Chatverläufe erforderlich.

## Webhook-Anbindung
Chatnachrichten werden zusammen mit Dateianhängen, Audioaufnahmen und Chatverlauf per `FormData` an den konfigurierten Webhook gesendet. Je nach Authentifizierungsmodus werden API-Key-, Basic- oder OAuth-Header ergänzt. Antworten (JSON oder Text) werden normalisiert und im Verlauf gespeichert, Fehler führen zu klaren Meldungen im Chat. Der Chat weist darauf hin, dass Nachrichten typischerweise an n8n-Workflows ausgeliefert werden.

## Lokale Speicherung & Branding
Persönliche Einstellungen wie Profilname, Agenten-Branding und Farbschema werden weiterhin im Browser `localStorage` abgelegt, damit UI-Anpassungen schnell greifen. Chats, Agentenprofile und Integrationsdaten werden jedoch vollständig in Supabase persistiert. Änderungen lösen Events aus, die sowohl Profil- als auch Einstellungsseiten synchron halten.
