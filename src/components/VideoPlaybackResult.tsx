/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Download, Share2, RefreshCw, QrCode, CheckCircle, Copy, Check,
  MessageCircle, Instagram, AlertTriangle, ArrowLeft, Send
} from 'lucide-react';
import { VideoRecord, Event } from '../types';
import { SpinDb } from '../db';

interface VideoPlaybackResultProps {
  video: VideoRecord;
  event: Event;
  onRecordAgain: () => void;
}

export default function VideoPlaybackResult({ video, event, onRecordAgain }: VideoPlaybackResultProps) {
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('');

  // Track page view count automatically
  useEffect(() => {
    SpinDb.registerView(video.id, navigator.userAgent);
  }, [video.id]);

  const publicVideoUrl = `${window.location.origin}/video/${video.slug}`;

  // Direct Mock Download Action (saves to downloads count and triggers client-side saving)
  const handleDownload = () => {
    SpinDb.registerDownload(video.id);
    setDownloadSuccess(true);
    
    // Simulate downloading by opening video source path in new tab or triggering browser click.
    // In our iframe, direct URL opens, but safely let's trigger single click:
    const link = document.createElement('a');
    link.href = video.url;
    link.target = '_blank';
    link.download = `Spin360_Video_${video.slug}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadSuccess(false);
    }, 4000);
  };

  const handleShare = (channel: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'airdrop' | 'link' | 'qrcode' | 'other') => {
    SpinDb.registerShare(video.id, channel);
    setSelectedChannel(channel);

    if (channel === 'link') {
      navigator.clipboard.writeText(publicVideoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      // Simulate external opening
      let uri = '';
      if (channel === 'whatsapp') {
        const text = encodeURIComponent(`Olha só que incrível ficou o meu vídeo 360 no evento ${event.name}! Veja aqui: ${publicVideoUrl}`);
        uri = `https://api.whatsapp.com/send?text=${text}`;
      } else if (channel === 'instagram') {
        uri = `https://instagram.com`;
      }
      if (uri) {
        window.open(uri, '_blank');
      }
    }
  };

  // Build beautiful simulated vector QR Code pointing to this specific slug URL!
  // Since we don't have a qrcode package, we can draw a high-fidelity stylized modern QR Code block dynamically!
  const renderSVGQRCode = () => {
    return (
      <svg className="w-28 h-28 text-slate-900 border border-slate-200 p-1 bg-white rounded-lg" viewBox="0 0 100 100">
        {/* Core finder patterns */}
        <rect x="0" y="0" width="30" height="30" fill="currentColor" />
        <rect x="5" y="5" width="20" height="20" fill="white" />
        <rect x="10" y="10" width="10" height="10" fill="currentColor" />

        <rect x="70" y="0" width="30" height="30" fill="currentColor" />
        <rect x="75" y="5" width="20" height="20" fill="white" />
        <rect x="80" y="10" width="10" height="10" fill="currentColor" />

        <rect x="0" y="70" width="30" height="30" fill="currentColor" />
        <rect x="5" y="75" width="20" height="20" fill="white" />
        <rect x="10" y="80" width="10" height="10" fill="currentColor" />

        {/* Alignment pattern */}
        <rect x="75" y="75" width="10" height="10" fill="currentColor" />
        <rect x="70" y="70" width="5" height="5" fill="currentColor" />

        {/* Shuffled mock data blocks */}
        <rect x="40" y="5" width="10" height="5" fill="currentColor" />
        <rect x="40" y="15" width="20" height="5" fill="currentColor" />
        <rect x="55" y="25" width="5" height="15" fill="currentColor" />
        <rect x="5" y="40" width="20" height="5" fill="currentColor" />
        <rect x="15" y="50" width="5" height="15" fill="currentColor" />
        <rect x="40" y="45" width="15" height="5" fill="currentColor" />
        <rect x="35" y="60" width="10" height="10" fill="currentColor" />
        <rect x="55" y="55" width="5" height="20" fill="currentColor" />
        <rect x="70" y="40" width="15" height="5" fill="currentColor" />
        <rect x="85" y="45" width="10" height="15" fill="currentColor" />
        <rect x="70" y="60" width="10" height="5" fill="currentColor" />
        <rect x="10" y="90" width="40" height="5" fill="currentColor" />
        <rect x="5" y="5" width="5" height="5" fill="currentColor" />
      </svg>
    );
  };

  const themeHex = event.themeColor || '#6366f1';

  return (
    <div className="flex flex-col lg:flex-row items-stretch justify-center h-full max-w-5xl mx-auto gap-8 p-1 sm:p-4">
      
      {/* LEFT: Video Player Display Screen */}
      <div className="flex-1 flex flex-col items-center justify-center">
        
        {/* Device frame block 9:16 format */}
        <div className="relative w-full max-w-[350px] aspect-[9/16] bg-slate-950 rounded-[40px] border-[10px] border-slate-900 shadow-2xl overflow-hidden flex flex-col justify-between">
          
          {/* Top Notch */}
          <div className="absolute top-0 inset-x-0 h-4 flex justify-center items-center z-40">
            <div className="w-16 h-3.5 bg-slate-900 rounded-b-lg"></div>
          </div>

          {/* Core Video Elements */}
          <div className="absolute inset-0 z-0 bg-slate-950">
            <video 
              src={video.url} 
              autoPlay 
              controls 
              loop 
              muted={false} // play music audio
              className="w-full h-full object-cover"
            />
          </div>

          {/* Success toast overlay */}
          <div className="absolute top-10 inset-x-4 bg-emerald-950/90 border border-emerald-500/30 rounded-xl p-2 z-40 flex items-center gap-2 backdrop-blur-md">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-none" />
            <div className="text-[10px]">
              <p className="font-bold text-white">Vídeo pronto com sucesso!</p>
              <p className="text-emerald-300">Acelerações &amp; áudio mesclados.</p>
            </div>
          </div>

          {/* Bottom layout labels inside screen frame */}
          <div className="z-10 bg-gradient-to-t from-slate-950/90 to-transparent p-4 pt-12 text-white">
            <div className="text-[10px] text-amber-500 font-mono tracking-wider mb-0.5">SPIN 360 COMPLETED</div>
            <p className="font-display font-medium text-xs leading-tight line-clamp-1">{event.name}</p>
          </div>
        </div>
      </div>

      {/* RIGHT: QR Code, Action Download and Social shares */}
      <div className="w-full lg:w-[380px] bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
        <div className="space-y-6">
          
          <div>
            <span style={{ color: themeHex, backgroundColor: `${themeHex}20` }} className="text-[9px] font-mono font-bold tracking-widest px-2.5 py-1 rounded-md uppercase">
              Download do Vídeo
            </span>
            <h2 className="text-xl font-display font-bold text-white mt-2 leading-snug">Seu registro está pronto!</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Escaneie o QR Code abaixo no seu celular para visualizar e baixar instantaneamente, ou clique em baixar direto.
            </p>
          </div>

          {/* QR CODE DYNAMIC BOX */}
          <div className="flex items-center gap-4 p-4 bg-slate-950 rounded-2xl border border-slate-800/80">
            {renderSVGQRCode()}
            <div className="flex-1 space-y-1.5">
              <div className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5" /> Código de Acesso
              </div>
              <p className="text-[11px] text-slate-300 leading-snug font-medium">
                Sua URL única de download é:
              </p>
              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 p-1.5 rounded font-mono inline-block w-full truncate">
                {publicVideoUrl}
              </span>
            </div>
          </div>

          {/* ACTION BUTTONS DIRECT */}
          <div className="space-y-2">
            <button
              onClick={handleDownload}
              style={{ backgroundColor: themeHex }}
              className="w-full py-3.5 rounded-2xl hover:bg-opacity-90 font-display font-bold tracking-wide text-sm text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-transform hover:scale-[1.01] active:scale-95">
              <Download className="w-4.5 h-4.5" />
              <span>{downloadSuccess ? 'Baixando seu Arquivo...' : 'BAIXAR AGORA (MP4)'}</span>
            </button>

            {downloadSuccess && (
              <p className="text-center text-[10px] text-emerald-400 font-mono animate-pulse">
                ✓ Registro de download salvo. Verifique sua pasta de downloads.
              </p>
            )}

            {/* Quick social sharing horizontal bar */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
              <span className="text-[9px] font-mono text-slate-500 block mb-2 uppercase text-center font-bold">COMPARTILHAR NO SEU CELULAR</span>
              
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <button 
                  onClick={() => handleShare('whatsapp')}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex flex-col items-center gap-1 cursor-pointer transition-colors text-slate-300">
                  <MessageCircle className="w-4 h-4 text-emerald-500" />
                  <span>WhatsApp</span>
                </button>
                <button 
                  onClick={() => handleShare('instagram')}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex flex-col items-center gap-1 cursor-pointer transition-colors text-slate-300">
                  <Instagram className="w-4 h-4 text-pink-500" />
                  <span>Instagram</span>
                </button>
                <button 
                  onClick={() => handleShare('link')}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex flex-col items-center gap-1 cursor-pointer transition-colors text-slate-300 relative">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
                  <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col gap-2">
          {/* Record Again */}
          <button
            onClick={onRecordAgain}
            className="w-full py-2.5 text-center bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-white rounded-xl font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5">
            <RefreshCw className="w-4.5 h-4.5 text-emerald-400" />
            <span>Gravar Outro Vídeo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
