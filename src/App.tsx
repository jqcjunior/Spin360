/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Camera, LayoutDashboard, QrCode, MonitorPlay,
  ArrowRight, ShieldCheck, Download,
  Share2, Check, Copy, MessageCircle, Flame, Star
} from 'lucide-react';
import { Event, VideoRecord, VideoLead } from './types';
import { SpinDb } from './db';
import { getActiveEvents } from './lib/api';
import AdminDashboard from './components/AdminDashboard';
import AuthGuard from './components/AuthGuard';
import LeadCaptureModal from './components/LeadCaptureModal';
import CameraRecorder from './components/CameraRecorder';
import VideoPlaybackResult from './components/VideoPlaybackResult';

import useOfflineSync from './hooks/useOfflineSync';

export default function App() {
  useOfflineSync();
  const [viewMode, setViewMode] = useState<'totem' | 'admin' | 'public_video'>('totem');
  const [totemState, setTotemState] = useState<'selection' | 'lead' | 'recorder' | 'result'>('selection');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [activeLead, setActiveLead] = useState<VideoLead | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<VideoRecord | null>(null);
  const [publicSlug, setPublicSlug] = useState<string>('');
  const [pbCopied, setPbCopied] = useState(false);
  const [pbDownloadSuccess, setPbDownloadSuccess] = useState(false);

  // ÚNICO estado de eventos — vem SOMENTE do Supabase
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Rota por URL
  useEffect(() => {
    const path = window.location.pathname;
    const queryV = new URLSearchParams(window.location.search).get('v');
    if (path.startsWith('/video/')) {
      const slug = path.split('/video/')[1];
      if (slug) { setPublicSlug(slug); setViewMode('public_video'); }
    } else if (queryV) {
      setPublicSlug(queryV);
      setViewMode('public_video');
    }
  }, []);

  // Carrega eventos DO SUPABASE — sem localStorage, sem duplicatas
  useEffect(() => {
    getActiveEvents()
      .then(events => {
        setActiveEvents(events);
        console.log(`[App] ${events.length} eventos carregados:`, events.map(e => e.name));
      })
      .catch(err => console.error('[App] Erro:', err))
      .finally(() => setLoadingEvents(false));
  }, []);

  const handleSelectEvent = (event: Event) => {
    setSelectedEvent(event);
    setActiveLead(null);
    setGeneratedVideo(null);
    setTotemState(event.enableLeadCapture ? 'lead' : 'recorder');
  };

  const handleLeadFormComplete = (lead: VideoLead) => {
    setActiveLead(lead);
    setTotemState('recorder');
  };

  const handleRecordingSuccess = (video: VideoRecord) => {
    setGeneratedVideo(video);
    setTotemState('result');
  };

  const handleResetTotemFlow = () => {
    setSelectedEvent(null);
    setActiveLead(null);
    setGeneratedVideo(null);
    setTotemState('selection');
  };

  const handlePublicDownload = async (vid: VideoRecord) => {
    SpinDb.registerDownload(vid.id);
    setPbDownloadSuccess(true);
    setTimeout(() => setPbDownloadSuccess(false), 3000);
    try {
      const response = await fetch(vid.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Real360_${vid.slug}.mp4`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      const link = document.createElement('a');
      link.href = vid.url; link.target = '_blank'; link.download = `Real360_${vid.slug}.mp4`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }
  };

  const handlePublicShare = async (vid: VideoRecord, channel: string) => {
    SpinDb.registerShare(vid.id, channel as any);
    const shareUrl = `${window.location.origin}?v=${vid.slug}`;
    const shareText = `Veja meu vídeo: ${shareUrl}`;

    if (channel === 'whatsapp') {
      try {
        const blob = await fetch(vid.url).then(r => r.blob());
        const file = new File([blob], `Real360_${vid.slug}.mp4`, { type: 'video/mp4' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] }); return;
        }
      } catch {}
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank'); return;
    }

    if (channel === 'airdrop' || channel === 'nearby') {
      try {
        const blob = await fetch(vid.url).then(r => r.blob());
        const file = new File([blob], `Real360_${vid.slug}.mp4`, { type: 'video/mp4' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] }); return;
        }
      } catch {}
      try { await navigator.share?.({ url: shareUrl }); } catch {}
      return;
    }

    if (channel === 'link') {
      navigator.clipboard.writeText(shareUrl);
      setPbCopied(true); setTimeout(() => setPbCopied(false), 2500);
    }
  };

  const allLocalVideos = SpinDb.getVideos();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between">

      {/* HEADER */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">

          <div className="flex items-center gap-2.5 cursor-pointer" onClick={handleResetTotemFlow}>
            <img src="/Logo.nova.png" alt="Real 360°" className="w-11 h-11 rounded-2xl object-cover shadow-lg border border-slate-700/50" />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-display font-black text-white tracking-tight">REAL 360°</h1>
                <span className="text-[9px] bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded border border-amber-700/30 uppercase font-bold tracking-wider font-mono">PWA</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">Real Promotion Engine v1.0</p>
            </div>
          </div>

          <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-medium gap-1">
            <button onClick={() => { setViewMode('totem'); handleResetTotemFlow(); }}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'totem' ? 'bg-indigo-600 text-white shadow font-bold' : 'text-slate-400 hover:text-white'}`}>
              <MonitorPlay className="w-3.5 h-3.5" /><span>Totem</span>
            </button>
            <button onClick={() => setViewMode('admin')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'admin' ? 'bg-indigo-600 text-white shadow font-bold' : 'text-slate-400 hover:text-white'}`}>
              <LayoutDashboard className="w-3.5 h-3.5" /><span>Admin</span>
            </button>
            <button onClick={() => { setViewMode('public_video'); const v = allLocalVideos; if (v.length > 0) setPublicSlug(v[0].slug); }}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'public_video' ? 'bg-indigo-600 text-white shadow font-bold' : 'text-slate-400 hover:text-white'}`}>
              <QrCode className="w-3.5 h-3.5" /><span>Download</span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-slate-500 font-mono text-[10px]">
            <span>OPERADOR: jqcjunior1981</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 py-8">

        {/* TOTEM */}
        {viewMode === 'totem' && (
          <div>
            {totemState === 'selection' && (
              <div className="space-y-8">
                <div className="text-center space-y-3 py-4 max-w-xl mx-auto">
                  <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-[10px] font-bold font-mono tracking-widest uppercase border border-indigo-500/20">
                    <Star className="w-3.5 h-3.5 fill-current" /> Ativação de Marca Real 360°
                  </div>
                  <h2 className="text-3xl font-display font-extrabold text-white tracking-tight sm:text-4xl">Selecione o seu Evento</h2>
                  <p className="text-slate-400 text-sm">Grave um vídeo com moldura e música e baixe pelo QR Code!</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {loadingEvents && (
                    <div className="col-span-full text-center py-12">
                      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-slate-500 text-xs font-mono">Carregando eventos...</p>
                    </div>
                  )}

                  {!loadingEvents && activeEvents.map((e) => (
                    <div key={e.id} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col hover:border-slate-700 transition-all group p-1.5">
                      <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950">
                        {e.coverUrl
                          ? <img referrerPolicy="no-referrer" src={e.coverUrl} alt={e.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center"><Camera className="w-8 h-8 text-slate-800" /></div>
                        }
                        <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-xl text-[9px] font-mono tracking-widest font-bold uppercase text-amber-500 border border-slate-800">
                          {e.category}
                        </div>
                      </div>
                      <div className="p-4 space-y-1.5 flex-1 mt-2">
                        <h3 className="text-white text-lg font-display font-bold leading-snug group-hover:text-indigo-400 transition-colors">{e.name}</h3>
                        <p className="text-slate-400 text-xs line-clamp-2">{e.description || 'Evento ativo.'}</p>
                      </div>
                      <div className="p-4 bg-slate-950/60 rounded-2xl mx-1.5 mb-1.5 flex justify-between items-center text-xs">
                        <span className="font-mono text-slate-500 flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-red-500" /> Totem Ativo</span>
                        <button onClick={() => handleSelectEvent(e)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold font-mono text-[11px] tracking-wider transition-all flex items-center gap-1 cursor-pointer">
                          GRAVAR VÍDEO <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {!loadingEvents && activeEvents.length === 0 && (
                    <div className="col-span-full bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-3">
                      <p className="text-slate-400 text-xs font-mono">Nenhum evento ativo no momento.</p>
                      <button onClick={() => setViewMode('admin')} className="bg-indigo-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold font-mono cursor-pointer">
                        Ir ao Painel Admin
                      </button>
                    </div>
                  )}
                </div>

                {allLocalVideos.length > 0 && (
                  <div className="bg-slate-900/30 p-6 rounded-3xl border border-slate-800/80">
                    <h3 className="text-white text-sm font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-indigo-400" /> Gravações Recentes
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                      {allLocalVideos.slice(-6).map((vid) => (
                        <div key={vid.id}
                          style={{ borderTopColor: '#6366f1' }}
                          className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden p-2 flex flex-col border-t-4 hover:border-slate-600 cursor-pointer transition-all"
                          onClick={() => { setPublicSlug(vid.slug); setViewMode('public_video'); }}>
                          <div className="aspect-[9/16] bg-slate-900 rounded-lg overflow-hidden relative">
                            <video src={vid.url} muted playsInline className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <span className="text-[10px] bg-slate-950 text-indigo-400 font-mono p-1 rounded font-bold">slug: {vid.slug}</span>
                            </div>
                          </div>
                          <div className="text-[10px] font-mono mt-2 flex justify-between text-slate-500">
                            <span>👁 {vid.viewsCount}</span><span>💾 {vid.downloadsCount}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {totemState === 'lead' && selectedEvent && (
              <LeadCaptureModal event={selectedEvent} onLeadCaptured={handleLeadFormComplete} onCancel={handleResetTotemFlow} />
            )}
            {totemState === 'recorder' && selectedEvent && (
              <CameraRecorder event={selectedEvent} lead={activeLead} onRecordingComplete={handleRecordingSuccess} onCancel={handleResetTotemFlow} />
            )}
            {totemState === 'result' && generatedVideo && selectedEvent && (
              <VideoPlaybackResult video={generatedVideo} event={selectedEvent} onRecordAgain={handleResetTotemFlow} />
            )}
          </div>
        )}

        {/* ADMIN — protegido por login */}
        {viewMode === 'admin' && (
          <AuthGuard>
            <AdminDashboard onSelectEventForCapture={(evt) => {
              setSelectedEvent(evt); setViewMode('totem');
              setTotemState(evt.enableLeadCapture ? 'lead' : 'recorder');
            }} />
          </AuthGuard>
        )}

        {/* PÁGINA DE DOWNLOAD */}
        {viewMode === 'public_video' && (
          <div className="max-w-sm mx-auto space-y-4 py-4">
            {(() => {
              const currentVideo = SpinDb.getVideoBySlug(publicSlug) || allLocalVideos[0];
              if (!currentVideo) return (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-xs font-mono text-slate-500">
                  Nenhum vídeo encontrado. Realize uma gravação primeiro.
                </div>
              );
              const shareUrl = `${window.location.origin}?v=${currentVideo.slug}`;
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}&bgcolor=0f172a&color=ffffff&margin=12`;
              return (
                <div className="space-y-4">
                  <div className="text-center space-y-1">
                    <span className="text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full uppercase font-bold">✓ Vídeo Verificado (LGPD)</span>
                    <h3 className="text-xl font-display font-extrabold text-white pt-1">Portal do Participante</h3>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col items-center gap-3">
                    <p className="text-xs font-bold text-white">Aponte a câmera para baixar</p>
                    <img src={qrUrl} alt="QR Code" className="w-52 h-52 rounded-2xl border-2 border-indigo-500/30" />
                    <p className="text-[10px] text-slate-500 font-mono text-center break-all px-2">{shareUrl}</p>
                  </div>
                  <div className="space-y-2.5">
                    <button onClick={() => handlePublicDownload(currentVideo)}
                      className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 rounded-2xl text-sm font-bold text-white uppercase flex items-center justify-center gap-2 shadow-lg cursor-pointer">
                      <Download className="w-4 h-4" /> Baixar Vídeo (MP4)
                    </button>
                    {pbDownloadSuccess && <p className="text-center text-[10px] text-emerald-400 font-bold font-mono">✓ Download iniciado!</p>}
                    <button onClick={() => handlePublicShare(currentVideo, 'whatsapp')}
                      className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer">
                      <MessageCircle className="w-4 h-4" /> Enviar pelo WhatsApp
                    </button>
                    <button onClick={() => handlePublicShare(currentVideo, 'airdrop')}
                      className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer">
                      <Share2 className="w-4 h-4" /> AirDrop / Compartilhar
                    </button>
                    <button onClick={() => handlePublicShare(currentVideo, 'link')}
                      className="w-full py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs flex items-center justify-center gap-2 font-mono cursor-pointer">
                      {pbCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
                      {pbCopied ? 'Link copiado!' : 'Copiar link direto'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>

      <footer className="bg-slate-950 border-t border-slate-900 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500 font-mono">
          <p>© 2026 Real 360° Inc. Todos os direitos reservados.</p>
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-emerald-500" /> RLS Ativo</span>
            <span className="text-indigo-400">PWA Instalável</span>
          </div>
        </div>
      </footer>
    </div>
  );
}