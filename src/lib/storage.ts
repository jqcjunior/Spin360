import { supabase, isSupabaseConfigured } from './supabase';

export async function uploadFile(bucket: string, file: File): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error('As variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY não foram configuradas no painel do AI Studio.');
  }

  const ext = file.name.split('.').pop();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) throw new Error(`Upload para "${bucket}" falhou: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
