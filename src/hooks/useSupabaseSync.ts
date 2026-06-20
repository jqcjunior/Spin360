/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
          const contentType = blob.type.includes('mp4') ? 'video/mp4' : 'video/webm';
          const { error: uploadError } = await supabase.storage
            .from('videos-processed')
            .upload(filePath, blob, { contentType, upsert: true });
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('videos-processed').getPublicUrl(filePath);
          await (supabase.from('videos') as any).upsert({
            id: video.id, event_id: video.eventId, lead_id: video.leadId ?? null,
            public_slug: video.slug, processed_video_url: data.publicUrl,
            duration_seconds: video.duration ?? 10, status: 'completed',
            created_at: video.createdAt, processed_at: new Date().toISOString(),
          });
          SpinDb.saveVideo({ ...video, url: data.publicUrl, status: 'completed' });
          console.log(`[Sync] ✅ ${video.slug} → ${data.publicUrl}`);
        } catch (err) {
          console.error(`[Sync] ❌ ${video.slug}:`, err);
        }
      }
    };
    syncVideos();
    const id = setInterval(syncVideos, 15000);
    return () => clearInterval(id);
  }, []);
}
