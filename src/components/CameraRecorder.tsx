import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, RefreshCw, Camera } from 'lucide-react';
import { Event, VideoLead, VideoRecord } from '../types';
import { SpinDb, DEMO_FRAMES_SVG } from '../db';

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

  const frame = SpinDb.getFrames().find(f => f.id === event.frameId);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
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

  useEffect(() => {
    startCamera();
    return () => stopStream();
  }, [startCamera, stopStream]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      finishRecording(blob);
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
        setRecState('processing');
      }
    }, 1000);
  }, [event.videoDuration]);

  const finishRecording = useCallback((blob: Blob) => {
    // Salvar automaticamente na galeria do celular
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Spin360_${event.name.replace(/\s+/g,'_')}_${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Criar registro do vídeo
    const slug = Math.random().toString(36).slice(2, 7);
    const video: VideoRecord = {
      id: 'vid_' + Date.now(),
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
  }, [event, lead, onRecordingComplete, stopStream]);

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
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setRecState('processing');
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

        {/* Moldura */}
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

        {/* Contagem regressiva */}
        {recState === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/30">
            <span className="text-[160px] font-black text-white drop-shadow-2xl leading-none animate-pulse">
              {countdown === 0 ? '🎬' : countdown}
            </span>
          </div>
        )}

        {/* Processando */}
        {recState === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/70 space-y-4">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-bold text-lg">Processando...</p>
            <p className="text-slate-400 text-sm">Salvando na galeria do celular</p>
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
            <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-full">
              <span className="text-white text-sm font-bold font-mono">VEL: 1.0X</span>
            </div>
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
