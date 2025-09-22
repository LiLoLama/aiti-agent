# aiti-agent

## Supabase Konfiguration

Lege in einer `.env`-Datei im Projektstamm die folgenden Variablen an, damit der Supabase Client korrekt initialisiert wird:

```
VITE_SUPABASE_URL=<deine Supabase URL>
VITE_SUPABASE_ANON_KEY=<dein Supabase Anon Key>
```

Vite macht diese Werte zur Build-Zeit unter `import.meta.env` verfügbar. Stelle sicher, dass die `.env`-Datei nicht eingecheckt wird.
