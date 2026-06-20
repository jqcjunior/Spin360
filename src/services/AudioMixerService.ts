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

  // AJUSTE: Transformar a tag <audio> em um Buffer de Memória puro para o Safari
  connectMusic(audioElement: HTMLAudioElement) {
    if (!this.audioCtx || !this.destination) return;
    
    // Limpa execuções anteriores
    if (this.bufferSource) {
      try { this.bufferSource.disconnect(); } catch (e) {}
      this.bufferSource = null;
    }

    try {
      // 1. Mutamos o elemento original para não dar eco. Quem vai tocar a música agora é o Buffer.
      audioElement.muted = true;

      // 2. Criamos o carregador em memória
      const loadBuffer = async () => {
        if (!this.audioCtx || !this.destination) return;
        
        try {
          // Pega o arquivo que já está em cache local (blob)
          const response = await fetch(audioElement.src);
          const arrayBuffer = await response.arrayBuffer();
          
          // Decodifica o áudio blindado (Isso ignora os bloqueios do iOS)
          this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
          
          this.bufferSource = this.audioCtx.createBufferSource();
          this.bufferSource.buffer = this.audioBuffer;
          this.bufferSource.loop = audioElement.loop;
          
          // Conecta na gravação (destination) E nas caixas de som do celular (audioCtx.destination)
          this.bufferSource.connect(this.destination);
          this.bufferSource.connect(this.audioCtx.destination);
          
          this.bufferSource.start(0);
        } catch (err) {
          LoggerService.error({
            module: 'AudioMixerService',
            action: 'connectMusic_bufferDecode',
            error: err,
          });
          
          // Se o plano A falhar (ex: navegador muito antigo), volta para o plano B original
          this.fallbackConnectMusic(audioElement);
        }
      };

      loadBuffer();
    } catch (error) {
      LoggerService.error({
        module: 'AudioMixerService',
        action: 'connectMusic_general',
        error,
      });
      this.fallbackConnectMusic(audioElement);
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
