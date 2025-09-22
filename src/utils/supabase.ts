import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL ist nicht gesetzt.');
}

if (!supabaseKey) {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ist nicht gesetzt.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
