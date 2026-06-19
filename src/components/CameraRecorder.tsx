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
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
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
    try {
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
        console.warn('Falha no carregamento de overlay:', urlOrSvgKey);
        // Return a safe empty transparent Pixel canvas image on failure
        const canvasFallback = document.createElement('canvas');
        canvasFallback.width = 1;
        canvasFallback.height = 1;
        const fallbackImg = new Image();
        fallbackImg.src = canvasFallback.toDataURL();
        fallbackImg.onload = () => resolve(fallbackImg);
      };
    } catch (e) {
      console.error('Erro de pre-load geral:', e);
      const canvasFallback = document.createElement('canvas');
      canvasFallback.width = 1;
      canvasFallback.height = 1;
      const fallbackImg = new Image();
      fallbackImg.src = canvasFallback.toDataURL();
      fallbackImg.onload = () => resolve(fallbackImg);
    }
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [recState, setRecState] = useState<RecorderState>('requesting');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(event.videoDuration);
  const [error, setError] = useState<string | null>(null);

  // Preloaded assets state
  const [frameImg, setFrameImg] = useState<HTMLImageElement | null>(null);
  const [sponsorImages, setSponsorImages] = useState<{ img: HTMLImageElement; position: string }[]>([]);

  // Ref audio setup inside recording session
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioContextRef = useRef<AudioContext | null>(null);

  const frame = SpinDb.getFrames().find(f => f.id === event.frameId);

  // 1. Asset preload on mount
  useEffect(() => {
    let active = true;
    const preloadAssets = async () => {
      console.log('[STEP 2] Carregando frame SVG de fundo e logos');
      if (frame) {
        try {
          const loadedImg = await preloadOverlayImage(frame.imageUrl);
          if (active) setFrameImg(loadedImg);
        } catch (e) {
          console.error('[STEP 2] Erro ao pre-carregar frame:', e);
        }
      }

      console.log('[STEP 3] Carregando patrocinadores da ativação');
      const loadedSponsors = SpinDb.getSponsors().filter(s => event.sponsorIds?.includes(s.id));
      try {
        const list = await Promise.all(
          loadedSponsors.map(async (s) => {
            const img = await preloadOverlayImage(s.logoUrl);
            const config = event.sponsorsConfig?.[s.id] || { position: 'bottom_right', order: 1 };
            return { img, position: config.position };
          })
        );
        if (active) setSponsorImages(list);
      } catch (e) {
        console.error('[STEP 3] Erro ao pre-carregar patrocinadores:', e);
      }
    };

    preloadAssets();
    return () => {
      active = false;
    };
  }, [event, frame]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = '';
      } catch (_) {}
    }
    if (activeAudioContextRef.current) {
      try {
        activeAudioContextRef.current.close();
      } catch (_) {}
    }
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setRecState('requesting');
    try {
      console.log('[STEP 1] Iniciando renderização - Setup câmera hardware');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: false,
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

  // Real-time canvas draw loop - burns frame overlay, logos and watermark directly on canvas stream
  useEffect(() => {
    let active = true;
    const drawLoop = () => {
      if (!active) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && recState !== 'requesting') {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // 1. Draw Mirror flipped live camera view
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
            const dx = (canvas.width - video.videoWidth * scale) / 2;
            const dy = (canvas.height - video.videoHeight * scale) / 2;
            ctx.drawImage(video, -dx, dy, video.videoWidth * scale, video.videoHeight * scale);
          }
          ctx.restore();

          // 2. Draw Vector/SVG Frame overlay
          if (frameImg) {
            ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
          }

          // 3. Draw Brand Sponsors live
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

              // Background badge for logos
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

              // Draw logo
              ctx.drawImage(img, sx, sy, w, h);
            });
          }

          // 4. Draw Watermark Spin360
          ctx.save();
          ctx.font = 'bold 22px monospace';
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 4;
          ctx.fillText('⚡ SPIN360', 540, 1890);
          ctx.restore();
        }
      }

      animationFrameRef.current = requestAnimationFrame(drawLoop);
    };

    if (recState !== 'requesting') {
      animationFrameRef.current = requestAnimationFrame(drawLoop);
    }

    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [recState, frameImg, sponsorImages]);

  // Fallback save in case of high-level Canvas failure
  const fallbackRawSave = (rawBlob: Blob) => {
    try {
      console.log('[STEP 10] Acionando fallback bruto de segurança');
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

      SpinDb.saveVideo(video);
      stopStream();
      setTimeout(() => onRecordingComplete(video), 300);
    } catch (errFallback) {
      console.error('Erro crítico no fallback bruto integrado:', errFallback);
      stopStream();
      onCancel();
    }
  };

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !streamRef.current) return;

    chunksRef.current = [];
    console.log('[STEP 6] Renderizando Canvas e configurando captura de mídia em tempo real');

    // Mime types to try for compatibility (especially Safari)
    const mimeTypesToTry = [
      'video/mp4;codecs=h264',
      'video/mp4',
      'video/quicktime',
      'video/webm;codecs=vp9',
      'video/webm',
      ''
    ];

    let mimeType = '';
    for (const type of mimeTypesToTry) {
      if (!type || MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }

    // Capture standard 30 FPS video with burned overlays directly from canvas
    let mixedStream = new MediaStream();
    let canvasStream: MediaStream | null = null;
    let usingCanvas = true;

    try {
      const getStream = canvas.captureStream || (canvas as any).webkitCaptureStream;
      if (getStream) {
        canvasStream = getStream.call(canvas, 30);
      }
    } catch (e) {
      console.error('[SAFARI FALLBACK] captureStream falhou:', e);
    }

    if (canvasStream && canvasStream.getVideoTracks().length > 0) {
      mixedStream.addTrack(canvasStream.getVideoTracks()[0]);
    } else {
      console.warn('[SAFARI FALLBACK] Sem track de vídeo de Canvas. Usando track de câmera direto');
      usingCanvas = false;
      if (streamRef.current.getVideoTracks().length > 0) {
        mixedStream.addTrack(streamRef.current.getVideoTracks()[0]);
      }
    }

    // Custom Mix Audio System (Music Background Only) using AudioContext
    console.log('[STEP 5] Iniciando AudioContext e conexões');
    const musicTrack = SpinDb.getMusicTracks().find(t => t.id === event.musicId);
    if (musicTrack) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        activeAudioContextRef.current = audioCtx;
        const dest = audioCtx.createMediaStreamDestination();

        try {
          const audio = new Audio(musicTrack.audioUrl);
          audio.crossOrigin = 'anonymous';
          audio.loop = musicTrack.loop;
          audio.volume = musicTrack.volume || 0.8;
          audio.currentTime = musicTrack.startPoint || 0;
          activeAudioRef.current = audio;

          audio.oncanplay = () => {
            console.log('[MUSIC] Música carregada');
          };
          audio.onerror = (e) => {
            console.error('[MUSIC] Música falhou', e);
          };

          const musicSource = audioCtx.createMediaElementSource(audio);
          musicSource.connect(dest);
          audio.play().then(() => {
            console.log('[MUSIC] Play iniciado com sucesso');
          }).catch(errPlay => {
            console.warn('Erro autoplay música na gravação:', errPlay);
            console.log('[MUSIC] Música falhou');
          });
        } catch (errMusicNode) {
          console.error('[MUSIC] Música falhou', errMusicNode);
        }

        const mixedAudioTracks = dest.stream.getAudioTracks();
        if (mixedAudioTracks.length > 0) {
          mixedStream.addTrack(mixedAudioTracks[0]);
        }
      } catch (errAudioCtx) {
        console.warn('Falha ao instanciar pipeline de AudioContext:', errAudioCtx);
      }
    } else {
      console.log('[MUSIC] Música ignorada');
    }

    // Set up standard encoder
    let recorder: MediaRecorder | null = null;
    const recorderOptionsList = [
      { mimeType, videoBitsPerSecond: 4500000 },
      { mimeType },
      {}
    ];

    for (const options of recorderOptionsList) {
      try {
        if (options.mimeType || Object.keys(options).length === 0) {
          recorder = new MediaRecorder(mixedStream, options);
          break;
        }
      } catch (e) {
        console.warn('Falha de criação de MediaRecorder com opções:', options, e);
      }
    }

    if (!recorder) {
      console.error('[SAFARI FALLBACK] Todos os MediaRecorders falharam no stream misturado. Tentando gravação pura com a câmera');
      try {
        recorder = new MediaRecorder(streamRef.current);
        usingCanvas = false;
      } catch (errFinalMedia) {
        console.error('Falha total e irrecuperável de gravação:', errFinalMedia);
        setError('Ocorreu um erro no processador de vídeo do aparelho. Certifique-se de usar o Safari/Chrome atualizado.');
        setRecState('preview');
        return;
      }
    }

    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      console.log('[STEP 7] Finalizando MediaRecorder - Gravação em tempo real concluída');
      if (activeAudioRef.current) {
        try { activeAudioRef.current.pause(); } catch (_) {}
      }
      if (activeAudioContextRef.current) {
        try { activeAudioContextRef.current.close(); } catch (_) {}
      }

      console.log('[STEP 8] Gerando Blob final de alta fidelidade');
      const finalMime = recorder?.mimeType || 'video/mp4';
      const blob = new Blob(chunksRef.current, { type: finalMime });
      setRecState('processing');

      // Processing & saving index database takes less than 2 seconds
      setTimeout(async () => {
        try {
          let thumbnailBlob = new Blob([], { type: 'image/jpeg' });
          if (canvasRef.current) {
            await new Promise<void>((r) => {
              canvasRef.current!.toBlob((b) => {
                if (b) thumbnailBlob = b;
                r();
              }, 'image/jpeg', 0.85);
            });
          }

          const videoUrl = URL.createObjectURL(blob);
          const thumbUrl = thumbnailBlob.size > 0 ? URL.createObjectURL(thumbnailBlob) : '';

          const id = 'vid_' + Date.now();
          const slug = Math.random().toString(36).slice(2, 7);

          console.log('[STEP 9] Salvando no IndexedDB Videos Blob d\'água');
          try {
            await saveVideoBlobsToIndexedDB(id, blob, thumbnailBlob);
          } catch (errIDB) {
            console.error('[STEP 9] IDB erro:', errIDB);
          }

          console.log('[STEP 10] Concluído - Descarregando gravação');
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

          SpinDb.saveVideo(compiledVideo);
          stopStream();
          setTimeout(() => onRecordingComplete(compiledVideo), 300);
        } catch (errFinal) {
          console.error('[STEP 10] Falha geral ao persistizar vídeo, usando fallback básico:', errFinal);
          fallbackRawSave(blob);
        }
      }, 500);
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
        try {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        } catch (_) {}
      }
    }, 1000);
  }, [event, lead, onRecordingComplete, stopStream, fallbackRawSave]);

  const startCountdown = useCallback(() => {
    setRecState('countdown');

    // Safe direct gesture AudioContext unlock for iOS Safari pre-recording
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const dummyCtx = new AudioContextClass();
        dummyCtx.resume().then(() => {
          dummyCtx.close();
        });
      }
    } catch (e) {
      console.warn('Silent unlock exception:', e);
    }

    let count = 3;
    setCountdown(count);
    const t = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(t);
        startRecording();
      }
    }, 1000);
  }, [startRecording]);

  const stopEarly = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleCancel = () => { stopStream(); onCancel(); };

  const progress = ((event.videoDuration - timeLeft) / event.videoDuration) * 100;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">

      {/* Primary Video Container */}
      <div className="relative flex-1 overflow-hidden">

        {/* Hidden video node used only as raw input stream feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            left: '-9999px',
            opacity: 0,
            pointerEvents: 'none'
          }}
        />

        {/* Live composited canvas view with zero-delay display overlay matching outputs 100% */}
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          className="absolute inset-0 w-full h-full object-cover bg-black"
        />

        {/* Request stream errors */}
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

        {/* Live countdown visual overlay */}
        {recState === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/30">
            <span className="text-[160px] font-black text-white drop-shadow-2xl leading-none animate-pulse">
              {countdown === 0 ? '🎬' : countdown}
            </span>
          </div>
        )}

        {/* Processing State - Instant compilation and IndexedDB save */}
        {recState === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/90 space-y-4">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-extrabold text-xl font-display">PROCESSANDO VÍDEO...</p>
            <p className="text-slate-400 text-xs font-mono max-w-[240px] text-center">
              Salvando arquivo com música, moldura e logos na galeria do celular
            </p>
          </div>
        )}

        {/* Live Recording Header Stats */}
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

        {/* Recording Visual timeline bar */}
        {recState === 'recording' && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800 z-30">
            <div className="h-full bg-red-500 transition-all duration-1000"
              style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Closing controller */}
        {(recState === 'preview' || recState === 'countdown') && (
          <div className="absolute top-6 right-5 z-40">
            <button onClick={handleCancel}
              className="w-11 h-11 bg-black/50 backdrop-blur rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Control Footer */}
      <div className="bg-black py-10 flex items-center justify-center gap-8 z-30 safe-area-bottom">

        {recState === 'preview' && (
          <>
            <button onClick={handleCancel}
              className="w-14 h-14 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center">
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Giant Recording action trigger */}
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
