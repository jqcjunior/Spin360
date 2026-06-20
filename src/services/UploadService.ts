import { supabase } from '../lib/supabase';
import { SpinDb } from '../db';
import { LoggerService } from './LoggerService';

export interface UploadMetrics {
  uploadStatus: 'success' | 'failed' | 'pending';
  retryCount: number;
  uploadStartedAt: string;
  uploadFinishedAt?: string;
  uploadDuration?: number; // millseconds
}

export class UploadService {
  static async uploadVideo(
    eventId: string,
    videoId: string,
    slug: string,
    blob: Blob,
    duration: number,
    maxRetries = 3
  ): Promise<string> {
    const startedAt = new Date().toISOString();
    const startTime = performance.now();
    let retryCount = 0;
    let success = false;
    let publicUrl = '';

    // ==========================================
    // AJUSTE PARA IOS: Limpeza do MimeType e Blob
    // ==========================================
    const isMp4 = blob.type.includes('mp4');
    const cleanMime = isMp4 ? 'video/mp4' : 'video/webm';
    const ext = isMp4 ? 'mp4' : 'webm';
    
    // Recriamos o Blob puro para remover metadados de codec que travam o Safari
    const cleanBlob = new Blob([blob], { type: cleanMime });
    const path = `${eventId}/${slug}.${ext}`;

    while (retryCount < maxRetries && !success) {
      try {
        LoggerService.log({
          module: 'UploadService',
          action: 'uploadVideo_attempt',
          metadata: { eventId, videoId, slug, attempt: retryCount + 1 },
        });

        // Upload usando o cleanBlob e forçando o contentType estrito no Supabase
        const { error: upErr } = await supabase.storage
          .from('videos-processed')
          .upload(path, cleanBlob, { contentType: cleanMime, upsert: true });

        if (upErr) throw upErr;

        const { data } = supabase.storage.from('videos-processed').getPublicUrl(path);
        publicUrl = data.publicUrl;

        const { error: dbErr } = await (supabase.from('videos') as any).insert({
          id: videoId,
          event_id: eventId,
          lead_id: null,
          public_slug: slug,
          processed_video_url: publicUrl,
          duration_seconds: duration,
          status: 'completed',
          created_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
        });

        if (dbErr) throw dbErr;

        success = true;

        // Update local database
        const v = SpinDb.getVideos().find((x: any) => x.id === videoId);
        if (v) {
          SpinDb.saveVideo({ ...v, url: publicUrl, status: 'completed' });
        }

      } catch (error) {
        retryCount++;
        LoggerService.error({
          module: 'UploadService',
          action: `uploadVideo_failed_attempt_${retryCount}`,
          error,
          metadata: { eventId, videoId, slug },
        });

        if (retryCount >= maxRetries) {
          const finishedAt = new Date().toISOString();
          const endTime = performance.now();
          const durationMs = endTime - startTime;

          LoggerService.error({
            module: 'UploadService',
            action: 'uploadVideo_final_failure',
            error,
            metadata: {
              uploadStatus: 'failed',
              retryCount,
              uploadStartedAt: startedAt,
              uploadFinishedAt: finishedAt,
              uploadDuration: durationMs,
            } as UploadMetrics,
          });
          throw error;
        }
      }
    }

    const finishedAt = new Date().toISOString();
    const endTime = performance.now();
    const durationMs = endTime - startTime;

    LoggerService.log({
      module: 'UploadService',
      action: 'uploadVideo_success',
      metadata: {
        uploadStatus: 'success',
        retryCount,
        uploadStartedAt: startedAt,
        uploadFinishedAt: finishedAt,
        uploadDuration: durationMs,
      } as UploadMetrics,
    });

    return publicUrl;
  }
}