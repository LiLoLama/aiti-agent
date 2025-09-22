/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: https://tlkynjfknlulwijbgsne.supabase.co;
  readonly VITE_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsa3luamZrbmx1bHdpamJnc25lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1Mzg0NTUsImV4cCI6MjA3NDExNDQ1NX0.a-XNXrQMfc3Pj0P8qxped1SbmnoQeML0QfhRNWLGBrY;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
