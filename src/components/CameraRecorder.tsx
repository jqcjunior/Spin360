/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, RefreshCw, Camera } from 'lucide-react';
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

type RecState = 'loading' | 'preview' | 'countdown' | 'recording' | 'processing';

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
  const [frameUrl, setFrameUrl]   = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft]   = useState(event.videoDuration);
  const [error, setError]         = useState<string | null>(null);

  // Carrega moldura e música
  useEffect(() => {
    const load = async () => {
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
            img.crossOrigin = 'anonymous';
            img.src = src;
            await new Promise(r => { img.onload = r; img.onerror = r; });
            frameImgRef.current = img;
            setFrameUrl(src);
          }
        } catch (e) { console.warn('[Frame]', e); }
      }

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
            audioElRef.current.volume = 0.6;
          }
        } catch (e) { console.warn('[Music]', e); }
      }

      setRecState('preview');
    };
    load();
  }, []);

  const stopAll = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.currentTime = 0; }
  }, []);

  // Inicia câmera e loop do canvas
  useEffect(() => {
    if (recState !== 'preview') return;
    let cancelled = false;

    const startCam = async () => {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: true,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;

        await new Promise<void>(r => {
          video.onloadedmetadata = () => { video.play().then(() => r()); };
        });

        // Canvas com tamanho EXATO da câmera — sem distorção
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width  = video.videoWidth  || 720;
        canvas.height = video.videoHeight || 1280;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
          // Espelha horizontalmente (selfie)
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // Moldura por cima
          if (frameImgRef.current?.complete && frameImgRef.current.naturalWidth > 0) {
            ctx.drawImage(frameImgRef.current, 0, 0, canvas.width, canvas.height);
          }

          animRef.current = requestAnimationFrame(draw);
        };
        draw();

      } catch {
        if (!cancelled) setError('Permissão de câmera negada. Toque para tentar novamente.');
      }
    };

    startCam();
    return () => { cancelled = true; };
  }, [recState]);

  useEffect(() => () => stopAll(), [stopAll]);

  // Upload em background — não bloqueia o UX
  const uploadInBackground = useCallback(async (blob: Blob, slug: string, videoId: string) => {
    try {
      const ext  = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const path = `${event.id}/${slug}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('videos-processed')
        .upload(path, blob, { contentType: blob.type, upsert: true });

      if (upErr) { console.error('[Upload]', upErr.message); return; }

      const { data } = supabase.storage.from('videos-processed').getPublicUrl(path);
      const publicUrl = data.publicUrl;

      await (supabase.from('events') as any).upsert({
        id: event.id, name: event.name,
        status: event.status || 'active',
        video_duration_seconds: event.videoDuration,
        category: event.category || 'Geral',
        theme_color: event.themeColor || '#6366f1',
        totem_mode_enabled: true,
        lead_capture_config: {},
        created_at: event.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await (supabase.from('videos') as any).insert({
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

      // Atualiza URL local para a permanente
      const saved = SpinDb.getVideos().find((v: any) => v.id === videoId);
      if (saved) SpinDb.saveVideo({ ...saved, url: publicUrl, status: 'completed' });

      console.log(`[Real360] ✅ ${slug} → ${publicUrl}`);
    } catch (err) {
      console.error('[Upload background]', err);
    }
  }, [event]);

  const finishRecording = useCallback((blob: Blob) => {
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.currentTime = 0; }

    const slug    = Math.random().toString(36).slice(2, 7);
    const videoId = uuid();
    const localUrl = URL.createObjectURL(blob);

    // Salva localmente e mostra resultado IMEDIATAMENTE
    const video: VideoRecord = {
      id: videoId, slug, eventId: event.id, leadId: lead?.id,
      url: localUrl, thumbnailUrl: '', duration: event.videoDuration,
      status: 'pending',
      effectAppliedId: event.effectPresetId,
      frameAppliedId: event.frameId,
      musicAppliedId: event.musicId,
      viewsCount: 0, downloadsCount: 0, sharesCount: 0,
      createdAt: new Date().toISOString(),
    };

    SpinDb.saveVideo(video);
    stopAll();

    // Mostra tela de resultado sem esperar upload
    onRecordingComplete(video);

    // Upload roda em background sem bloquear
    if (navigator.onLine) {
      uploadInBackground(blob, slug, videoId);
    }
  }, [event, lead, onRecordingComplete, stopAll, uploadInBackground]);

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    const stream = streamRef.current;
    if (!canvas || !stream) return;

    // Toca música pelo speaker (será captada pelo microfone naturalmente)
    audioElRef.current?.play().catch(() => {});

    // Stream de vídeo do canvas + áudio DIRETO da câmera (garante som no iOS)
    let recordStream: MediaStream;
    try {
      const canvasStream = (canvas as any).captureStream(30) as MediaStream;
      const audioTracks  = stream.getAudioTracks();
      recordStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks,
      ]);
    } catch {
      // Fallback iOS: usa stream direto
      recordStream = stream;
    }

    const mimeType = [
      'video/mp4;codecs=h264,aac',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find(t => MediaRecorder.isTypeSupported(t)) || '';

    chunksRef.current = [];
    const recorder = new MediaRecorder(recordStream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 2_500_000,
      audioBitsPerSecond: 128_000,
    });

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

  const startCountdown = useCallback(() => {
    setRecState('countdown');
    let count = 3;
    setCountdown(count);
    const t = setInterval(() => {
      count--; setCountdown(count);
      if (count <= 0) { clearInterval(t); startRecording(); }
    }, 1000);
  }, [startRecording]);

  const progress = ((event.videoDuration - timeLeft) / event.videoDuration) * 100;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <audio ref={audioElRef} playsInline />
      <video ref={videoRef} className="hidden" />

      <div className="relative flex-1 overflow-hidden">
        {/* Canvas principal — câmera espelhada + moldura */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain bg-black"
        />

        {/* Loading */}
        {recState === 'loading' && (
          <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm font-mono">Preparando...</p>
          </div>
        )}

        {/* Erro câmera */}
        {error && (
          <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center p-8 gap-6 text-center">
            <Camera className="w-16 h-16 text-slate-600" />
            <p className="text-white font-bold text-xl">{error}</p>
            <button onClick={() => { setError(null); setRecState('preview'); }}
              className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg">
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Contagem regressiva — canto superior direito, discreta */}
        {recState === 'countdown' && (
          <div className="absolute top-6 right-16 z-30">
            <div className="w-16 h-16 bg-black/70 backdrop-blur rounded-2xl flex items-center justify-center">
              <span className="text-white text-4xl font-black">{countdown}</span>
            </div>
          </div>
        )}

        {/* HUD gravação */}
        {recState === 'recording' && (
          <>
            {/* Badge GRAVANDO — topo esquerdo */}
            <div className="absolute top-6 left-5 z-30">
              <div className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-full shadow-lg">
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-sm font-bold font-mono">GRAVANDO</span>
              </div>
            </div>

            {/* Timer — topo direito, pequeno e discreto */}
            <div className="absolute top-6 right-5 z-30">
              <div className="bg-black/60 backdrop-blur px-3 py-2 rounded-xl min-w-[52px] text-center">
                <p className="text-white text-2xl font-black font-mono leading-none">{timeLeft}</p>
                <p className="text-slate-400 text-[10px] font-mono">seg</p>
              </div>
            </div>

            {/* Barra de progresso — fundo */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40 z-30">
              <div className="h-full bg-red-500 transition-all duration-1000"
                style={{ width: `${progress}%` }} />
            </div>
          </>
        )}

        {/* Botão fechar */}
        {(recState === 'preview' || recState === 'countdown') && !error && (
          <div className="absolute top-6 right-5 z-40">
            {recState === 'preview' && (
              <button onClick={() => { stopAll(); onCancel(); }}
                className="w-11 h-11 bg-black/60 backdrop-blur rounded-full flex items-center justify-center">
                <X className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Controles inferiores */}
      <div className="bg-black py-10 flex items-center justify-center gap-8 z-30 safe-area-pb">
        {recState === 'preview' && !error && (
          <>
            <button onClick={() => { stopAll(); onCancel(); }}
              className="w-14 h-14 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center">
              <X className="w-6 h-6 text-white" />
            </button>

            <button onClick={startCountdown}
              className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-red-500 active:scale-95 transition-transform">
              <div className="w-16 h-16 bg-red-500 rounded-full" />
            </button>

            <button onClick={() => { setError(null); setRecState('preview'); }}
              className="w-14 h-14 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-white" />
            </button>
          </>
        )}

        {recState === 'recording' && (
          <button
            onClick={() => { recorderRef.current?.stop(); if (timerRef.current) clearInterval(timerRef.current); }}
            className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-red-500 active:scale-95 transition-transform">
            <div className="w-10 h-10 bg-red-500 rounded-md" />
          </button>
        )}

        {recState === 'countdown' && (
          <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center opacity-50">
            <div className="w-16 h-16 bg-slate-600 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}