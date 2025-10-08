# Supabase Setup für den Agenten-Chat

Diese Anwendung erwartet eine Supabase-Instanz mit einer `profiles`-Tabelle, in der die Nutzerkonten verwaltet werden, und einer `chats`-Tabelle, die genau einen Chat pro Agent speichert. Die folgende Anleitung beschreibt die notwendigen Tabellen, Spalten und Row-Level-Security-Policies.

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

## 2. Tabelle `chats`

Die Chat-Daten werden in einer Tabelle `chats` gespeichert. Lege sie mit folgenden Spalten an:

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

### Indizes und Constraints

1. Primärschlüssel auf `id`.
2. Fremdschlüssel `profile_id` → `profiles.id` (ON DELETE CASCADE empfohlen).
3. Einzigartiger Index auf (`profile_id`, `agent_id`), damit pro Agent nur ein Chat existiert:
   ```sql
   create unique index chats_profile_agent_unique on public.chats (profile_id, agent_id);
   ```

### Row-Level-Security

Aktiviere RLS auf `chats` und erstelle folgende Policies:

```sql
create policy "Users can view own chats"
  on public.chats
  for select
  using (profile_id = auth.uid());

create policy "Users can insert own chats"
  on public.chats
  for insert
  with check (profile_id = auth.uid());

create policy "Users can update own chats"
  on public.chats
  for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "Users can delete own chats"
  on public.chats
  for delete
  using (profile_id = auth.uid());
```

> Die Anwendung erstellt fehlende Chats automatisch. Der eindeutige Index stellt sicher, dass pro Agent nur ein Chat erzeugt werden kann.

## 3. Nicht mehr benötigte Tabellen

Frühere Versionen nutzten eine Tabelle `chat_folders`. Diese wird von der aktuellen Oberfläche nicht mehr verwendet und kann optional entfernt oder ignoriert werden.

## 4. Erwartete Umgebungsvariablen

Stelle sicher, dass dein Frontend Zugriff auf die folgenden Variablen hat:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Beide Werte kannst du im Supabase-Dashboard unter **Project Settings → API** abrufen.

## 5. Zusammenfassung

- Jeder Agent besitzt genau einen Chat in der Tabelle `chats` (Identifikation über `agent_id`).
- Die Anwendung liest und schreibt ausschließlich Zeilen, deren `profile_id` der angemeldeten Nutzer-ID entspricht.
- Policies auf `profiles` und `chats` müssen INSERT, SELECT, UPDATE (und optional DELETE) für die jeweilige Nutzer-ID erlauben.
