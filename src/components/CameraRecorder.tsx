/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, RefreshCw, Camera, AlertTriangle } from 'lucide-react';
import { Event, VideoLead, VideoRecord } from '../types';
import { SpinDb, DEMO_FRAMES_SVG } from '../db';
import { supabase } from '../lib/supabase';
import { getAsset } from '../lib/cache';

interface Props {
  event: Event;
  lead: VideoLead | null;
  onRecordingComplete: (video: VideoRecord) => void;
  onCancel: () => void;
}

type RecState = 'loading' | 'preview' | 'countdown' | 'recording' | 'done';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export default function CameraRecorder({ event, lead, onRecordingComplete, onCancel }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const audioElRef  = useRef<HTMLAudioElement>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const animRef     = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const [recState, setRecState]   = useState<RecState>('loading');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft]   = useState(event.videoDuration);
  const [error, setError]         = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState('');

  // ─── Carrega moldura e música ───────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      // Moldura
      if (event.frameId) {
        try {
          const local = SpinDb.getFrames().find((f: any) => f.id === event.frameId);
          let url: string | null = local?.imageUrl || null;

          if (!url) {
            const { data } = await supabase
              .from('frames').select('image_url')
              .eq('id', event.frameId).single();
            url = data?.image_url || null;
          }

          if (url?.startsWith('http')) {
            const cached = await getAsset(`frame_${event.frameId}`, url);
            const img = new Image();
            // NÃO usar crossOrigin para data URLs — tainta o canvas no iOS/Chrome
            if (!cached.startsWith('data:')) {
              img.crossOrigin = 'anonymous';
            }
            await new Promise<void>(resolve => {
              if (img.complete && img.naturalWidth > 0) { resolve(); return; }
              img.onload  = () => resolve();
              img.onerror = () => resolve();
              img.src = cached;
            });
            if (img.naturalWidth > 0) frameImgRef.current = img;
          }
        } catch (e) { console.warn('[Frame]', e); }
      }

      // Música — pré-carrega e aguarda buffering
      if (event.musicId && audioElRef.current) {
        try {
          const local = SpinDb.getMusicTracks().find((t: any) => t.id === event.musicId);
          let url: string | null = local?.audioUrl || null;

          if (!url) {
            const { data } = await supabase
              .from('music_tracks').select('file_url')
              .eq('id', event.musicId).single();
            url = data?.file_url || null;
          }

          if (url) {
            const cached = await getAsset(`music_${event.musicId}`, url);
            audioElRef.current.src     = cached;
            audioElRef.current.loop    = true;
            audioElRef.current.volume  = 0.8;
            audioElRef.current.preload = 'auto';
            await audioElRef.current.load();
          }
        } catch (e) { console.warn('[Music]', e); }
      }

      setRecState('preview');
    };
    load();
  }, []);

  // ─── Inicializa câmera + loop canvas ───────────────────────────────────────
  useEffect(() => {
    if (recState !== 'preview') return;
    let cancelled = false;

    const init = async () => {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width:  { ideal: 1080 },
            height: { ideal: 1920 },
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl:  false,
          },
        });

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current!;
        video.srcObject  = stream;
        video.muted      = true;
        video.playsInline = true;
        video.autoplay   = true;

        // Aguarda o vídeo estar pronto para desenhar
        await new Promise<void>(resolve => {
          video.onplaying = () => resolve();
          video.play().catch(() => resolve());
        });

        // Define canvas com dimensões EXATAS da câmera
        const canvas = canvasRef.current!;
        canvas.width  = video.videoWidth  || 1280;
        canvas.height = video.videoHeight || 720;

        const ctx = canvas.getContext('2d', { alpha: false })!;

        const draw = () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            animRef.current = requestAnimationFrame(draw);
            return;
          }

          // Câmera espelhada
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // Moldura por cima (sem escalar, cobre tudo)
          if (frameImgRef.current?.complete && frameImgRef.current.naturalWidth > 0) {
            ctx.drawImage(frameImgRef.current, 0, 0, canvas.width, canvas.height);
          }

          animRef.current = requestAnimationFrame(draw);
        };
        draw();

      } catch {
        if (!cancelled) setError('Permissão de câmera negada. Toque aqui para tentar novamente.');
      }
    };

    init();
    return () => { cancelled = true; };
  }, [recState]);

  const stopAll = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.currentTime = 0; }
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  // ─── Upload em background ──────────────────────────────────────────────────
  const uploadBackground = useCallback((blob: Blob, slug: string, videoId: string) => {
    if (!navigator.onLine) return;

    const doUpload = async () => {
      try {
        const ext  = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const path = `${event.id}/${slug}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from('videos-processed')
          .upload(path, blob, { contentType: blob.type, upsert: true });

        if (upErr) throw upErr;

        const { data } = supabase.storage.from('videos-processed').getPublicUrl(path);
        const publicUrl = data.publicUrl;



        // Salva vídeo com UUID válido
        const { error: dbErr } = await (supabase.from('videos') as any).insert({
          id: videoId,
          event_id: event.id,
          lead_id: null,
          public_slug: slug,
          processed_video_url: publicUrl,
          duration_seconds: event.videoDuration,
          status: 'completed',
          created_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
        });

        if (!dbErr) {
          // Atualiza URL local para a permanente
          const vids = SpinDb.getVideos();
          const idx  = vids.findIndex((v: any) => v.id === videoId);
          if (idx >= 0) SpinDb.saveVideo({ ...vids[idx], url: publicUrl, status: 'completed' });
          console.log(`[Real360] ✅ ${slug} salvo`);
        }
      } catch (e) { console.error('[Upload]', e); }
    };

    doUpload();
  }, [event]);

  // ─── Finaliza gravação ─────────────────────────────────────────────────────
  const finishRecording = useCallback((blob: Blob) => {
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.currentTime = 0; }

    const slug    = Math.random().toString(36).slice(2, 7);
    const videoId = uuid();
    const localUrl = URL.createObjectURL(blob);

    const videoRecord: VideoRecord = {
      id: videoId, slug,
      eventId: event.id,
      leadId: lead?.id,
      url: localUrl,
      thumbnailUrl: '',
      duration: event.videoDuration,
      status: 'pending',
      effectAppliedId: event.effectPresetId,
      frameAppliedId:  event.frameId,
      musicAppliedId:  event.musicId,
      viewsCount: 0, downloadsCount: 0, sharesCount: 0,
      createdAt: new Date().toISOString(),
    };

    SpinDb.saveVideo(videoRecord);
    stopAll();

    // Mostra resultado IMEDIATAMENTE — upload roda em background
    onRecordingComplete(videoRecord);
    uploadBackground(blob, slug, videoId);
  }, [event, lead, onRecordingComplete, stopAll, uploadBackground]);

  // ─── Inicia gravação ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    const canvas = canvasRef.current;
    const stream = streamRef.current;
    if (!canvas || !stream) return;

    // Inicia música ANTES de capturar — dá tempo do speaker emitir som
    if (audioElRef.current) {
      audioElRef.current.volume = 0.9;
      try {
        await audioElRef.current.play();
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) { console.warn('[Music]', e); }
    }

    // Aguarda canvas ter ao menos alguns frames com moldura desenhada
    await new Promise(resolve => setTimeout(resolve, 400));

    // ─ Vídeo: canvas com moldura embutida ─
    let videoTrack: MediaStreamTrack | null = null;
    try {
      const cs = (canvas as any).captureStream(30) as MediaStream;
      const vt = cs.getVideoTracks();
      if (vt.length > 0 && vt[0].readyState === 'live') {
        videoTrack = vt[0];
        console.log('[Canvas] captureStream OK — frame será gravado no vídeo');
      } else {
        console.warn('[Canvas] captureStream sem tracks ativos');
      }
    } catch (e) {
      console.warn('[Canvas] captureStream falhou:', e);
    }

    // ─ Áudio: microfone direto da câmera (capta voz + música do ambiente) ─
    const audioTrack = stream.getAudioTracks()[0] || null;

    const tracks: MediaStreamTrack[] = [];
    if (videoTrack) {
      tracks.push(videoTrack);            // canvas com moldura
    } else {
      stream.getVideoTracks().forEach(t => tracks.push(t)); // fallback
    }
    if (audioTrack) tracks.push(audioTrack);

    const recordStream = new MediaStream(tracks);

    const mimeType = [
      'video/mp4;codecs=h264,aac',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find(t => MediaRecorder.isTypeSupported(t)) || '';

    const recorderOptions: MediaRecorderOptions = {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 2_500_000,  // 2.5 Mbps — boa qualidade, tamanho controlado
      audioBitsPerSecond: 128_000,    // 128 kbps — qualidade de podcast
    };

    chunksRef.current = [];
    const recorder = new MediaRecorder(
      streamRef.current!,
      recorderOptions
    );

    recorderRef.current = recorder;
    recorder.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => finishRecording(new Blob(chunksRef.current, { type: mimeType || 'video/webm' }));
    recorder.start(200);

    setRecState('recording');
    setTimeLeft(event.videoDuration);
    let rem = event.videoDuration;
    timerRef.current = setInterval(() => {
      rem--;
      setTimeLeft(rem);
      if (rem <= 0) { clearInterval(timerRef.current!); recorder.stop(); }
    }, 1000);
  }, [event.videoDuration, finishRecording]);

  // ─── Contagem regressiva ───────────────────────────────────────────────────
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

  const progress = ((event.videoDuration - timeLeft) / event.videoDuration) * 100;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <audio ref={audioElRef} playsInline />
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />

      <div className="relative flex-1 overflow-hidden bg-black">
        {/* Canvas: câmera espelhada + moldura */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* Loading */}
        {recState === 'loading' && (
          <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm font-mono">Preparando câmera...</p>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div
            className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center p-8 gap-6 text-center cursor-pointer"
            onClick={() => { setError(null); setRecState('preview'); }}>
            <AlertTriangle className="w-16 h-16 text-amber-500" />
            <p className="text-white font-bold text-xl">{error}</p>
            <span className="text-slate-400 text-sm">Toque para tentar novamente</span>
          </div>
        )}

        {/* Contagem — canto superior direito, discreta */}
        {recState === 'countdown' && (
          <div className="absolute top-8 right-8 z-30">
            <div className="w-16 h-16 bg-black/75 backdrop-blur rounded-2xl flex items-center justify-center border border-white/10">
              <span className="text-white text-4xl font-black leading-none">{countdown}</span>
            </div>
          </div>
        )}

        {/* HUD gravação */}
        {recState === 'recording' && (
          <>
            <div className="absolute top-6 left-5 z-30 flex items-center gap-2 bg-red-600 px-4 py-2 rounded-full shadow-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              <span className="text-white text-sm font-bold font-mono">GRAVANDO</span>
            </div>

            <div className="absolute top-6 right-5 z-30 bg-black/65 backdrop-blur px-3 py-2 rounded-xl text-center">
              <p className="text-white text-2xl font-black font-mono leading-none">{timeLeft}</p>
              <p className="text-slate-400 text-[10px] font-mono">seg</p>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40 z-30">
              <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
          </>
        )}

        {/* Fechar (preview e countdown) */}
        {(recState === 'preview') && !error && (
          <div className="absolute top-6 right-5 z-40">
            <button
              onClick={() => { stopAll(); onCancel(); }}
              className="w-11 h-11 bg-black/60 backdrop-blur rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="bg-black py-10 flex items-center justify-center gap-8 z-30">
        {recState === 'preview' && !error && (
          <>
            <button
              onClick={() => { stopAll(); onCancel(); }}
              className="w-14 h-14 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center">
              <X className="w-6 h-6 text-white" />
            </button>

            <button
              onClick={startCountdown}
              className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-red-500 active:scale-95 transition-transform">
              <div className="w-16 h-16 bg-red-500 rounded-full" />
            </button>

            <button
              onClick={() => { setError(null); setRecState('preview'); }}
              className="w-14 h-14 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-white" />
            </button>
          </>
        )}

        {recState === 'countdown' && (
          <div className="w-24 h-24 rounded-full bg-slate-800/50 border-4 border-slate-700 flex items-center justify-center">
            <div className="w-16 h-16 bg-slate-700 rounded-full" />
          </div>
        )}

        {recState === 'recording' && (
          <button
            onClick={() => {
              recorderRef.current?.stop();
              if (timerRef.current) clearInterval(timerRef.current);
            }}
            className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-red-500 active:scale-95 transition-transform">
            <div className="w-10 h-10 bg-red-500 rounded-md" />
          </button>
        )}
      </div>
    </div>
  );
}