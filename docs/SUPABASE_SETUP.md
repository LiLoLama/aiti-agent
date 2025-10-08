# Supabase Setup

Diese Anwendung nutzt Supabase für Authentifizierung, Profile, Agenten-Chats und Integrationsgeheimnisse. Die folgenden Schritte richten die benötigten Tabellen ein und aktivieren die richtigen Policies.

## Voraussetzungen
- Supabase-Projekt mit aktivierter E-Mail/Passwort-Authentifizierung
- Zugriff auf das SQL-Editor-Modul in Supabase
- Die `auth.users` Tabelle wird automatisch von Supabase verwaltet

## 1. Tabelle `profiles`

Speichert erweiterte Profildaten für jeden Supabase-Nutzer. Die `id` muss mit der `auth.users.id` übereinstimmen.

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  display_name text,
  name text,
  avatar_url text,
  role text,
  bio text,
  email_verified text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles
  enable row level security;
```

### Policies

```sql
create policy "profiles_select_self" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);
```

Administratoren können über zusätzliche Policies Zugriff erhalten, wenn benötigt (z. B. `role = 'admin'`).

## 2. Tabelle `agent_conversations`

Hier werden Agenten-Metadaten und Chatverläufe gespeichert. Pro Kombination aus `profile_id` und `agent_id` darf nur eine Zeile existieren.

```sql
create table if not exists public.agent_conversations (
  id uuid primary key,
  profile_id uuid references public.profiles(id) on delete cascade,
  agent_id uuid not null,
  title text,
  summary text,
  messages jsonb default '[]'::jsonb,
  last_message_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz,
  agent_name text,
  agent_description text,
  agent_avatar_url text,
  agent_tools jsonb default '[]'::jsonb,
  agent_webhook_url text,
  constraint agent_conversations_profile_agent_unique unique (profile_id, agent_id)
);

alter table public.agent_conversations
  enable row level security;
```

### Policies

```sql
create policy "agent_conversations_select_self" on public.agent_conversations
  for select using (auth.uid() = profile_id);

create policy "agent_conversations_modify_self" on public.agent_conversations
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
```

## 3. Tabelle `integration_secrets`

Speichert Webhook- und Authentifizierungsinformationen pro Profil.

```sql
create table if not exists public.integration_secrets (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete cascade,
  webhook_url text,
  auth_type text,
  api_key text,
  basic_username text,
  basic_password text,
  oauth_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint integration_secrets_profile_unique unique (profile_id)
);

alter table public.integration_secrets
  enable row level security;
```

### Policies

```sql
create policy "integration_secrets_select_self" on public.integration_secrets
  for select using (auth.uid() = profile_id);

create policy "integration_secrets_modify_self" on public.integration_secrets
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
```

## 4. Environment Variablen

Füge folgende Variablen zur `.env` bzw. `.env.local` hinzu:

```bash
VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=<public-anon-key>
```

Alternativ kann `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` verwendet werden, falls bereits vorhanden.

## 5. Hinweise zur Nutzung
- Agenten werden direkt in `agent_conversations` mit den Spalten `agent_name`, `agent_description`, `agent_avatar_url`, `agent_tools` und `agent_webhook_url` gespeichert.
- Nachrichtenverläufe liegen als JSON-Array in `messages`. Die Anwendung erwartet, dass `agent_tools` als JSON-Array von Strings gespeichert wird.
- Die UI erzeugt UUIDs clientseitig; Supabase muss daher keine Sequenzen bereitstellen.
- Für Administratorfunktionen können zusätzliche Policies erforderlich sein, wenn Admins auf fremde Profile zugreifen sollen.
