/**
 * Sincroniza vídeos offline com o Supabase quando internet voltar
 */
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getPendingVideos, removePendingVideo } from '../lib/cache';
import { SpinDb } from '../db';

export default function useOfflineSync() {
  useEffect(() => {
    const sync = async () => {
      if (!navigator.onLine) return;
      const pending = await getPendingVideos();
      if (pending.length === 0) return;

      console.log(`[Sync] ${pending.length} vídeo(s) para sincronizar`);

      for (const { id, base64 } of pending) {
        try {
          // Reconstrói o blob
          const res = await fetch(base64);
          const blob = await res.blob();

          // Busca metadata do SpinDb
          const video = SpinDb.getVideos().find((v: any) => v.id === id);
          if (!video) { await removePendingVideo(id); continue; }

          const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
          const filePath = `${video.eventId}/${video.slug}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from('videos-processed')
            .upload(filePath, blob, { contentType: blob.type, upsert: true });

          if (!upErr) {
            const { data } = supabase.storage.from('videos-processed').getPublicUrl(filePath);
            const publicUrl = data.publicUrl;

            await (supabase.from('videos') as any).insert({
              id, event_id: video.eventId, lead_id: null,
              public_slug: video.slug, processed_video_url: publicUrl,
              duration_seconds: video.duration || 10, status: 'completed',
              created_at: video.createdAt, processed_at: new Date().toISOString(),
            });

            SpinDb.saveVideo({ ...video, url: publicUrl, status: 'completed' });
            await removePendingVideo(id);
            console.log(`[Sync] ✅ ${video.slug} sincronizado`);
          }
        } catch (err) {
          console.error(`[Sync] ❌ Erro ao sincronizar ${id}:`, err);
        }
      }
    };

    // Sincroniza ao montar e quando internet volta
    sync();
    window.addEventListener('online', sync);
    const interval = setInterval(sync, 30000);
    return () => {
      window.removeEventListener('online', sync);
      clearInterval(interval);
    };
  }, []);
}
