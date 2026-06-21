import { LoggerService } from './LoggerService';

export class AudioMixerService {
  private audioCtx: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  
  // Guardamos a origem antiga para o fallback de segurança
  private musicSource: MediaElementAudioSourceNode | null = null;
  
  // Novas propriedades exclusivas para blindar o áudio no iOS (Buffer de Memória)
  private bufferSource: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;

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

  // AJUSTE: Carregar e decodificar a música em um Buffer de Memória antes de iniciar a gravação
  async preloadMusic(url: string): Promise<void> {
    try {
      this.createMixer();
      if (!this.audioCtx) return;

      LoggerService.log({
        module: 'AudioMixerService',
        action: 'preloadMusic_started',
        metadata: { url }
      });

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);

      LoggerService.log({
        module: 'AudioMixerService',
        action: 'preloadMusic_completed',
        metadata: { duration: this.audioBuffer.duration }
      });
    } catch (error) {
      LoggerService.error({
        module: 'AudioMixerService',
        action: 'preloadMusic_failed',
        error
      });
    }
  }

  // Toca a música usando o Buffer decodificado, com fallback para reprodução direta caso falhe
  startMusic(audioElement?: HTMLAudioElement, loop: boolean = true) {
    if (!this.audioCtx || !this.destination) return;

    // Se temos o Buffer decodificado, iniciamos a reprodução digital sem atraso
    if (this.audioBuffer) {
      if (this.bufferSource) {
        try { this.bufferSource.stop(); } catch (e) {}
        try { this.bufferSource.disconnect(); } catch (e) {}
        this.bufferSource = null;
      }

      this.bufferSource = this.audioCtx.createBufferSource();
      this.bufferSource.buffer = this.audioBuffer;
      this.bufferSource.loop = loop;

      // Conecta no gravador e nas caixas de som do dispositivo
      this.bufferSource.connect(this.destination);
      this.bufferSource.connect(this.audioCtx.destination);

      LoggerService.log({
        module: 'AudioMixerService',
        action: 'startMusic_buffer_started',
      });
      
      this.bufferSource.start(0);

      if (audioElement) {
        audioElement.muted = true;
        try { audioElement.pause(); } catch (e) {}
      }
    } else if (audioElement) {
      // Se não houver Buffer carregado, recorre ao método legado do Elemento de Áudio
      LoggerService.log({
        module: 'AudioMixerService',
        action: 'startMusic_fallback_mediaelement',
      });
      this.fallbackConnectMusic(audioElement);
      audioElement.play().catch(e => {
        LoggerService.error({
          module: 'AudioMixerService',
          action: 'startMusic_fallback_play_failed',
          error: e
        });
      });
    }
  }

  // Mantido intacto como plano B (Fallback)
  private fallbackConnectMusic(audioElement: HTMLAudioElement) {
    if (!this.audioCtx || !this.destination) return;
    try {
      audioElement.muted = false; 
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
      this.musicSource?.connect(this.audioCtx.destination);
    } catch (error) {
      LoggerService.error({
        module: 'AudioMixerService',
        action: 'fallbackConnectMusic',
        error,
      });
    }
  }

  // Interrompe a reprodução da música de forma limpa
  stopMusic(audioElement?: HTMLAudioElement) {
    if (this.bufferSource) {
      try { this.bufferSource.stop(); } catch (e) {}
      try { this.bufferSource.disconnect(); } catch (e) {}
      this.bufferSource = null;
    }
    if (audioElement) {
      try { audioElement.pause(); } catch (e) {}
    }
    LoggerService.log({
      module: 'AudioMixerService',
      action: 'stopMusic_completed',
    });
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
      if (this.bufferSource) {
        try { this.bufferSource.disconnect(); } catch (e) {}
        this.bufferSource = null;
      }
      this.audioBuffer = null;

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