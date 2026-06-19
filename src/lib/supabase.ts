import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const rawKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;

const isValidUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = !!(rawUrl && rawKey && isValidUrl(rawUrl));

const supabaseUrl = isSupabaseConfigured ? rawUrl : 'https://tmp-placeholder-project.supabase.co';
const supabaseKey = isSupabaseConfigured ? rawKey : 'tmp-placeholder-key';

if (!isSupabaseConfigured) {
  console.warn('[Spin360] Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY não configuradas ou inválidas.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

