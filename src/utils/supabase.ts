import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL und Public Key müssen in der .env Datei gesetzt sein.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
