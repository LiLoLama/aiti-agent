# Supabase Setup für den Agenten-Chat

Diese Anwendung erwartet eine Supabase-Instanz mit einer `profiles`-Tabelle, in der die Nutzerkonten verwaltet werden, und einer neuen Tabelle `agent_conversations`, die genau einen Chat pro Agent speichert. Die folgende Anleitung beschreibt die notwendigen Tabellen, Spalten und Row-Level-Security-Policies.

## 1. Tabelle `profiles`

Falls noch nicht vorhanden, lege eine Tabelle `profiles` mit folgenden Spalten an:

| Spalte          | Typ        | Hinweise                                   |
|-----------------|------------|--------------------------------------------|
| `id`            | `uuid`     | Primärschlüssel. Muss der `auth.users`-ID entsprechen. |
| `email`         | `text`     | Optional.                                  |
| `display_name`  | `text`     | Optional.                                  |
| `name`          | `text`     | Optional.                                  |
| `avatar_url`    | `text`     | Optional.                                  |
| `role`          | `text`     | Optional (`user` oder `admin`).            |
| `agents`        | `jsonb`    | Speicherung der Agent-Konfigurationen.     |
| `bio`           | `text`     | Optional.                                  |
| `email_verified`| `text`     | Optional (`'true'` / `'false'`).           |
| `is_active`     | `boolean`  | Optional, Standard `true`.                 |
| `created_at`    | `timestamptz` | Standard `now()`.                        |
| `updated_at`    | `timestamptz` | Standard `now()`.                        |

> Wichtig: Aktiviere RLS (Row Level Security) auf der Tabelle. Erstelle Policies, damit angemeldete Nutzer nur auf ihre eigene Zeile zugreifen dürfen (`id = auth.uid()`). Mindestens SELECT, INSERT und UPDATE werden benötigt.

## 2. Tabelle `agent_conversations`

Die Chat-Daten werden in einer separaten Tabelle `agent_conversations` gespeichert. Frühere Tabellen wie `chats` oder `chat_folders` werden von der Anwendung nicht mehr angesprochen. Lege die neue Tabelle mit folgenden Spalten an:

| Spalte            | Typ          | Hinweise                                                         |
|-------------------|--------------|------------------------------------------------------------------|
| `id`              | `uuid`       | Primärschlüssel. Wird clientseitig via `crypto.randomUUID()` erzeugt. |
| `profile_id`      | `uuid`       | Fremdschlüssel zu `profiles.id`.                                 |
| `agent_id`        | `uuid`       | ID des Agents. Es darf pro (`profile_id`, `agent_id`) nur genau eine Zeile existieren. |
| `title`           | `text`       | Optionaler Anzeigename (wird automatisch gepflegt).              |
| `summary`         | `text`       | Kurze Vorschau auf die letzte Nachricht.                         |
| `messages`        | `jsonb`      | Vollständiger Nachrichtenverlauf (Array).                        |
| `last_message_at` | `timestamptz`| Zeitpunkt der letzten Nachricht.                                 |
| `created_at`      | `timestamptz`| Standard `now()`.                                                |
| `updated_at`      | `timestamptz`| Optional.                                                        |
| `agent_name`      | `text`       | Klarname des Agents (wird auch als Chat-Titel genutzt).          |
| `agent_description` | `text`    | Beschreibung/Rolle des Agents.                                   |
| `agent_avatar_url` | `text`     | Optionale Avatar-URL für den Agent.                              |
| `agent_tools`     | `jsonb`      | Liste der Tool-Bezeichner (Array von Strings).                   |
| `agent_webhook_url` | `text`    | Ziel-Webhook für eingehende Nachrichten.                         |

### Indizes und Constraints

1. Primärschlüssel auf `id`.
2. Fremdschlüssel `profile_id` → `profiles.id` (ON DELETE CASCADE empfohlen).
3. Einzigartiger Index auf (`profile_id`, `agent_id`), damit pro Agent nur ein Chat existiert:
   ```sql
   create unique index agent_conversations_profile_agent_unique on public.agent_conversations (profile_id, agent_id);
   ```

### Row-Level-Security

Aktiviere RLS auf `agent_conversations` und erstelle folgende Policies:

```sql
create policy "Users can view own agent chats"
  on public.agent_conversations
  for select
  using (profile_id = auth.uid());

create policy "Users can insert own agent chats"
  on public.agent_conversations
  for insert
  with check (profile_id = auth.uid());

create policy "Users can update own agent chats"
  on public.agent_conversations
  for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "Users can delete own agent chats"
  on public.agent_conversations
  for delete
  using (profile_id = auth.uid());
```

> Die Anwendung erstellt fehlende Chats automatisch und pflegt Agent-Stammdaten direkt in dieser Tabelle. Der eindeutige Index stellt sicher, dass pro Agent nur ein Chat erzeugt werden kann.

## 3. Erwartete Umgebungsvariablen

Stelle sicher, dass dein Frontend Zugriff auf die folgenden Variablen hat:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Beide Werte kannst du im Supabase-Dashboard unter **Project Settings → API** abrufen.

## 4. Zusammenfassung

- Jeder Agent besitzt genau einen Chat in der Tabelle `agent_conversations` (Identifikation über `agent_id`).
- Die Anwendung liest und schreibt ausschließlich Zeilen, deren `profile_id` der angemeldeten Nutzer-ID entspricht.
- Policies auf `profiles` und `agent_conversations` müssen INSERT, SELECT, UPDATE (und optional DELETE) für die jeweilige Nutzer-ID erlauben.
