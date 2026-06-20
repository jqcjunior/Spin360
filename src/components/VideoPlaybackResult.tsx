/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { RotateCcw, QrCode, Share2 } from 'lucide-react';
import { VideoRecord, Event } from '../types';
import { supabase } from '../lib/supabase';
import { SpinDb } from '../db';

interface Props {
  video: VideoRecord;
  event: Event;
  onRecordAgain: () => void;
}

export default function VideoPlaybackResult({ video, event, onRecordAgain }: Props) {
  const [localVideo, setLocalVideo] = useState<VideoRecord>(video);
  const [sharing, setSharing]   = useState(false);
  const [shared, setShared]     = useState(false);
  const [error, setError]       = useState('');

  const isSupabaseUrl = localVideo.url.startsWith('https://');
  const shareUrl = `${window.location.origin}?v=${localVideo.slug}`;
  const qrUrl    = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}&bgcolor=0f172a&color=ffffff&margin=10`;

  // Update localVideo state if video prop changes
  useEffect(() => {
    setLocalVideo(video);
  }, [video]);

  // Log VIDEO_CREATED when video is first received
  useEffect(() => {
    console.log('[LOG] VIDEO_CREATED', {
      id: video.id,
      slug: video.slug,
      status: video.status,
      url: video.url
    });
  }, [video.id]);

  // Log QR_READY when permanent URL is ready
  useEffect(() => {
    if (isSupabaseUrl) {
      console.log('[LOG] QR_READY', {
        id: localVideo.id,
        url: localVideo.url
      });
    }
  }, [isSupabaseUrl, localVideo.id, localVideo.url]);

  // Polling logic for video status sync
  useEffect(() => {
    if (localVideo.status === 'completed' && localVideo.url.startsWith('https://')) {
      return;
    }

    let intervalId: any = null;
    let isMounted = true;

    const checkStatus = async () => {
      try {
        // 1. Check local SpinDb first (if UploadService already fulfilled it)
        const localCopy = SpinDb.getVideos().find((x: any) => x.id === video.id);
        if (localCopy && localCopy.status === 'completed' && localCopy.url.startsWith('https://')) {
          if (isMounted) {
            console.log('[LOG] VIDEO_UPLOADED', video.id);
            console.log('[LOG] VIDEO_COMPLETED', video.id);
            console.log('[LOG] VIDEO_STATE_UPDATED', {
              id: video.id,
              status: 'completed',
              url: localCopy.url
            });
            setLocalVideo(localCopy);
          }
          if (intervalId) clearInterval(intervalId);
          return;
        }

        // 2. Query Supabase directly
        const { data, error: queryErr } = await supabase
          .from('videos')
          .select('id, processed_video_url, status')
          .eq('id', video.id)
          .maybeSingle();

        if (queryErr) {
          console.warn('[Polling] Error querying Supabase:', queryErr);
          return;
        }

        if (data && data.status === 'completed' && data.processed_video_url) {
          console.log('[LOG] VIDEO_UPLOADED', video.id);
          console.log('[LOG] VIDEO_COMPLETED', video.id);

          const updated: VideoRecord = {
            ...localVideo,
            url: data.processed_video_url,
            status: 'completed'
          };

          // Save to local database
          SpinDb.saveVideo(updated);

          if (isMounted) {
            console.log('[LOG] VIDEO_STATE_UPDATED', {
              id: video.id,
              status: 'completed',
              url: data.processed_video_url
            });
            setLocalVideo(updated);
          }

          if (intervalId) clearInterval(intervalId);
        }
      } catch (err) {
        console.error('[Polling] Error in video status check:', err);
      }
    };

    // Run immediately and start interval
    checkStatus();
    intervalId = setInterval(checkStatus, 2000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [video.id, localVideo.status, localVideo.url]);

  // ÚNICA função de compartilhamento — funciona no iPhone, Android e Desktop
  const handleShare = async (channel?: string) => {
    if (sharing) return;
    setSharing(true);
    setError('');

    try {
      // Busca o vídeo como Blob
      const response = await fetch(localVideo.url);
      if (!response.ok) throw new Error('Erro ao carregar vídeo');
      const blob = await response.blob();
      const file = new File([blob], `Real360_${localVideo.slug}.mp4`, { type: 'video/mp4' });

      // iOS/Android: usa gaveta nativa com o arquivo
      // → usuário escolhe: Fotos, WhatsApp, AirDrop, etc.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Meu vídeo no ${event.name}`,
          text: 'Gravei esse vídeo na ativação Real 360°!',
          files: [file],
        });
        setShared(true);
        setTimeout(() => setShared(false), 3000);
        return;
      }

      // Desktop: download direto
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `Real360_${localVideo.slug}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      setShared(true);
      setTimeout(() => setShared(false), 3000);

    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Usuário cancelou a gaveta — não é erro
        return;
      }
      // Se fetch falhou (blob URL expirou), tenta abrir URL diretamente
      if (isSupabaseUrl) {
        window.open(localVideo.url, '_blank');
      } else {
        setError('Vídeo ainda sendo processado. Tente em alguns segundos.');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto space-y-5 py-4 px-2 animate-fade-in">

      {/* Preview do vídeo */}
      <div className="rounded-3xl overflow-hidden bg-black aspect-[9/16] max-h-72 relative shadow-2xl">
        <video
          src={localVideo.url}
          autoPlay loop muted playsInline
          className="w-full h-full object-cover"
          onLoadedMetadata={(e) => {
            const vidEl = e.currentTarget;
            const duration = vidEl.duration;
            const ext = localVideo.url.split('.').pop()?.split('?')[0] || 'webm';
            const contentType = ext === 'webm' ? 'video/webm' : 'video/mp4';

            console.log('[LOG] VIDEO_URL', localVideo.url);
            console.log('[LOG] VIDEO_CONTENT_TYPE', contentType);
            console.log('[LOG] VIDEO_DURATION', duration);
          }}
          onCanPlay={() => {
            console.log('[LOG] VIDEO_CANPLAY_EVENT', localVideo.id);
          }}
          onError={(e) => {
            const err = (e.currentTarget as HTMLVideoElement).error;
            console.error('[LOG] VIDEO_ERROR_EVENT', {
              code: err?.code,
              message: err?.message || 'Media source error'
            });
          }}
          onStalled={() => {
            console.warn('[LOG] VIDEO_STALLED_EVENT', localVideo.id);
          }}
        />
        <div className="absolute top-3 left-3 bg-emerald-600/90 backdrop-blur text-white text-[10px] font-bold font-mono px-3 py-1 rounded-full">
          ✓ GRAVADO
        </div>
      </div>

      {/* Info */}
      <div className="text-center space-y-0.5">
        <h3 className="text-white font-bold text-lg leading-tight">{event.name}</h3>
        <p className="text-slate-500 text-[10px] font-mono">ID: {localVideo.slug}</p>
      </div>

      {/* QR Code — só aparece quando tem URL permanente */}
      {isSupabaseUrl && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <QrCode className="w-3.5 h-3.5 text-indigo-400" />
            Aponte a câmera em outro dispositivo para baixar
          </div>
          <img src={qrUrl} alt="QR Code" className="w-40 h-40 rounded-xl" />
          <p className="text-[10px] text-slate-600 font-mono break-all text-center">{shareUrl}</p>
        </div>
      )}

      {!isSupabaseUrl && (
        <div className="bg-amber-900/20 border border-amber-700/30 rounded-2xl p-3 text-center">
          <p className="text-amber-400 text-xs font-mono">⏳ Sincronizando com a nuvem...</p>
          <p className="text-amber-500/60 text-[10px] font-mono mt-1">QR Code disponível em instantes</p>
        </div>
      )}

      {/* BOTÃO PRINCIPAL — Salvar / Compartilhar */}
      <button
        onClick={() => handleShare()}
        disabled={sharing}
        className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 disabled:opacity-60 rounded-2xl font-bold text-white text-lg flex flex-col items-center justify-center gap-1 shadow-xl cursor-pointer transition-all active:scale-95">
        {sharing ? (
          <>
            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Carregando vídeo...</span>
          </>
        ) : shared ? (
          <>
            <span className="text-2xl">✓</span>
            <span className="text-sm">Pronto!</span>
          </>
        ) : (
          <>
            <Share2 className="w-7 h-7" />
            <span>Salvar / Compartilhar Vídeo</span>
            <span className="text-xs opacity-70 font-normal">Fotos · WhatsApp · AirDrop · e mais</span>
          </>
        )}
      </button>

      {/* Mensagem de erro */}
      {error && (
        <p className="text-red-400 text-xs font-mono text-center bg-red-950/30 border border-red-900/30 rounded-xl px-3 py-2">
          ⚠ {error}
        </p>
      )}

      {/* Gravar novamente */}
      <button
        onClick={onRecordAgain}
        className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 text-sm flex items-center justify-center gap-2 font-mono cursor-pointer transition-colors">
        <RotateCcw className="w-4 h-4" />
        Gravar Novamente
      </button>

    </div>
  );
}
