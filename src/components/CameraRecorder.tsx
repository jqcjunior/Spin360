import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, RefreshCw, Camera, Music } from 'lucide-react';
import { Event, VideoLead, VideoRecord } from '../types';
import { SpinDb, DEMO_FRAMES_SVG } from '../db';

// ==========================================
// INDEXEDDB DURA PERSISTENCE ENGINE
// ==========================================
const DB_NAME = 'Spin360_PersistentDB';
const DB_VERSION = 1;
const STORE_NAME = 'videos_blob';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVideoBlobsToIndexedDB(id: string, videoBlob: Blob, thumbnailBlob: Blob): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id, videoBlob, thumbnailBlob });
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('[IndexedDB] erro ao salvar blobs:', err);
  }
}

export async function restoreVideoUrls(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    const records = await new Promise<any[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!records || records.length === 0) return;

    // Load current videos from localStorage
    const rawVideos = localStorage.getItem('spin360_videos');
    if (!rawVideos) return;
    const videos = JSON.parse(rawVideos) as VideoRecord[];

    let updated = false;
    records.forEach((rec) => {
      const video = videos.find((v) => v.id === rec.id);
      if (video) {
        // Create new active object URL for the session
        video.url = URL.createObjectURL(rec.videoBlob);
        if (rec.thumbnailBlob && rec.thumbnailBlob.size > 0) {
          video.thumbnailUrl = URL.createObjectURL(rec.thumbnailBlob);
        }
        updated = true;
      }
    });

    if (updated) {
      localStorage.setItem('spin360_videos', JSON.stringify(videos));
    }
  } catch (err) {
    console.error('[IndexedDB] erro ao restaurar URLs persistentes:', err);
  }
}

// Auto-run immediately when the module is imported in App.tsx
restoreVideoUrls();

// Helper to preload Image from URL or raw SVG markup
const preloadOverlayImage = (urlOrSvgKey: string): Promise<HTMLImageElement> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // preserve clean canvas
    if (urlOrSvgKey.startsWith('http')) {
      img.src = urlOrSvgKey;
    } else {
      const svgString = DEMO_FRAMES_SVG[urlOrSvgKey] || '';
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      img.src = URL.createObjectURL(blob);
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Return a safe empty transparent Pixel canvas image on failure
      const canvasFallback = document.createElement('canvas');
      canvasFallback.width = 1;
      canvasFallback.height = 1;
      const fallbackImg = new Image();
      fallbackImg.src = canvasFallback.toDataURL();
      fallbackImg.onload = () => resolve(fallbackImg);
    };
  });
};

interface CameraRecorderProps {
  event: Event;
  lead: VideoLead | null;
  onRecordingComplete: (video: VideoRecord) => void;
  onCancel: () => void;
}

type RecorderState = 'requesting' | 'preview' | 'countdown' | 'recording' | 'processing';

export default function CameraRecorder({ event, lead, onRecordingComplete, onCancel }: CameraRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [recState, setRecState] = useState<RecorderState>('requesting');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(event.videoDuration);
  const [error, setError] = useState<string | null>(null);

  // Background audio preview during front countdown / recording vibe
  const [liveAudio, setLiveAudio] = useState<HTMLAudioElement | null>(null);

  const frame = SpinDb.getFrames().find(f => f.id === event.frameId);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (liveAudio) {
      liveAudio.pause();
      liveAudio.src = '';
    }
  }, [liveAudio]);

  const startCamera = useCallback(async () => {
    setError(null);
    setRecState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRecState('preview');
    } catch {
      setError('Permissão de câmera negada. Toque para tentar novamente.');
      setRecState('requesting');
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopStream();
  }, [startCamera, stopStream]);

  // Pre-instantiate Live Background music for high-energy recording vibe
  useEffect(() => {
    const track = SpinDb.getMusicTracks().find(t => t.id === event.musicId);
    if (track) {
      const audio = new Audio(track.audioUrl);
      audio.crossOrigin = 'anonymous';
      audio.loop = track.loop;
      audio.volume = track.volume || 0.8;
      setLiveAudio(audio);
    }
    return () => {
      if (liveAudio) {
        liveAudio.pause();
        liveAudio.src = '';
      }
    };
  }, [event.musicId]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    // Start live music synchronized playback
    if (liveAudio) {
      const track = SpinDb.getMusicTracks().find(t => t.id === event.musicId);
      liveAudio.currentTime = track?.startPoint || 0;
      liveAudio.play().catch(e => console.warn('Falha no autoplay de audio de preview:', e));
    }

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      if (liveAudio) {
        liveAudio.pause();
      }
      const rawBlob = new Blob(chunksRef.current, { type: mimeType });
      setRecState('processing');
      try {
        await finishProcessing(rawBlob);
      } catch (err) {
        console.error('Falha no pipeline de renderização profissional:', err);
        // Fallback clean para gravação crua em caso de falha crítica de WebGL/AudioContext
        fallbackRawSave(rawBlob);
      }
    };

    recorder.start(100);
    setRecState('recording');
    setTimeLeft(event.videoDuration);

    let remaining = event.videoDuration;
    timerRef.current = setInterval(() => {
      remaining--;
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        recorder.stop();
      }
    }, 1000);
  }, [event.videoDuration, liveAudio, event.musicId]);

  // Fallback em caso de erro extremo no Canvas
  const fallbackRawSave = (rawBlob: Blob) => {
    const url = URL.createObjectURL(rawBlob);
    const id = 'vid_' + Date.now();
    const slug = Math.random().toString(36).slice(2, 7);

    const video: VideoRecord = {
      id,
      slug,
      eventId: event.id,
      leadId: lead?.id,
      url,
      thumbnailUrl: '',
      duration: event.videoDuration,
      status: 'completed',
      effectAppliedId: event.effectPresetId,
      frameAppliedId: event.frameId,
      musicAppliedId: event.musicId,
      viewsCount: 0,
      downloadsCount: 0,
      sharesCount: 0,
      createdAt: new Date().toISOString(),
    };

    const friendlyDate = new Date().toISOString().slice(0, 10);
    const cleanName = event.name.replace(/[^a-zA-Z0-9]/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `Spin360_${cleanName}_${friendlyDate}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    SpinDb.saveVideo(video);
    stopStream();
    setTimeout(() => onRecordingComplete(video), 300);
  };

  // Canvas-render professional pipeline
  const finishProcessing = async (rawVideoBlob: Blob) => {
    // 1. Carregar video crú de background de modo offline
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.src = URL.createObjectURL(rawVideoBlob);
    await new Promise((r) => { video.onloadedmetadata = r; });

    // 2. Setup Canvas com formato rígido de Totem 360 / Stories 1080x1920
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d')!;

    // Preload overlays vectoriais (molduras) e logos dos patrocinadores
    const frameImg = await preloadOverlayImage(frame?.imageUrl || 'cyberpunk');
    const loadedSponsors = SpinDb.getSponsors().filter(s => event.sponsorIds?.includes(s.id));
    const sponsorImages = await Promise.all(
      loadedSponsors.map(async (s) => {
        const img = await preloadOverlayImage(s.logoUrl);
        const config = event.sponsorsConfig?.[s.id] || { position: 'bottom_right', order: 1 };
        return { img, position: config.position };
      })
    );

    // 3. Configurar contexto de Audio para mixagem de microfone residual e música de estúdio
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();

    // Hook audio do video gravado (fala residual/ruído do totem)
    try {
      const source = audioCtx.createMediaElementSource(video);
      const videoGain = audioCtx.createGain();
      videoGain.gain.value = 0.2; // 20% volume residual para autenticidade
      source.connect(videoGain);
      videoGain.connect(dest);
    } catch (_) {}

    // Track de som do evento de fundo com fade loops
    let musicAudio: HTMLAudioElement | null = null;
    const musicTrack = SpinDb.getMusicTracks().find(t => t.id === event.musicId);
    if (musicTrack) {
      try {
        musicAudio = new Audio(musicTrack.audioUrl);
        musicAudio.crossOrigin = 'anonymous';
        musicAudio.loop = musicTrack.loop;
        musicAudio.volume = musicTrack.volume || 0.8;
        musicAudio.currentTime = musicTrack.startPoint || 0;

        const musicSource = audioCtx.createMediaElementSource(musicAudio);
        const musicGain = audioCtx.createGain();
        musicGain.gain.value = musicTrack.volume || 0.8;

        const cur = audioCtx.currentTime;
        musicGain.gain.setValueAtTime(0, cur);
        musicGain.gain.linearRampToValueAtTime(musicTrack.volume || 0.8, cur + (musicTrack.fadeIn || 1));

        musicSource.connect(musicGain);
        musicGain.connect(dest);
      } catch (_) {}
    }

    // 4. Iniciar novo codificador de mídia para salvar o Canvas composto com audio masterizado
    const canvasStream = canvas.captureStream(30);
    const mixedStream = new MediaStream();
    mixedStream.addTrack(canvasStream.getVideoTracks()[0]);
    if (dest.stream.getAudioTracks().length > 0) {
      mixedStream.addTrack(dest.stream.getAudioTracks()[0]);
    }

    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const outputRecorder = new MediaRecorder(mixedStream, { mimeType });
    const outputChunks: Blob[] = [];

    outputRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) outputChunks.push(e.data);
    };

    let capturedThumbnailBlob: Blob | null = null;
    let resolveOuter: any = null;
    const promiseComplete = new Promise<{ videoBlob: Blob, thumbnailBlob: Blob }>((res) => {
      resolveOuter = res;
    });

    outputRecorder.onstop = () => {
      const videoBlob = new Blob(outputChunks, { type: mimeType });
      resolveOuter({
        videoBlob,
        thumbnailBlob: capturedThumbnailBlob || new Blob([], { type: 'image/jpeg' })
      });
    };

    // 5. Iniciar Renderizadores e playbacks
    if (musicAudio) {
      musicAudio.play().catch(() => {});
    }
    outputRecorder.start();
    video.currentTime = 0;

    // Timeline física do preset de velocidade
    let playbackTime = 0;
    let rawTime = 0;
    const fps = 30;
    const dt = 1 / fps;
    const preset = SpinDb.getEffectPresets().find(p => p.id === event.effectPresetId);

    const renderNextFrame = async () => {
      // Calcular velocidade linear da CPU
      let speed = 1.0;
      if (preset && preset.steps) {
        let accum = 0;
        for (const step of preset.steps) {
          if (playbackTime >= accum && playbackTime < accum + step.duration) {
            speed = step.speed;
            break;
          }
          accum += step.duration;
        }
      }

      // Sincronizar seek no vídeo bruto
      video.currentTime = rawTime;
      await new Promise((r) => { video.onseeked = r; });

      // Desenhar frame do participante espelhado no canvas 1080x1920 (stories aspect-ratio)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const dx = (canvas.width - video.videoWidth * scale) / 2;
      const dy = (canvas.height - video.videoHeight * scale) / 2;
      ctx.drawImage(video, -dx, dy, video.videoWidth * scale, video.videoHeight * scale);
      ctx.restore();

      // Desenhar moldura por cima
      if (frameImg) {
        ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
      }

      // Desenhar logos nos cantos
      if (sponsorImages.length > 0) {
        sponsorImages.forEach(({ img, position }) => {
          const maxW = 160;
          const maxH = 80;
          let w = img.width;
          let h = img.height;
          const ratio = Math.min(maxW / w, maxH / h);
          w *= ratio;
          h *= ratio;

          let sx = 70;
          let sy = 1780 - h;

          if (position === 'top_left') {
            sx = 70;
            sy = 140;
          } else if (position === 'top_right') {
            sx = 1010 - w;
            sy = 140;
          } else if (position === 'bottom_left') {
            sx = 70;
            sy = 1780 - h;
          } else if (position === 'bottom_right') {
            sx = 1010 - w;
            sy = 1780 - h;
          } else if (position === 'center') {
            sx = (1080 - w) / 2;
            sy = (1920 - h) / 2;
          }

          // Badge branca arredondada de apoio
          const pad = 12;
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.3)';
          ctx.shadowBlur = 10;
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          const blockX = sx - pad;
          const blockY = sy - pad;
          const blockW = w + pad * 2;
          const blockH = h + pad * 2;
          const r = 16;
          // draw path
          ctx.beginPath();
          ctx.moveTo(blockX + r, blockY);
          ctx.lineTo(blockX + blockW - r, blockY);
          ctx.quadraticCurveTo(blockX + blockW, blockY, blockX + blockW, blockY + r);
          ctx.lineTo(blockX + blockW, blockY + blockH - r);
          ctx.quadraticCurveTo(blockX + blockW, blockY + blockH, blockX + blockW - r, blockY + blockH);
          ctx.lineTo(blockX + r, blockY + blockH);
          ctx.quadraticCurveTo(blockX, blockY + blockH, blockX, blockY + blockH - r);
          ctx.lineTo(blockX, blockY + r);
          ctx.quadraticCurveTo(blockX, blockY, blockX + r, blockY);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Logo por cima
          ctx.drawImage(img, sx, sy, w, h);
        });
      }

      // Desenhar marca d'água Spin360
      ctx.save();
      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText('⚡ SPIN360', 540, 1890);
      ctx.restore();

      // Capturar imagem de miniatura no meio do vídeo
      if (!capturedThumbnailBlob && rawTime >= video.duration / 2) {
        await new Promise<void>((r) => {
          canvas.toBlob((b) => {
            capturedThumbnailBlob = b;
            r();
          }, 'image/jpeg', 0.8);
        });
      }

      // Atualizar relógio físico
      rawTime += dt * speed;
      playbackTime += dt;

      if (rawTime < video.duration && playbackTime < event.videoDuration) {
        // Continuar frame seguinte
        setTimeout(renderNextFrame, 12);
      } else {
        // Parar processamento e exportar
        if (musicAudio) {
          musicAudio.pause();
          musicAudio.src = '';
        }
        outputRecorder.stop();
        audioCtx.close();
      }
    };

    // Tocar renderizador frame a frame de altíssima nitidez
    renderNextFrame();

    // Esperar finalizar gravação final do canvas
    const { videoBlob, thumbnailBlob } = await promiseComplete;

    // Gerar URLs locais de cache de sessão
    const videoUrl = URL.createObjectURL(videoBlob);
    const thumbUrl = thumbnailBlob.size > 0 ? URL.createObjectURL(thumbnailBlob) : '';

    const id = 'vid_' + Date.now();
    const slug = Math.random().toString(36).slice(2, 7);

    // Salvar blobs de forma permanente e irrecuperável no IndexedDB
    await saveVideoBlobsToIndexedDB(id, videoBlob, thumbnailBlob);

    // Gravar o registro final no banco offline para o feed da galeria
    const compiledVideo: VideoRecord = {
      id,
      slug,
      eventId: event.id,
      leadId: lead?.id,
      url: videoUrl,
      thumbnailUrl: thumbUrl,
      duration: event.videoDuration,
      status: 'completed',
      effectAppliedId: event.effectPresetId,
      frameAppliedId: event.frameId,
      musicAppliedId: event.musicId,
      viewsCount: 0,
      downloadsCount: 0,
      sharesCount: 0,
      createdAt: new Date().toISOString(),
    };

    // Acionar download do arquivo físico com formatação nobre
    const friendlyDate = new Date().toISOString().slice(0, 10);
    const cleanName = event.name.replace(/[^a-zA-Z0-9]/g, '_');
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `Spin360_${cleanName}_${friendlyDate}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    SpinDb.saveVideo(compiledVideo);
    stopStream();
    setTimeout(() => onRecordingComplete(compiledVideo), 300);
  };

  const startCountdown = useCallback(() => {
    setRecState('countdown');
    let count = 3;
    setCountdown(count);
    const t = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) { clearInterval(t); startRecording(); }
    }, 1000);
  }, [startRecording]);

  const stopEarly = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleCancel = () => { stopStream(); onCancel(); };

  const renderFrame = () => {
    if (!frame) return null;
    if (frame.imageUrl.startsWith('http')) {
      return <img src={frame.imageUrl} alt="frame" className="absolute inset-0 w-full h-full object-cover pointer-events-none z-20" />;
    }
    return (
      <div className="absolute inset-0 pointer-events-none z-20"
        dangerouslySetInnerHTML={{ __html: DEMO_FRAMES_SVG[frame.imageUrl] || '' }} />
    );
  };

  const progress = ((event.videoDuration - timeLeft) / event.videoDuration) * 100;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">

      {/* Câmera + overlays */}
      <div className="relative flex-1 overflow-hidden">

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Moldura de visualização */}
        {renderFrame()}

        {/* Erro / Permissão */}
        {(recState === 'requesting' || error) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/80 p-8 text-center space-y-6">
            <Camera className="w-20 h-20 text-slate-500" />
            <p className="text-white font-bold text-xl">
              {error || 'Solicitando acesso à câmera...'}
            </p>
            {error && (
              <button onClick={startCamera}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-lg">
                Tentar Novamente
              </button>
            )}
          </div>
        )}

        {/* Contagem regressiva de estúdio */}
        {recState === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/30">
            <span className="text-[160px] font-black text-white drop-shadow-2xl leading-none animate-pulse">
              {countdown === 0 ? '🎬' : countdown}
            </span>
          </div>
        )}

        {/* Processando e compilando em tempo real */}
        {recState === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/85 space-y-4">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-extrabold text-xl font-display">PROCESSANDO VÍDEO...</p>
            <p className="text-slate-400 text-xs font-mono max-w-[240px] text-center">
              Renderizando efeitos, música e molduras em qualidade máxima (1080x1920)
            </p>
          </div>
        )}

        {/* HUD de gravação */}
        {recState === 'recording' && (
          <div className="absolute top-6 left-0 right-0 flex justify-between items-center px-5 z-30">
            <div className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-full shadow-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              <span className="text-white text-sm font-bold font-mono">
                {event.videoDuration - timeLeft + 1}S / {event.videoDuration}S
              </span>
            </div>
            {event.musicId && (
              <div className="bg-indigo-600/90 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-white animate-spin" />
                <span className="text-white text-[11px] font-bold font-mono uppercase">Música Ativa</span>
              </div>
            )}
          </div>
        )}

        {/* Barra de progresso */}
        {recState === 'recording' && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800 z-30">
            <div className="h-full bg-red-500 transition-all duration-1000"
              style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Botão fechar */}
        {(recState === 'preview' || recState === 'countdown') && (
          <div className="absolute top-6 right-5 z-40">
            <button onClick={handleCancel}
              className="w-11 h-11 bg-black/50 backdrop-blur rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Controles inferiores */}
      <div className="bg-black py-10 flex items-center justify-center gap-8 z-30 safe-area-bottom">

        {recState === 'preview' && (
          <>
            <button onClick={handleCancel}
              className="w-14 h-14 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center">
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Botão gravar */}
            <button onClick={startCountdown}
              className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-red-500 active:scale-95 transition-transform">
              <div className="w-16 h-16 bg-red-500 rounded-full" />
            </button>

            <button onClick={startCamera}
              className="w-14 h-14 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-white" />
            </button>
          </>
        )}

        {recState === 'recording' && (
          <button onClick={stopEarly}
            className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-red-500 active:scale-95 transition-transform">
            <div className="w-10 h-10 bg-red-500 rounded-md" />
          </button>
        )}
      </div>
    </div>
  );
}
