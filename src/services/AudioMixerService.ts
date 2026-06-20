import { LoggerService } from './LoggerService';

export class AudioMixerService {
  private audioCtx: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private musicSource: MediaElementAudioSourceNode | null = null;

  createMixer(): AudioContext {
    try {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioCtx = new AudioCtx();
          this.destination = this.audioCtx.createMediaStreamDestination();
        } else {
          throw new Error('AudioContext is not supported in this browser.');
        }
      }
      return this.audioCtx;
    } catch (error) {
      LoggerService.error({
        module: 'AudioMixerService',
        action: 'createMixer',
        error,
      });
      throw error;
    }
  }

  connectMicrophone(stream: MediaStream) {
    if (!this.audioCtx || !this.destination) return;
    try {
      if (this.micSource) {
        try {
          this.micSource.disconnect();
        } catch (e) {}
        this.micSource = null;
      }

      if (stream.getAudioTracks().length > 0) {
        this.micSource = this.audioCtx.createMediaStreamSource(stream);
        this.micSource.connect(this.destination);
      }
    } catch (error) {
      LoggerService.error({
        module: 'AudioMixerService',
        action: 'connectMicrophone',
        error,
      });
    }
  }

  connectMusic(audioElement: HTMLAudioElement) {
    if (!this.audioCtx || !this.destination) return;
    try {
      const el = audioElement as any;
      if (!el._sourceNode) {
        try {
          el._sourceNode = this.audioCtx.createMediaElementSource(audioElement);
        } catch (sourceErr) {
          LoggerService.error({
            module: 'AudioMixerService',
            action: 'connectMusic_createSource',
            error: sourceErr,
          });
          return;
        }
      }

      this.musicSource = el._sourceNode;

      try {
        this.musicSource?.disconnect();
      } catch (e) {}

      this.musicSource?.connect(this.destination);
      this.musicSource?.connect(this.audioCtx.destination); // Speaker output
    } catch (error) {
      LoggerService.error({
        module: 'AudioMixerService',
        action: 'connectMusic_general',
        error,
      });
    }
  }

  getMixedTracks(): MediaStreamTrack[] {
    return this.destination ? this.destination.stream.getAudioTracks() : [];
  }

  async resume(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (error) {
        LoggerService.error({
          module: 'AudioMixerService',
          action: 'resume',
          error,
        });
      }
    }
  }

  async destroy() {
    try {
      if (this.micSource) {
        try { this.micSource.disconnect(); } catch (e) {}
        this.micSource = null;
      }
      if (this.musicSource) {
        try { this.musicSource.disconnect(); } catch (e) {}
        this.musicSource = null;
      }
      if (this.audioCtx) {
        try {
          await this.audioCtx.close();
        } catch (e) {}
        this.audioCtx = null;
      }
      this.destination = null;
    } catch (error) {
      LoggerService.error({
        module: 'AudioMixerService',
        action: 'destroy',
        error,
      });
    }
  }
}
