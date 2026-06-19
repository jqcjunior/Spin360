import { useEffect } from 'react';
import { SpinDb } from '../db';
import { supabase } from '../lib/supabase';

export default function useSupabaseSync() {
  useEffect(() => {
    const syncVideos = async () => {
      if (!navigator.onLine) return;

      const videos = SpinDb.getVideos();
      const pending = videos.filter((v: any) => v.url && v.url.startsWith('blob:'));

      for (const video of pending) {
        try {
          const response = await fetch(video.url);
          const blob = await response.blob();
          const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
          const filePath = `${video.eventId}/${video.slug}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('videos-processed')
            .upload(filePath, blob, { contentType: blob.type, upsert: true });

          if (uploadError) throw uploadError;

          const { data } = supabase.storage
            .from('videos-processed')
            .getPublicUrl(filePath);

          const publicUrl = data.publicUrl;

          // Salva registro no Supabase
          await supabase.from('videos').upsert({
            id: video.id,
            event_id: video.eventId,
            lead_id: video.leadId ?? null,
            public_slug: video.slug,
            processed_video_url: publicUrl,
            duration_seconds: video.duration ?? 10,
            status: 'completed',
            created_at: video.createdAt,
          } as any);

          // Atualiza localStorage com URL permanente
          SpinDb.saveVideo({ ...video, url: publicUrl, status: 'completed' });

          console.log(`[SYNC] ✅ ${video.slug} → ${publicUrl}`);
        } catch (err) {
          console.error(`[SYNC] ❌ ${video.slug}:`, err);
        }
      }
    };

    syncVideos();
    const id = setInterval(syncVideos, 15000);
    return () => clearInterval(id);
  }, []);
}
