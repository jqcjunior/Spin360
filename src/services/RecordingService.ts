import { LoggerService } from './LoggerService';

export class RecordingService {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private onStopCallback: ((blob: Blob, mimeType: string) => void) | null = null;

  startRecording(
    stream: MediaStream,
    onStop: (blob: Blob, mimeType: string) => void
  ): MediaRecorder {
    try {
      this.chunks = [];
      this.onStopCallback = onStop;

      const mimeType = [
        'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
        'video/mp4;codecs="avc1.42E01E"',
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9,opus',
        'video/webm'
      ].find(t => MediaRecorder.isTypeSupported(t)) || '';

      const rec = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 2_500_000,
        audioBitsPerSecond: 128_000,
      });

      this.recorder = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      rec.onstop = () => {
        const finalMime = mimeType || 'video/webm';
        const blob = new Blob(this.chunks, { type: finalMime });

        console.log('[VIDEO_RENDER_COMPLETED]', {
          fileSize: blob.size,
          mimeType: finalMime,
        });
        LoggerService.log({
          module: 'RecordingService',
          action: 'VIDEO_RENDER_COMPLETED',
          metadata: { fileSize: blob.size, mimeType: finalMime }
        });

        if (this.onStopCallback) {
          this.onStopCallback(blob, finalMime);
        }
      };

      // CORREÇÃO APLICADA AQUI: Gravação contínua, sem fatiamento para o iOS
      rec.start();

      console.log('[MEDIA_RECORDER_STARTED]', {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });
      LoggerService.log({
        module: 'RecordingService',
        action: 'MEDIA_RECORDER_STARTED',
        metadata: { mimeType, videoBitsPerSecond: 2_500_000 }
      });

      return rec;
    } catch (error) {
      LoggerService.error({
        module: 'RecordingService',
        action: 'startRecording',
        error,
      });
      throw error;
    }
  }

  stopRecording() {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
        console.log('[MEDIA_RECORDER_STOPPED]');
        LoggerService.log({
          module: 'RecordingService',
          action: 'MEDIA_RECORDER_STOPPED',
        });
      } catch (error) {
        LoggerService.error({
          module: 'RecordingService',
          action: 'stopRecording',
          error,
        });
      }
    }
  }

  getActiveRecorder(): MediaRecorder | null {
    return this.recorder;
  }

  destroy() {
    this.stopRecording();
    this.recorder = null;
    this.chunks = [];
    this.onStopCallback = null;
  }
}
