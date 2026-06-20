/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { Event, VideoLead, VideoRecord } from '../types';
import { SpinDb } from '../db';
import { supabase } from '../lib/supabase';
import { getAsset } from '../lib/cache';

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

const CANVAS_W = 1080;
const CANVAS_H = 1920;

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
  const safetyRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const duration = event.videoDuration || 10;

  const [phase, setPhase]         = useState<'loading' | 'ready' | 'countdown' | 'recording' | 'saving'>('loading');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft]   = useState(duration);
  const [camError, setCamError]   = useState(false);

  const cleanup = useCallback(() => {
    if (animRef.current)   cancelAnimationFrame(animRef.current);
    if (timerRef.current)  clearInterval(timerRef.current);
    if (safetyRef.current) clearTimeout(safetyRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    try { audioElRef.current?.pause(); } catch {}
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

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
            if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
            img.src = src;
            await new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); });
            if (img.naturalWidth > 0) frameImgRef.current = img;
          }
        } catch {}
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
            audioElRef.current.volume = 0.8;
          }
        } catch {}
      }

      setPhase('ready');
    };
    load();
  }, []);

  useEffect(() => {
    if (phase !== 'ready') return;
    let cancelled = false;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;

      const vid = videoRef.current!;
      vid.srcObject = stream;
      vid.muted = true;
      vid.playsInline = true;
      vid.play().catch(() => {});

      const canvas = canvasRef.current!;
      canvas.width  = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext('2d', { alpha: false })!;

      const draw = () => {
        if (vid.readyState >= 2) {
          const vW = vid.videoWidth  || 640;
          const vH = vid.videoHeight || 480;
          const scale   = Math.max(CANVAS_W / vW, CANVAS_H / vH);
          const drawW   = vW * scale;
          const drawH   = vH * scale;
          const offsetX = (CANVAS_W - drawW) / 2;
          const offsetY = (CANVAS_H - drawH) / 2;

          ctx.save();
          ctx.translate(CANVAS_W, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(vid, offsetX, offsetY, drawW, drawH);
          ctx.restore();

          if (frameImgRef.current?.complete && frameImgRef.current.naturalWidth > 0) {
            ctx.drawImage(frameImgRef.current, 0, 0, CANVAS_W, CANVAS_H);
          }
        } else {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        }
        animRef.current = requestAnimationFrame(draw);
      };
      draw();
      setCamError(false);
    }).catch(() => {
      if (!cancelled) setCamError(true);
    });

    return () => { cancelled = true; };
  }, [phase]);

  const stopRecording = useCallback(() => {
    if (timerRef.current)  { clearInterval(timerRef.current);  timerRef.current  = null; }
    if (safetyRef.current) { clearTimeout(safetyRef.current);  safetyRef.current = null; }
    try { audioElRef.current?.pause(); } catch {}
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch {}
    }
  }, []);

  const finish = useCallback(async (blob: Blob) => {
    setPhase('saving');
    const slug    = Math.random().toString(36).slice(2, 7);
    const videoId = uuid();
    const localUrl = URL.createObjectURL(blob);

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
        const ext  = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const path = `${event.id}/${slug}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('videos-processed')
          .upload(path, blob, { contentType: blob.type, upsert: true });

        if (!upErr) {
          const { data } = supabase.storage.from('videos-processed').getPublicUrl(path);
          await (supabase.from('videos') as any).insert({
            id: videoId, event_id: event.id, lead_id: null,
            public_slug: slug, processed_video_url: data.publicUrl,
            duration_seconds: duration, status: 'completed',
            created_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
          });
          const vids = SpinDb.getVideos();
          const v = vids.find((x: any) => x.id === videoId);
          if (v) SpinDb.saveVideo({ ...v, url: data.publicUrl, status: 'completed' });
        }
      } catch {}
    }
  }, [event, lead, duration, cleanup, onRecordingComplete]);

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    const stream = streamRef.current;
    if (!canvas || !stream) return;

    try { audioElRef.current?.play().catch(() => {}); } catch {}

    let recordStream = stream;
    try {
      const cs = (canvas as any).captureStream(30) as MediaStream;
      if (cs.getVideoTracks().length > 0) {
        recordStream = new MediaStream([
          cs.getVideoTracks()[0],
          ...stream.getAudioTracks(),
        ]);
      }
    } catch {}

    const mimeType = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
      .find(t => MediaRecorder.isTypeSupported(t)) || '';

    chunksRef.current = [];
    const rec = new MediaRecorder(recordStream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 2_500_000,
      audioBitsPerSecond: 128_000,
    });
    recorderRef.current = rec;
    rec.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => finish(new Blob(chunksRef.current, { type: mimeType || 'video/webm' }));
    rec.start(200);

    setPhase('recording');
    setTimeLeft(duration);

    let rem = duration;
    timerRef.current = setInterval(() => {
      rem -= 1;
      setTimeLeft(rem);
      if (rem <= 0) stopRecording();
    }, 1000);

    safetyRef.current = setTimeout(() => stopRecording(), (duration + 3) * 1000);
  }, [duration, finish, stopRecording]);

  const startCountdown = useCallback(() => {
    setPhase('countdown');
    let c = 3;
    setCountdown(c);
    const t = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) { clearInterval(t); startRecording(); }
    }, 1000);
  }, [startRecording]);

  const cancel = useCallback(() => {
    stopRecording();
    cleanup();
    onCancel();
  }, [stopRecording, cleanup, onCancel]);

  const progress = ((duration - timeLeft) / duration) * 100;

  return (
    <div className="fixed inset-0 z-[200] bg-black">
      <audio ref={audioElRef} playsInline />
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover' }} />

      {phase === 'loading' && (
        <div className="absolute inset-0 z-10 bg-black flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white text-sm font-mono">Preparando câmera...</p>
        </div>
      )}

      {camError && (
        <div className="absolute inset-0 z-10 bg-black/90 flex flex-col items-center justify-center gap-6 p-8 text-center">
          <p className="text-white font-bold text-xl">Câmera bloqueada</p>
          <p className="text-slate-400 text-sm">Permita o acesso à câmera e recarregue.</p>
          <button onClick={cancel} className="px-6 py-3 bg-slate-800 text-white rounded-2xl">Voltar</button>
        </div>
      )}

      {phase === 'countdown' && (
        <div className="absolute inset-0 z-10 flex items-end justify-center pb-48 pointer-events-none">
          <div className="bg-black/60 backdrop-blur w-24 h-24 rounded-3xl flex items-center justify-center">
            <span className="text-white text-6xl font-black">{countdown}</span>
          </div>
        </div>
      )}

      {phase === 'recording' && (
        <>
          <div className="absolute top-8 left-5 z-10 flex items-center gap-2 bg-red-600 px-4 py-2 rounded-full">
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
            <span className="text-white text-sm font-bold font-mono">GRAVANDO</span>
          </div>
          <div className="absolute top-8 right-20 z-10 bg-black/70 backdrop-blur px-4 py-2 rounded-2xl text-center min-w-[60px]">
            <p className="text-white text-3xl font-black font-mono leading-none">{timeLeft}</p>
            <p className="text-slate-400 text-[10px] font-mono">seg</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/40 z-10">
            <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}

      {phase === 'saving' && (
        <div className="absolute inset-0 z-10 bg-black/80 flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white font-bold">Processando...</p>
        </div>
      )}

      {(phase === 'ready' || phase === 'countdown' || phase === 'recording') && (
        <button
          onClick={cancel}
          className="absolute top-8 z-20 w-12 h-12 bg-black/60 backdrop-blur rounded-full flex items-center justify-center"
          style={{ right: phase === 'recording' ? '8px' : '20px' }}>
          <X className="w-6 h-6 text-white" />
        </button>
      )}

      <div className="absolute bottom-10 left-0 right-0 z-10 flex items-center justify-center gap-8">
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
          <button onClick={stopRecording} className="w-24 h-24 rounded-full bg-white border-4 border-red-500 flex items-center justify-center shadow-2xl active:scale-95 transition-transform">
            <div className="w-10 h-10 bg-red-500 rounded-lg" />
          </button>
        )}
      </div>
    </div>
  );
}