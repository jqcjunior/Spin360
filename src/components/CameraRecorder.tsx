/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, RefreshCw, Camera } from 'lucide-react';
import { Event, VideoLead, VideoRecord } from '../types';
import { SpinDb, DEMO_FRAMES_SVG } from '../db';
import { supabase } from '../lib/supabase';

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
  const [uploadProgress, setUploadProgress] = useState('');

  const frame = SpinDb.getFrames().find(f => f.id === event.frameId);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

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

  useEffect(() => { startCamera(); return () => stopStream(); }, [startCamera, stopStream]);

  const finishRecording = useCallback(async (blob: Blob) => {
    setRecState('processing');
    setUploadProgress('Salvando na galeria...');

    const localUrl = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = localUrl;
      a.download = `Real360_${event.name.replace(/\s+/g, '_')}_${Date.now()}.mp4`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch {}

    const slug = Math.random().toString(36).slice(2, 7);
    let videoUrl = localUrl;

    setUploadProgress('Enviando para a nuvem...');
    try {
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const filePath = `${event.id}/${slug}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('videos-processed')
        .upload(filePath, blob, { contentType: blob.type, upsert: true });

      if (!uploadError) {
        const { data } = supabase.storage.from('videos-processed').getPublicUrl(filePath);
        videoUrl = data.publicUrl;
        setUploadProgress('Registrando no banco...');

        await (supabase.from('events') as any).upsert({
          id: event.id, name: event.name, status: event.status || 'active',
          video_duration_seconds: event.videoDuration, category: event.category || 'Geral',
          theme_color: event.themeColor || '#6366f1', totem_mode_enabled: event.enableTotemMode || false,
          lead_capture_config: {}, created_at: event.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (lead) {
          await (supabase.from('video_leads') as any).upsert({
            id: lead.id, event_id: lead.eventId, name: lead.name || null,
            phone: lead.phone || null, email: lead.email || null,
            lgpd_consent: lead.lgpdConsent, lgpd_consent_at: lead.consentTimestamp,
            created_at: new Date().toISOString(),
          });
        }

        await (supabase.from('videos') as any).upsert({
          id: 'vid_' + Date.now(), event_id: event.id, lead_id: lead?.id ?? null,
          public_slug: slug, processed_video_url: videoUrl,
          duration_seconds: event.videoDuration, status: 'completed',
          created_at: new Date().toISOString(), processed_at: new Date().toISOString(),
        });

        console.log(`[Real360] ✅ ${slug} → ${videoUrl}`);
      }
    } catch (err) {
      console.error('[Real360] Upload error:', err);
    }

    const video: VideoRecord = {
      id: 'vid_' + Date.now(), slug, eventId: event.id, leadId: lead?.id,
      url: videoUrl, thumbnailUrl: '', duration: event.videoDuration, status: 'completed',
      effectAppliedId: event.effectPresetId, frameAppliedId: event.frameId,
      musicAppliedId: event.musicId, viewsCount: 0, downloadsCount: 0, sharesCount: 0,
      createdAt: new Date().toISOString(),
    };

    SpinDb.saveVideo(video);
    stopStream();
    setUploadProgress('');
    setTimeout(() => onRecordingComplete(video), 300);
  }, [event, lead, onRecordingComplete, stopStream]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
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
  }, [event.videoDuration, finishRecording]);

  const startCountdown = useCallback(() => {
    setRecState('countdown');
    let count = 3; setCountdown(count);
    const t = setInterval(() => { count--; setCountdown(count); if (count <= 0) { clearInterval(t); startRecording(); } }, 1000);
  }, [startRecording]);

  const stopEarly = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const renderFrame = () => {
    if (!frame) return null;
    if (frame.imageUrl.startsWith('http'))
      return <img src={frame.imageUrl} alt="frame" className="absolute inset-0 w-full h-full object-cover pointer-events-none z-20" />;
    return <div className="absolute inset-0 pointer-events-none z-20" dangerouslySetInnerHTML={{ __html: DEMO_FRAMES_SVG[frame.imageUrl] || '' }} />;
  };

  const progress = ((event.videoDuration - timeLeft) / event.videoDuration) * 100;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        {renderFrame()}
        {(recState === 'requesting' || error) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/80 p-8 text-center space-y-6">
            <Camera className="w-20 h-20 text-slate-500" />
            <p className="text-white font-bold text-xl">{error || 'Solicitando câmera...'}</p>
            {error && <button onClick={startCamera} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg">Tentar Novamente</button>}
          </div>
        )}
        {recState === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/30">
            <span className="text-[160px] font-black text-white drop-shadow-2xl leading-none animate-pulse">{countdown === 0 ? '🎬' : countdown}</span>
          </div>
        )}
        {recState === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/80 space-y-4">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-bold text-lg">Processando...</p>
            <p className="text-indigo-400 text-sm font-mono">{uploadProgress}</p>
          </div>
        )}
        {recState === 'recording' && (
          <>
            <div className="absolute top-6 left-0 right-0 flex justify-between px-5 z-30">
              <div className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-full">
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
          <div className="absolute top-6 right-5 z-40">
            <button onClick={() => { stopStream(); onCancel(); }} className="w-11 h-11 bg-black/50 backdrop-blur rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
      </div>
      <div className="bg-black py-10 flex items-center justify-center gap-8 z-30">
        {recState === 'preview' && (
          <>
            <button onClick={() => { stopStream(); onCancel(); }} className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center"><X className="w-6 h-6 text-white" /></button>
            <button onClick={startCountdown} className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-red-500 active:scale-95 transition-transform">
              <div className="w-16 h-16 bg-red-500 rounded-full" />
            </button>
            <button onClick={startCamera} className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center"><RefreshCw className="w-6 h-6 text-white" /></button>
          </>
        )}
        {recState === 'recording' && (
          <button onClick={stopEarly} className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-red-500 active:scale-95 transition-transform">
            <div className="w-10 h-10 bg-red-500 rounded-md" />
          </button>
        )}
        {recState === 'processing' && <p className="text-slate-500 text-xs font-mono">{uploadProgress || 'Aguarde...'}</p>}
      </div>
    </div>
  );
}
