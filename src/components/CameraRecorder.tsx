/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, RefreshCw, Camera } from 'lucide-react';
import { Event, VideoLead, VideoRecord } from '../types';
import { SpinDb, DEMO_FRAMES_SVG } from '../db';
import { supabase } from '../lib/supabase';
import { getAsset, saveVideoOffline } from '../lib/cache';

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

// Detecta se canvas.captureStream é suportado (não funciona no iOS Safari)
function supportsCanvasCapture(): boolean {
  try {
    const c = document.createElement('canvas');
    return typeof (c as any).captureStream === 'function';
  } catch { return false; }
}

export default function CameraRecorder({ event, lead, onRecordingComplete, onCancel }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const audioElRef  = useRef<HTMLAudioElement>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const animRef     = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const [recState, setRecState]     = useState<RecState>('loading');
  const [countdown, setCountdown]   = useState(3);
  const [timeLeft, setTimeLeft]     = useState(event.videoDuration);
  const [error, setError]           = useState<string | null>(null);
  const [uploadMsg, setUploadMsg]   = useState('');
  const [musicSrc, setMusicSrc]     = useState<string | null>(null);
  const [useCanvas]                 = useState(() => supportsCanvasCapture());

  // Carrega moldura e música com cache offline
  useEffect(() => {
    const load = async () => {
      // Moldura
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
          } else if (url && DEMO_FRAMES_SVG[url]) {
            const img = new Image();
            img.src = `data:image/svg+xml;base64,${btoa(DEMO_FRAMES_SVG[url])}`;
            await new Promise(r => { img.onload = r; img.onerror = r; });
            frameImgRef.current = img;
          }
        } catch (e) { console.warn('[Frame]', e); }
      }

      // Música
      if (event.musicId) {
        try {
          const local = SpinDb.getMusicTracks().find((t: any) => t.id === event.musicId);
          let url = local?.audioUrl || null;
          if (!url) {
            const { data } = await supabase.from('music_tracks').select('file_url').eq('id', event.musicId).single();
            url = data?.file_url || null;
          }
          if (url) {
            const src = await getAsset(`music_${event.musicId}`, url);
            setMusicSrc(src);
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
    if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.currentTime = 0; }
  }, []);

  // Inicia câmera quando assets estiverem prontos
  useEffect(() => {
    if (recState !== 'preview') return;
    let cancelled = false;

    const startCam = async () => {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: true,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise<void>(r => { videoRef.current!.onloadedmetadata = () => r(); });
          await videoRef.current.play();
        }

        // Inicia loop do canvas APÓS vídeo estar tocando
        if (useCanvas && canvasRef.current && videoRef.current) {
          const canvas = canvasRef.current;
          const video = videoRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = 1080;
            canvas.height = 1920;
            const draw = () => {
              ctx.save();
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              ctx.restore();
              if (frameImgRef.current?.complete) {
                ctx.drawImage(frameImgRef.current, 0, 0, canvas.width, canvas.height);
              }
              animRef.current = requestAnimationFrame(draw);
            };
            draw();
          }
        }
      } catch {
        if (!cancelled) setError('Permissão de câmera negada. Toque para tentar novamente.');
      }
    };

    startCam();
    return () => { cancelled = true; };
  }, [recState, useCanvas]);

  useEffect(() => () => stopAll(), [stopAll]);

  const finishRecording = useCallback(async (blob: Blob) => {
    setRecState('processing');
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.currentTime = 0; }

    const slug    = Math.random().toString(36).slice(2, 7);
    const videoId = uuid();
    let   videoUrl = URL.createObjectURL(blob);
    const online   = navigator.onLine;

    if (online) {
      setUploadMsg('Enviando para a nuvem...');
      try {
        const ext  = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const path = `${event.id}/${slug}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from('videos-processed')
          .upload(path, blob, { contentType: blob.type, upsert: true });

        if (!upErr) {
          const { data } = supabase.storage.from('videos-processed').getPublicUrl(path);
          videoUrl = data.publicUrl;
          setUploadMsg('Registrando...');

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
            id: videoId, event_id: event.id, lead_id: null,
            public_slug: slug, processed_video_url: videoUrl,
            duration_seconds: event.videoDuration, status: 'completed',
            created_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
          });

          console.log(`[Real360] ✅ ${slug} → ${videoUrl}`);
        }
      } catch (err) {
        console.error('[Upload]', err);
      }
    } else {
      setUploadMsg('Sem internet — salvando localmente...');
      await saveVideoOffline(videoId, blob);
    }

    const video: VideoRecord = {
      id: videoId, slug, eventId: event.id, leadId: lead?.id,
      url: videoUrl, thumbnailUrl: '', duration: event.videoDuration,
      status: online ? 'completed' : 'pending',
      effectAppliedId: event.effectPresetId,
      frameAppliedId: event.frameId,
      musicAppliedId: event.musicId,
      viewsCount: 0, downloadsCount: 0, sharesCount: 0,
      createdAt: new Date().toISOString(),
    };

    SpinDb.saveVideo(video);
    stopAll();
    setUploadMsg('');
    setTimeout(() => onRecordingComplete(video), 300);
  }, [event, lead, onRecordingComplete, stopAll]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    // Toca música de fundo
    if (audioElRef.current && musicSrc) {
      audioElRef.current.src     = musicSrc;
      audioElRef.current.loop    = true;
      audioElRef.current.volume  = 0.7;
      audioElRef.current.crossOrigin = 'anonymous';
      audioElRef.current.play().catch(() => {});
    }

    let recordStream: MediaStream;

    if (useCanvas && canvasRef.current) {
      // Android/Chrome: canvas com moldura + mix de áudio
      try {
        const canvasStream = (canvasRef.current as any).captureStream(30) as MediaStream;
        const audioCtx     = new AudioContext();
        audioCtxRef.current = audioCtx;
        const dest = audioCtx.createMediaStreamDestination();

        const micTracks = streamRef.current.getAudioTracks();
        if (micTracks.length > 0) {
          const micGain = audioCtx.createGain();
          micGain.gain.value = 1.0;
          audioCtx.createMediaStreamSource(new MediaStream(micTracks)).connect(micGain);
          micGain.connect(dest);
        }

        if (audioElRef.current && musicSrc) {
          const musicGain = audioCtx.createGain();
          musicGain.gain.value = 0.65;
          try {
            audioCtx.createMediaElementSource(audioElRef.current).connect(musicGain);
            musicGain.connect(dest);
            musicGain.connect(audioCtx.destination);
          } catch {}
        }

        const tracks = [
          canvasStream.getVideoTracks()[0],
          dest.stream.getAudioTracks()[0],
        ].filter(Boolean);
        recordStream = new MediaStream(tracks);
      } catch {
        recordStream = streamRef.current;
      }
    } else {
      // iOS Safari: stream direto da câmera (moldura é overlay visual)
      recordStream = streamRef.current;
    }

    const mimeType = [
      'video/mp4;codecs=h264,aac',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find(t => MediaRecorder.isTypeSupported(t)) || '';

    chunksRef.current = [];
    const recorder = new MediaRecorder(
      recordStream,
      mimeType ? { mimeType } : undefined
    );
    recorderRef.current = recorder;
    recorder.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
      finishRecording(blob);
    };
    recorder.start(200);

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
  }, [event.videoDuration, finishRecording, musicSrc, useCanvas]);

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
    recorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const progress = ((event.videoDuration - timeLeft) / event.videoDuration) * 100;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <audio ref={audioElRef} />

      {/* Vídeo: visível no iOS (sem canvas), oculto no Android (usa canvas) */}
      <video
        ref={videoRef}
        autoPlay playsInline muted
        className={`absolute inset-0 w-full h-full object-cover ${useCanvas ? 'opacity-0' : ''}`}
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Canvas: só ativo no Android/Chrome */}
      {useCanvas && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Moldura: overlay CSS no iOS, canvas no Android */}
      {!useCanvas && frameImgRef.current && (
        <img
          src={frameImgRef.current.src}
          alt="moldura"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
        />
      )}

      {/* Loading de assets */}
      {recState === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-mono">Preparando...</p>
        </div>
      )}

      {/* Erro de câmera */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/90 p-8 text-center space-y-6">
          <Camera className="w-20 h-20 text-slate-600" />
          <p className="text-white font-bold text-xl">{error}</p>
          <button
            onClick={() => setRecState('preview')}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg">
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Contagem regressiva */}
      {recState === 'countdown' && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/40">
          <span className="text-[180px] font-black text-white drop-shadow-2xl leading-none">
            {countdown}
          </span>
        </div>
      )}

      {/* HUD durante gravação */}
      {recState === 'recording' && (
        <>
          {/* Timer central grande */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <div className="bg-black/50 backdrop-blur rounded-3xl px-8 py-4 text-center">
              <p className="text-white text-6xl font-black font-mono leading-none">{timeLeft}</p>
              <p className="text-slate-300 text-sm font-mono mt-1">segundos</p>
            </div>
          </div>
          {/* Badge REC */}
          <div className="absolute top-6 left-5 z-30">
            <div className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-full shadow-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              <span className="text-white text-sm font-bold font-mono">GRAVANDO</span>
            </div>
          </div>
          {/* Barra de progresso */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-slate-800/80 z-30">
            <div
              className="h-full bg-red-500 transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}

      {/* Processando */}
      {recState === 'processing' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/90 space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white font-bold text-lg">Processando vídeo...</p>
          {uploadMsg && <p className="text-indigo-400 text-sm font-mono">{uploadMsg}</p>}
        </div>
      )}

      {/* Botão fechar */}
      {(recState === 'preview' || recState === 'countdown') && (
        <div className="absolute top-6 right-5 z-40">
          <button
            onClick={() => { stopAll(); onCancel(); }}
            className="w-11 h-11 bg-black/60 backdrop-blur rounded-full flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      {/* Controles inferiores */}
      <div className="absolute bottom-0 left-0 right-0 pb-12 flex items-center justify-center gap-8 z-30">
        {recState === 'preview' && !error && (
          <>
            <button
              onClick={() => { stopAll(); onCancel(); }}
              className="w-14 h-14 bg-black/60 backdrop-blur rounded-full flex items-center justify-center">
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Botão gravar */}
            <button
              onClick={startCountdown}
              className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-red-500 active:scale-95 transition-transform">
              <div className="w-16 h-16 bg-red-500 rounded-full" />
            </button>

            <button
              onClick={() => setRecState('preview')}
              className="w-14 h-14 bg-black/60 backdrop-blur rounded-full flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-white" />
            </button>
          </>
        )}

        {recState === 'recording' && (
          <button
            onClick={stopEarly}
            className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-red-500 active:scale-95 transition-transform">
            <div className="w-10 h-10 bg-red-500 rounded-md" />
          </button>
        )}
      </div>
    </div>
  );
}