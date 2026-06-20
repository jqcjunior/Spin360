import { LoggerService } from './LoggerService';

export class CameraService {
  private stream: MediaStream | null = null;

  async startCamera(): Promise<MediaStream> {
    try {
      this.stopCamera();

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });

      return this.stream;
    } catch (error) {
      LoggerService.error({
        module: 'CameraService',
        action: 'startCamera',
        error,
      });
      throw error;
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (error) {
          LoggerService.error({
            module: 'CameraService',
            action: 'stopCamera_track',
            error,
          });
        }
      });
      this.stream = null;
    }
  }

  getStream(): MediaStream | null {
    return this.stream;
  }
}
