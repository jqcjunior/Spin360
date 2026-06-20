import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { Event, VideoLead, VideoRecord } from '../types';
import { SpinDb } from '../db';
import { supabase } from '../lib/supabase';
import { getAsset } from '../lib/cache';

// Services
import { LoggerService } from '../services/LoggerService';
import { CameraService } from '../services/CameraService';
import { AudioMixerService } from '../services/AudioMixerService';
import { RecordingService } from '../services/RecordingService';
import { UploadService } from '../services/UploadService';

interface Props {
  event: Event;
  lead: VideoLead | null;
  onRecordingComplete: (video: VideoRecord) => void;
  onCancel: () => void;
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// 1. Resolução otimizada para evitar travamentos em aparelhos intermediários
const REC_W = 720;
const REC_H = 1280;

export default function CameraRecorder({ event, lead, onRecordingComplete, onCancel }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const audioElRef    = useRef<HTMLAudioElement>(null);
  const frameImgRef   = useRef<HTMLImageElement | null>(null);
  const animRef       = useRef<number | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const timerRef      = useRef<any>(null);
  const safetyRef     = useRef<any>(null);
  const createdUrlsRef = useRef<string[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);

  // Instâncias de Serviços segregados
  const cameraServiceRef     = useRef<CameraService | null>(null);
  const audioMixerServiceRef = useRef<AudioMixerService | null>(null);
  const recordingServiceRef  = useRef<RecordingService | null>(null);

  if (!cameraServiceRef.current) cameraServiceRef.current = new CameraService();
  if (!audioMixerServiceRef.current) audioMixerServiceRef.current = new AudioMixerService();
  if (!recordingServiceRef.current) recordingServiceRef.current = new RecordingService();

  const duration = event.videoDuration || 10;

  const [phase, setPhase]         = useState<'loading' | 'ready' | 'countdown' | 'recording' | 'saving'>('loading');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft]   = useState(duration);
  const [camError, setCamError]   = useState(false);
  const [frameUrl, setFrameUrl]   = useState<string | null>(null);

  // ── Limpeza ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (animRef.current)   cancelAnimationFrame(animRef.current);
    if (timerRef.current)  clearTimeout(timerRef.current);
    if (safetyRef.current) clearTimeout(safetyRef.current);
    recordingStartTimeRef.current = null;

    // Resgatar tracks e fechar câmera
    cameraServiceRef.current?.stopCamera();
    streamRef.current = null;
    
    try { audioElRef.current?.pause(); } 
    catch (e) {
      LoggerService.error({
        module: 'CameraRecorder',
        action: 'cleanup_pauseAudio',
        error: e,
      });
    }

    // Encerrar o Mixer de Áudio para evitar leaks de memória ("limit exceeded" no Safari)
    audioMixerServiceRef.current?.destroy();

    // Revogar URLs de Object URLs temporários criados
    createdUrlsRef.current.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        LoggerService.error({
          module: 'CameraRecorder',
          action: 'cleanup_revokeUrl',
          error: e,
        });
      }
    });
    createdUrlsRef.current = [];
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Carrega assets ───────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      // Frame
      if (event.frameId) {
        try {
          const local = SpinDb.getFrames().find((f: any) => f.id === event.frameId);
          let url = local?.imageUrl || null;
          if (!url) {
            const { data } = await supabase.from('frames').select('image_url').eq('id', event.frameId).single();
            url = data?.image_url || null;
          }
          if (url?.startsWith('http')) {
            const src = await getAsset(`frame_${event.frameId}`, url);
            const img = new Image();
            if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
            img.src = src;
            await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); });
            if (img.naturalWidth > 0) {
              frameImgRef.current = img;
              setFrameUrl(src);
            }
          }
        } catch (e) {
          LoggerService.error({
            module: 'CameraRecorder',
            action: 'load_frame',
            error: e,
          });
        }
      }

      // Música
      if (event.musicId && audioElRef.current) {
        try {
          const local = SpinDb.getMusicTracks().find((t: any) => t.id === event.musicId);
          let url = local?.audioUrl || null;
          if (!url) {
            const { data } = await supabase.from('music_tracks').select('file_url').eq('id', event.musicId).single();
            url = data?.file_url || null;
          }
          if (url) {
            const src = await getAsset(`music_${event.musicId}`, url);
            audioElRef.current.src = src;
            audioElRef.current.loop = true;
            audioElRef.current.volume = 0.8;
          }
        } catch (e) {
          LoggerService.error({
            module: 'CameraRecorder',
            action: 'load_music',
            error: e,
          });
        }
      }

      setPhase('ready');
    };
    load();
  }, [event.frameId, event.musicId]);

  // ── Câmera e loop de desenho no Canvas ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready') return;
    let cancelled = false;

    cameraServiceRef.current?.startCamera()
      .then(stream => {
        if (cancelled) {
          cameraServiceRef.current?.stopCamera();
          return;
        }
        streamRef.current = stream;

        const vid = videoRef.current!;
        vid.srcObject = stream;
        vid.muted = true;
        vid.playsInline = true;
        vid.play().catch((e) => {
          LoggerService.error({
            module: 'CameraRecorder',
            action: 'play_preview_video',
            error: e,
          });
        });

        const canvas = canvasRef.current!;
        canvas.width  = REC_W;
        canvas.height = REC_H;
        const ctx = canvas.getContext('2d', { alpha: false })!;

        const draw = () => {
          if (cancelled) return;

          if (vid.readyState >= 2) {
            const vW = vid.videoWidth  || 1280;
            const vH = vid.videoHeight || 720;
            const scale   = Math.max(REC_W / vW, REC_H / vH);
            const drawW   = vW * scale;
            const drawH   = vH * scale;
            const offX    = (REC_W - drawW) / 2;
            const offY    = (REC_H - drawH) / 2;

            ctx.save();
            ctx.translate(REC_W, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(vid, offX, offY, drawW, drawH);
            ctx.restore();

            if (frameImgRef.current?.complete && frameImgRef.current.naturalWidth > 0) {
              ctx.drawImage(frameImgRef.current, 0, 0, REC_W, REC_H);
            }
          }
          animRef.current = requestAnimationFrame(draw);
        };
        draw();
        setCamError(false);
      })
      .catch((e) => {
        LoggerService.error({
          module: 'CameraRecorder',
          action: 'getUserMedia',
          error: e,
        });
        if (!cancelled) setCamError(true);
      });

    return () => { cancelled = true; };
  }, [phase]);

  // ── Para gravação ─────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (timerRef.current)  { clearTimeout(timerRef.current);  timerRef.current  = null; }
    if (safetyRef.current) { clearTimeout(safetyRef.current);  safetyRef.current = null; }
    recordingStartTimeRef.current = null;

    try { audioElRef.current?.pause(); } 
    catch (e) {
      LoggerService.error({
        module: 'CameraRecorder',
        action: 'stopRecording_pauseMusic',
        error: e,
      });
    }

    recordingServiceRef.current?.stopRecording();
  }, []);

  // ── Finaliza e sobe ───────────────────────────────────────────────────────
  const finish = useCallback(async (blob: Blob) => {
    setPhase('saving');
    const slug    = Math.random().toString(36).slice(2, 7);
    const videoId = uuid();
    const localUrl = URL.createObjectURL(blob);
    createdUrlsRef.current.push(localUrl);

    const record: VideoRecord = {
      id: videoId, slug, eventId: event.id, leadId: lead?.id,
      url: localUrl, thumbnailUrl: '', duration,
      status: 'pending',
      effectAppliedId: event.effectPresetId,
      frameAppliedId:  event.frameId,
      musicAppliedId:  event.musicId,
      viewsCount: 0, downloadsCount: 0, sharesCount: 0,
      createdAt: new Date().toISOString(),
    };

    SpinDb.saveVideo(record);
    cleanup();
    onRecordingComplete(record);

    if (navigator.onLine) {
      try {
        await UploadService.uploadVideo(event.id, videoId, slug, blob, duration);
      } catch (e) {
        LoggerService.error({
          module: 'CameraRecorder',
          action: 'background_upload',
          error: e,
        });
      }
    }
  }, [event, lead, duration, cleanup, onRecordingComplete]);

  // ── Inicia gravação ───────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    const stream = streamRef.current;
    if (!canvas || !stream) return;

    try {
      audioElRef.current?.play().catch((e) => {
        LoggerService.error({
          module: 'CameraRecorder',
          action: 'startRecording_playMusic',
          error: e,
        });
      });
    } catch (e) {
      LoggerService.error({
        module: 'CameraRecorder',
        action: 'startRecording_playMusic_general',
        error: e,
      });
    }

    let recordStream = stream;
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      let cs: MediaStream | null = null;
      try {
        // O PULO DO GATO: Se for iOS, nós nem tentamos capturar o Canvas, 
        // pois isso causa o congelamento (vídeo estático) no Safari.
        if (!isIOS) {
          cs = (canvas as any).captureStream(30) as MediaStream;
        }
      } catch (canvasErr) {
        LoggerService.error({
          module: 'CameraRecorder',
          action: 'canvas_captureStream',
          error: canvasErr,
        });
      }
      
      let mixedAudioTracks: MediaStreamTrack[] = [];
      const mixer = audioMixerServiceRef.current;

      if (mixer) {
        mixer.createMixer();
        if (audioElRef.current) {
          mixer.connectMusic(audioElRef.current);
        }
        mixedAudioTracks = mixer.getMixedTracks();
      }

      // Se for iOS, pega o vídeo limpo e direto da câmera (sem travar). 
      // Se for Android/PC, pega o vídeo com a moldura já desenhada no Canvas.
      const videoTracks = (!isIOS && cs && cs.getVideoTracks().length > 0) 
        ? cs.getVideoTracks() 
        : stream.getVideoTracks();

      // ÁUDIO: iOS usa o microfone para escutar a música do alto-falante. Outros usam o áudio digital.
      const rawAudioTracks = stream.getAudioTracks();
      const finalAudioTracks = (isIOS && rawAudioTracks.length > 0) 
        ? rawAudioTracks 
        : mixedAudioTracks;

      // Monta o stream unificado final, totalmente a prova de bugs da Apple
      recordStream = new MediaStream([
        ...videoTracks,
        ...finalAudioTracks
      ]);

    } catch (e) {
      LoggerService.error({
        module: 'CameraRecorder',
        action: 'build_recordStream',
        error: e,
      });
    }

    recordingServiceRef.current?.startRecording(recordStream, (blob) => {
      finish(blob);
    });

    setPhase('recording');
    setTimeLeft(duration);

    // Sistema de Timer de precisão baseado em performance.now()
    recordingStartTimeRef.current = performance.now();
    const runTimer = () => {
      if (recordingStartTimeRef.current === null) return;
      const elapsed = Math.floor((performance.now() - recordingStartTimeRef.current) / 1000);
      const rem = Math.max(0, duration - elapsed);
      setTimeLeft(rem);
      if (rem <= 0) {
        stopRecording();
      } else {
        timerRef.current = setTimeout(runTimer, 100);
      }
    };
    timerRef.current = setTimeout(runTimer, 100);

    safetyRef.current = setTimeout(() => stopRecording(), (duration + 3) * 1000);
  }, [duration, finish, stopRecording]);

  // ── Contagem ──────────────────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    // Destrava o áudio e o AudioContext no exato clique do usuário para driblar a trava da Apple
    if (audioElRef.current) {
      audioElRef.current.play().then(() => {
        audioElRef.current?.pause();
        audioElRef.current!.currentTime = 0;
      }).catch((e) => {
        LoggerService.error({
          module: 'CameraRecorder',
          action: 'destravar_audio_nativo',
          error: e,
        });
      });
    }

    const mixer = audioMixerServiceRef.current;
    if (mixer) {
      try {
        mixer.createMixer();
        mixer.resume().catch((e) => {
          LoggerService.error({
            module: 'CameraRecorder',
            action: 'resume_mixer',
            error: e,
          });
        });
      } catch (e) {
        LoggerService.error({
          module: 'CameraRecorder',
          action: 'startCountdown_mixer_setup',
          error: e,
        });
      }
    }

    setPhase('countdown');
    let c = 3; setCountdown(c);
    const t = setInterval(() => {
      c--; setCountdown(c);
      if (c <= 0) { clearInterval(t); startRecording(); }
    }, 1000);
  }, [startRecording]);

  const cancel = useCallback(() => {
    stopRecording(); cleanup(); onCancel();
  }, [stopRecording, cleanup, onCancel]);

  const progress = ((duration - timeLeft) / duration) * 100;

  return (
    <div className="fixed inset-0 z-[200] bg-black">
      <audio ref={audioElRef} playsInline crossOrigin="anonymous" />

      {/* Canvas OCULTO (Na tela, mas invisível para o Safari não congelar) */}
      <canvas ref={canvasRef} style={{ position: 'absolute', zIndex: -1, opacity: 0.01, pointerEvents: 'none' }} />

      {/* PREVIEW: vídeo com object-cover (correto em todos os dispositivos) */}
      <video
        ref={videoRef}
        autoPlay playsInline muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Moldura sobre o vídeo — object-cover funciona em img */}
      {frameUrl && (
        <img
          src={frameUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
        />
      )}

      {/* Loading */}
      {phase === 'loading' && (
        <div className="absolute inset-0 z-20 bg-black flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white text-sm font-mono">Preparando...</p>
        </div>
      )}

      {/* Erro câmera */}
      {camError && (
        <div className="absolute inset-0 z-20 bg-black/90 flex flex-col items-center justify-center gap-6 p-8 text-center">
          <p className="text-white font-bold text-xl">Câmera bloqueada</p>
          <button onClick={cancel} className="px-6 py-3 bg-slate-800 text-white rounded-2xl">Voltar</button>
        </div>
      )}

      {/* Contagem regressiva */}
      {phase === 'countdown' && (
        <div className="absolute inset-0 z-20 flex items-end justify-center pb-40 pointer-events-none">
          <div className="bg-black/60 backdrop-blur w-24 h-24 rounded-3xl flex items-center justify-center">
            <span className="text-white text-6xl font-black">{countdown}</span>
          </div>
        </div>
      )}

      {/* HUD gravação */}
      {phase === 'recording' && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* Badge GRAVANDO */}
          <div className="absolute top-8 left-5 flex items-center gap-2 bg-red-600 px-4 py-2 rounded-full pointer-events-none">
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
            <span className="text-white text-sm font-bold font-mono">GRAVANDO</span>
          </div>

          {/* Timer */}
          <div className="absolute top-8 right-20 bg-black/70 backdrop-blur px-4 py-2 rounded-2xl text-center">
            <p className="text-white text-3xl font-black font-mono leading-none">{timeLeft}</p>
            <p className="text-slate-400 text-[10px] font-mono">seg</p>
          </div>

          {/* Barra progresso */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/40">
            <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Salvando */}
      {phase === 'saving' && (
        <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white font-bold">Processando...</p>
        </div>
      )}

      {/* Botão X — sempre visível durante preview/countdown/recording */}
      {(phase === 'ready' || phase === 'countdown' || phase === 'recording') && (
        <button
          onClick={cancel}
          className="absolute top-8 z-30 w-12 h-12 bg-black/60 backdrop-blur rounded-full flex items-center justify-center"
          style={{ right: phase === 'recording' ? '8px' : '20px' }}>
          <X className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Controles */}
      <div className="absolute bottom-10 left-0 right-0 z-30 flex items-center justify-center gap-8">
        {phase === 'ready' && !camError && (
          <>
            <button onClick={cancel} className="w-14 h-14 bg-black/60 backdrop-blur rounded-full flex items-center justify-center">
              <X className="w-6 h-6 text-white" />
            </button>
            <button onClick={startCountdown} className="w-24 h-24 rounded-full bg-white border-4 border-red-500 flex items-center justify-center shadow-2xl active:scale-95 transition-transform">
              <div className="w-16 h-16 bg-red-500 rounded-full" />
            </button>
            <div className="w-14 h-14" />
          </>
        )}

        {phase === 'countdown' && (
          <div className="w-24 h-24 rounded-full bg-slate-800/50 border-4 border-slate-700 flex items-center justify-center">
            <div className="w-16 h-16 bg-slate-600 rounded-full" />
          </div>
        )}

        {phase === 'recording' && (
          <button
            onClick={stopRecording}
            className="w-24 h-24 rounded-full bg-white border-4 border-red-500 flex items-center justify-center shadow-2xl active:scale-95 transition-transform">
            <div className="w-10 h-10 bg-red-500 rounded-lg" />
          </button>
        )}
      </div>
    </div>
  );
}
