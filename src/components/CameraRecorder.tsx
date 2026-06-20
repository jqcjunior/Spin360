/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, RefreshCw, Camera, Wifi, WifiOff } from 'lucide-react';
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

type RecState = 'loading' | 'requesting' | 'preview' | 'countdown' | 'recording' | 'processing';

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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const [recState, setRecState]           = useState<RecState>('loading');
  const [countdown, setCountdown]         = useState(3);
  const [timeLeft, setTimeLeft]           = useState(event.videoDuration);
  const [error, setError]                 = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState('');
  const [musicSrc, setMusicSrc]           = useState<string | null>(null);
  const [isOnline, setIsOnline]           = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Carrega e cacheia moldura e música (online ou offline)
  useEffect(() => {
    const loadAssets = async () => {
      setRecState('loading');
      try {
        // Moldura
        if (event.frameId) {
          let url: string | null = null;
          const local = SpinDb.getFrames().find((f: any) => f.id === event.frameId);
          if (local?.imageUrl?.startsWith('http')) {
            url = local.imageUrl;
          } else if (local?.imageUrl) {
            // SVG embutido
            const img = new Image();
            img.src = `data:image/svg+xml;base64,${btoa(DEMO_FRAMES_SVG[local.imageUrl] || '')}`;
            frameImgRef.current = img;
          } else {
            const { data } = await supabase.from('frames').select('image_url').eq('id', event.frameId).single();
            url = data?.image_url ?? null;
          }

          if (url) {
            const src = await getAsset(`frame_${event.frameId}`, url);
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = src;
            await new Promise(r => { img.onload = r; img.onerror = r; });
            frameImgRef.current = img;
          }
        }

        // Música
        if (event.musicId) {
          let url: string | null = null;
          const local = SpinDb.getMusicTracks().find((t: any) => t.id === event.musicId);
          url = local?.audioUrl ?? null;
          if (!url) {
            const { data } = await supabase.from('music_tracks').select('file_url').eq('id', event.musicId).single();
            url = data?.file_url ?? null;
          }
          if (url) {
            const src = await getAsset(`music_${event.musicId}`, url);
            setMusicSrc(src);
          }
        }
      } catch (err) {
        console.warn('[Assets]', err);
      }
      setRecState('requesting');
    };
    loadAssets();
  }, [event.frameId, event.musicId]);

  const stopAll = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.currentTime = 0; }
  }, []);

  // Loop do canvas: câmera espelhada + moldura
  const startDrawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 1080; canvas.height = 1920;

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
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
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
      startDrawLoop();
      setRecState('preview');
    } catch {
      setError('Permissão de câmera negada. Toque para tentar novamente.');
    }
  }, [startDrawLoop]);

  useEffect(() => {
    if (recState === 'requesting') startCamera();
    return () => stopAll();
  }, [recState === 'requesting']);

  const finishRecording = useCallback(async (blob: Blob) => {
    setRecState('processing');
    const slug    = Math.random().toString(36).slice(2, 7);
    const videoId = uuid();
    let videoUrl  = URL.createObjectURL(blob);
    const online  = navigator.onLine;

    if (online) {
      setUploadProgress('Enviando para a nuvem...');
      try {
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const path = `${event.id}/${slug}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('videos-processed')
          .upload(path, blob, { contentType: blob.type, upsert: true });

        if (!upErr) {
          const { data } = supabase.storage.from('videos-processed').getPublicUrl(path);
          videoUrl = data.publicUrl;
          setUploadProgress('Registrando...');

          await (supabase.from('events') as any).upsert({
            id: event.id, name: event.name, status: event.status || 'active',
            video_duration_seconds: event.videoDuration, category: event.category || 'Geral',
            theme_color: event.themeColor || '#6366f1', totem_mode_enabled: true,
            lead_capture_config: {}, created_at: event.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          await (supabase.from('videos') as any).insert({
            id: videoId, event_id: event.id, lead_id: null,
            public_slug: slug, processed_video_url: videoUrl,
            duration_seconds: event.videoDuration, status: 'completed',
            created_at: new Date().toISOString(), processed_at: new Date().toISOString(),
          });

          console.log(`[Real360] ✅ Online — ${slug} → ${videoUrl}`);
        }
      } catch (err) {
        console.error('[Upload]', err);
      }
    } else {
      // Salva offline para sync posterior
      setUploadProgress('Sem internet — salvando localmente...');
      await saveVideoOffline(videoId, blob);
      console.log(`[Real360] 📴 Offline — ${slug} salvo localmente`);
    }

    const video: VideoRecord = {
      id: videoId, slug, eventId: event.id, leadId: lead?.id,
      url: videoUrl, thumbnailUrl: '', duration: event.videoDuration,
      status: online ? 'completed' : 'pending',
      effectAppliedId: event.effectPresetId, frameAppliedId: event.frameId,
      musicAppliedId: event.musicId, viewsCount: 0, downloadsCount: 0, sharesCount: 0,
      createdAt: new Date().toISOString(),
    };

    SpinDb.saveVideo(video);
    stopAll();
    setUploadProgress('');
    setTimeout(() => onRecordingComplete(video), 300);
  }, [event, lead, onRecordingComplete, stopAll]);

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !streamRef.current) return;

    const canvasStream = canvas.captureStream(30);
    let audioTrack: MediaStreamTrack | undefined;

    try {
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();

      // Microfone
      const micTracks = streamRef.current.getAudioTracks();
      if (micTracks.length > 0) {
        const micGain = audioCtx.createGain();
        micGain.gain.value = 1.0;
        audioCtx.createMediaStreamSource(new MediaStream(micTracks)).connect(micGain);
        micGain.connect(dest);
      }

      // Música de fundo
      if (audioElRef.current && musicSrc) {
        audioElRef.current.src = musicSrc;
        audioElRef.current.loop = true;
        audioElRef.current.volume = 0.7;
        audioElRef.current.crossOrigin = 'anonymous';
        audioElRef.current.play().catch(() => {});
        const musicGain = audioCtx.createGain();
        musicGain.gain.value = 0.7;
        audioCtx.createMediaElementSource(audioElRef.current).connect(musicGain);
        musicGain.connect(dest);
        musicGain.connect(audioCtx.destination);
      }

      audioTrack = dest.stream.getAudioTracks()[0];
    } catch {
      audioTrack = streamRef.current.getAudioTracks()[0];
    }

    const tracks = [canvasStream.getVideoTracks()[0], ...(audioTrack ? [audioTrack] : [])];
    const mimeType = ['video/mp4;codecs=h264,aac', 'video/webm;codecs=vp9,opus', 'video/webm']
      .find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

    chunksRef.current = [];
    const recorder = new MediaRecorder(new MediaStream(tracks), { mimeType });
    recorderRef.current = recorder;
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => finishRecording(new Blob(chunksRef.current, { type: mimeType }));
    recorder.start(100);

    setRecState('recording');
    setTimeLeft(event.videoDuration);
    let remaining = event.videoDuration;
    timerRef.current = setInterval(() => {
      remaining--;
      setTimeLeft(remaining);
      if (remaining <= 0) { clearInterval(timerRef.current!); recorder.stop(); }
    }, 1000);
  }, [event.videoDuration, finishRecording, musicSrc]);

  const startCountdown = useCallback(() => {
    setRecState('countdown');
    let count = 3; setCountdown(count);
    const t = setInterval(() => { count--; setCountdown(count); if (count <= 0) { clearInterval(t); startRecording(); } }, 1000);
  }, [startRecording]);

  const progress = ((event.videoDuration - timeLeft) / event.videoDuration) * 100;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <audio ref={audioElRef} />
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />

      <div className="relative flex-1 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

        {/* Indicador online/offline */}
        <div className="absolute top-6 left-5 z-40">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold ${isOnline ? 'bg-emerald-900/80 text-emerald-400' : 'bg-red-900/80 text-red-400'}`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>

        {recState === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/90 space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm font-mono">Carregando moldura e música...</p>
          </div>
        )}

        {(recState === 'requesting' || error) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/80 p-8 text-center space-y-6">
            <Camera className="w-20 h-20 text-slate-500" />
            <p className="text-white font-bold text-xl">{error || 'Solicitando câmera...'}</p>
            {error && <button onClick={startCamera} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg">Tentar Novamente</button>}
          </div>
        )}

        {recState === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/30">
            <span className="text-[160px] font-black text-white drop-shadow-2xl leading-none animate-pulse">
              {countdown === 0 ? '🎬' : countdown}
            </span>
          </div>
        )}

        {recState === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/80 space-y-4">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-bold text-lg">Processando vídeo...</p>
            <p className="text-indigo-400 text-sm font-mono">{uploadProgress}</p>
            {!isOnline && <p className="text-amber-400 text-xs font-mono">📴 Será sincronizado quando tiver internet</p>}
          </div>
        )}

        {recState === 'recording' && (
          <>
            <div className="absolute top-6 left-0 right-0 flex justify-between px-5 z-30 mt-10">
              <div className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-full shadow-lg">
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-sm font-bold font-mono">{event.videoDuration - timeLeft + 1}S / {event.videoDuration}S</span>
              </div>
              <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-full">
                <span className="text-white text-sm font-bold font-mono">REC ●</span>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800 z-30">
              <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
          </>
        )}

        {(recState === 'preview' || recState === 'countdown') && (
          <div className="absolute top-6 right-5 z-40 mt-0">
            <button onClick={() => { stopAll(); onCancel(); }}
              className="w-11 h-11 bg-black/50 backdrop-blur rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
      </div>

      <div className="bg-black py-10 flex items-center justify-center gap-8 z-30">
        {recState === 'preview' && (
          <>
            <button onClick={() => { stopAll(); onCancel(); }} className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center">
              <X className="w-6 h-6 text-white" />
            </button>
            <button onClick={startCountdown} className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-red-500 active:scale-95 transition-transform">
              <div className="w-16 h-16 bg-red-500 rounded-full" />
            </button>
            <button onClick={startCamera} className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-white" />
            </button>
          </>
        )}
        {recState === 'recording' && (
          <button onClick={() => { recorderRef.current?.stop(); if (timerRef.current) clearInterval(timerRef.current); }}
            className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-red-500 active:scale-95 transition-transform">
            <div className="w-10 h-10 bg-red-500 rounded-md" />
          </button>
        )}
        {recState === 'processing' && <p className="text-slate-500 text-xs font-mono">{uploadProgress || 'Aguarde...'}</p>}
      </div>
    </div>
  );
}