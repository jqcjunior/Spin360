/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Volume2, RefreshCw, AlertCircle, Play, Pause, Square, Film, Sparkles } from 'lucide-react';
import { Event, Frame, Sponsor, MusicTrack, EffectPreset, VideoRecord, VideoLead, LogoPosition } from '../types';
import { SpinDb, DEMO_FRAMES_SVG } from '../db';

interface CameraRecorderProps {
  event: Event;
  lead: VideoLead | null;
  onRecordingComplete: (newVideo: VideoRecord) => void;
  onCancel: () => void;
}

export default function CameraRecorder({ event, lead, onRecordingComplete, onCancel }: CameraRecorderProps) {
  // Config assets
  const [frame, setFrame] = useState<Frame | null>(null);
  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [effect, setEffect] = useState<EffectPreset | null>(null);

  // States for stream/recorder
  const [useRealCamera, setUseRealCamera] = useState<boolean>(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [recordingState, setRecordingState] = useState<'idle' | 'countdown' | 'recording' | 'processing' | 'done'>('idle');
  
  // Timer and countdowns
  const [countdown, setCountdown] = useState<number>(3);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(1.0);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingStep, setProcessingStep] = useState<string>('');

  // Audio Pre-listen state
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);

  // Video feed fallback selector state
  const [selectedMockTheme, setSelectedMockTheme] = useState<string>('cyberpunk');

  // HTML Audio & Video elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const simulatedVideoRef = useRef<HTMLVideoElement | null>(null);

  // Video assets for immersive simulation
  const mockVideoFeeds: Record<string, string> = {
    cyberpunk: 'https://assets.mixkit.co/videos/preview/mixkit-girl-dancing-with-neon-lights-42289-large.mp4',
    festajunina: 'https://assets.mixkit.co/videos/preview/mixkit-countryside-cheerful-party-dancing-40919-large.mp4',
    wedding: 'https://assets.mixkit.co/videos/preview/mixkit-bride-and-groom-holding-hands-41617-large.mp4',
    corporate: 'https://assets.mixkit.co/videos/preview/mixkit-business-people-meeting-at-a-modern-office-42283-large.mp4'
  };

  // Resolve config on load
  useEffect(() => {
    // Resolve Frame
    const allFrames = SpinDb.getFrames();
    const currentFrame = allFrames.find(f => f.id === event.frameId);
    if (currentFrame) setFrame(currentFrame);

    // Resolve Music Track
    if (event.musicId) {
      const allTracks = SpinDb.getMusicTracks();
      const currentTrack = allTracks.find(t => t.id === event.musicId);
      if (currentTrack) setTrack(currentTrack);
    }

    // Resolve Sponsors
    const allSponsors = SpinDb.getSponsors();
    const linkedSponsors = allSponsors.filter(s => event.sponsorIds.includes(s.id) && s.isActive);
    setSponsors(linkedSponsors);

    // Resolve Speed Effect
    const allEffects = SpinDb.getEffectPresets();
    const currentEffect = allEffects.find(e => e.id === event.effectPresetId);
    if (currentEffect) setEffect(currentEffect);

    // Auto theme select
    if (event.category.toLowerCase().includes('junina') || event.category.toLowerCase().includes('sazonal')) {
      setSelectedMockTheme('festajunina');
    } else if (event.category.toLowerCase().includes('casamento') || event.category.toLowerCase().includes('wedding')) {
      setSelectedMockTheme('wedding');
    } else if (event.category.toLowerCase().includes('corporativo') || event.category.toLowerCase().includes('cop')) {
      setSelectedMockTheme('corporate');
    } else {
      setSelectedMockTheme('cyberpunk');
    }

    // Attempt Camera Init
    initRealCamera();

    return () => {
      stopCameraStream();
    };
  }, [event]);

  // Handle music track audio element
  useEffect(() => {
    if (track && track.audioUrl) {
      const audioObj = new Audio(track.audioUrl);
      audioObj.volume = track.volume;
      audioObj.loop = track.loop;
      audioRef.current = audioObj;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [track]);

  const initRealCamera = async () => {
    try {
      stopCameraStream(); // Clear current
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: 9/16,
          facingMode: "user"
        },
        audio: true
      });
      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCameraPermission(true);
      setUseRealCamera(true);
      SpinDb.logSystem('info', 'Câmera física inicializada com sucesso no navegador.', 'CAMERA_SERVICE');
    } catch (err: any) {
      console.warn("Real Camera failed or blocked by iframe permissions, defaulting to High-Fi Preview Simulation:", err);
      setHasCameraPermission(false);
      setUseRealCamera(false);
      SpinDb.logSystem('warn', 'Permissão de câmera negada (esperado em visualizações de iFrame). Ativando Motor de Simulação Pro.', 'CAMERA_SERVICE');
    }
  };

  const stopCameraStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  };

  // Toggle pre-escuta de áudio
  const toggleAudioPreListen = () => {
    if (!audioRef.current) return;
    if (isAudioPlaying) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
    } else {
      // Seek to configure start point
      if (track) {
        audioRef.current.currentTime = track.startPoint || 0;
      }
      audioRef.current.play().catch(e => console.warn("Audio policy blocked auto-play:", e));
      setIsAudioPlaying(true);
    }
  };

  // Iniciar fluxo countdown 3s
  const handleStartCapture = () => {
    if (isAudioPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
    }

    setRecordingState('countdown');
    setCountdown(3);
    
    // Play sound tick or simple interval
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          startRecordingFeed();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Iniciar gravação de fato
  const startRecordingFeed = () => {
    setRecordingState('recording');
    setRecordingSeconds(0);
    setCurrentSpeed(1.0);

    // Play Music track if attached
    if (audioRef.current && track) {
      audioRef.current.currentTime = track.startPoint || 0;
      audioRef.current.play().catch(e => console.warn("Audio autoplay blocked during capture:", e));
    }

    // Play simulation feed if using mock
    if (!useRealCamera && simulatedVideoRef.current) {
      simulatedVideoRef.current.currentTime = 0;
      simulatedVideoRef.current.play().catch(e => console.warn(e));
    }

    // Tracking seconds and dynamic velocity speed effects
    const maxDuration = event.videoDuration; // 5, 10, or 15s
    const tickInterval = 100; // 10 ticks per second for smooth updates
    let elapsedMs = 0;

    const timer = setInterval(() => {
      elapsedMs += tickInterval;
      const currentSeconds = elapsedMs / 1000;
      setRecordingSeconds(currentSeconds);

      // Determine speed based on effect presets
      if (effect && effect.steps.length > 0) {
        let stepSum = 0;
        let matchedSpeed = 1.0;
        for (const step of effect.steps) {
          stepSum += step.duration;
          if (currentSeconds <= stepSum) {
            matchedSpeed = step.speed;
            break;
          }
        }
        setCurrentSpeed(matchedSpeed);
      }

      if (currentSeconds >= maxDuration) {
        clearInterval(timer);
        stopRecordingFeedAndRender();
      }
    }, tickInterval);
  };

  // Finalizar captura e renderizar
  const stopRecordingFeedAndRender = () => {
    // Stop feeds
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (simulatedVideoRef.current) {
      simulatedVideoRef.current.pause();
    }

    setRecordingState('processing');
    setProcessingProgress(0);
    setProcessingStep('Inicializando motor FFmpeg no servidor...');

    // Simulate 5 steps with nice timing to represent RNF-01 (render speed proportional)
    const renderSteps = [
      { prg: 20, desc: 'Aplicando efeitos de velocidade: Re-frequenciando frames...' },
      { prg: 45, desc: `Sincronizando áudio: Mesclando faixa "${track?.title || 'Sem Áudio'}"...` },
      { prg: 68, desc: `Aplicando moldura de alta definição: "${frame?.name || 'Vazia'}"...` },
      { prg: 85, desc: 'Renderizando logos e créditos de patrocinadores no layout...' },
      { prg: 100, desc: 'Compactando mídia e concluindo gravação no Supabase Storage...' }
    ];

    let currentIdx = 0;
    const progressInterval = setInterval(() => {
      if (currentIdx < renderSteps.length) {
        setProcessingProgress(renderSteps[currentIdx].prg);
        setProcessingStep(renderSteps[currentIdx].desc);
        currentIdx++;
      } else {
        clearInterval(progressInterval);
        finishRendering();
      }
    }, 1200); // 1.2s per step for professional rendering feel
  };

  const finishRendering = () => {
    setRecordingState('done');

    // Generate random short slug
    const lexicon = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let slug = '';
    for (let i = 0; i < 5; i++) {
      slug += lexicon.charAt(Math.floor(Math.random() * lexicon.length));
    }

    // Set preview simulated video clip or real
    // Let's use the matching stock video for high-fidelity feel!
    const finalVideoUrl = mockVideoFeeds[selectedMockTheme] || mockVideoFeeds.cyberpunk;

    const newVideo: VideoRecord = {
      id: 'vid_' + Math.floor(Math.random() * 1000000),
      slug,
      eventId: event.id,
      leadId: lead?.id || undefined,
      url: finalVideoUrl,
      thumbnailUrl: event.coverUrl || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&auto=format&fit=crop&q=60',
      duration: event.videoDuration,
      status: 'completed',
      effectAppliedId: event.effectPresetId,
      frameAppliedId: event.frameId,
      musicAppliedId: event.musicId,
      viewsCount: 0,
      downloadsCount: 0,
      sharesCount: 0,
      createdAt: new Date().toISOString()
    };

    // Save mock database record
    SpinDb.saveVideo(newVideo);
    SpinDb.logSystem('info', `Vídeo ${newVideo.slug} renderizado pelo FFmpeg e gravado no Storage.`, 'RENDER_PIPELINE');
    SpinDb.logAudit(lead?.name || 'anonymous', 'record_video', 'video', newVideo.id, { slug: newVideo.slug });

    onRecordingComplete(newVideo);
  };

  // Helper colors based on theme color override
  const themeHex = event.themeColor || '#6366f1';

  // Sponsor Positioning classes
  const getSponsorClass = (pos: LogoPosition) => {
    switch (pos) {
      case 'top_left': return 'top-6 left-6';
      case 'top_right': return 'top-6 right-6';
      case 'bottom_left': return 'bottom-6 left-6';
      case 'bottom_right': return 'bottom-6 right-6';
      case 'center': return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
      default: return 'bottom-6 right-6';
    }
  };

  return (
    <div className="flex flex-col lg:flex-row items-stretch justify-center h-full max-w-6xl mx-auto gap-8 p-1 sm:p-4">
      
      {/* LEFT: Live Camera/Simulator Terminal Container */}
      <div className="flex-1 flex flex-col items-center justify-center">
        
        {/* Device frame Container styled like a modern smartphone/totem screen 9:16 layout */}
        <div className="relative w-full max-w-[390px] aspect-[9/16] bg-slate-950 rounded-[40px] border-[12px] border-slate-900 shadow-2xl overflow-hidden flex flex-col justify-between">
          
          {/* Top Speaker/Notch Graphic */}
          <div className="absolute top-0 inset-x-0 h-6 flex justify-center items-center z-40">
            <div className="w-24 h-4 bg-slate-900 rounded-b-xl flex items-center justify-around px-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
              <div className="w-8 h-1 bg-slate-800 rounded-full"></div>
            </div>
          </div>

          {/* BACKGROUND MEDIA CONTENT CHANGER */}
          <div className="absolute inset-0 z-0 bg-slate-900">
            {useRealCamera ? (
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover scale-x-[-1]" // mirror for nice selfie preview
              />
            ) : (
              <video 
                ref={simulatedVideoRef}
                src={mockVideoFeeds[selectedMockTheme]}
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Dark tint scrim during countdown or idle */}
            {recordingState === 'idle' && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
                <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center mb-4 border border-white/20">
                  <Camera className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-white font-display text-xl font-bold mb-1">Câmera Preparada</h3>
                <p className="text-slate-300 text-xs max-w-[240px]">
                  {useRealCamera ? 'Sua câmera física está ativa.' : 'Rodando em Modo de Simulação de Totem Digital'}
                </p>

                {/* Simulated Feed selector helper if not using real camera */}
                {!useRealCamera && (
                  <div className="mt-4 p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl w-full">
                    <label className="text-[10px] text-slate-400 block mb-1">Gênero do Evento (Simulador)</label>
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <button 
                        onClick={() => setSelectedMockTheme('cyberpunk')}
                        className={`p-1 rounded font-medium border ${selectedMockTheme === 'cyberpunk' ? 'bg-indigo-600/30 text-indigo-400 border-indigo-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                        Balada Cyber
                      </button>
                      <button 
                        onClick={() => setSelectedMockTheme('festajunina')}
                        className={`p-1 rounded font-medium border ${selectedMockTheme === 'festajunina' ? 'bg-amber-600/30 text-amber-400 border-amber-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                        Festa Junina
                      </button>
                      <button 
                        onClick={() => setSelectedMockTheme('wedding')}
                        className={`p-1 rounded font-medium border ${selectedMockTheme === 'wedding' ? 'bg-rose-600/30 text-rose-400 border-rose-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                        Casamento
                      </button>
                      <button 
                        onClick={() => setSelectedMockTheme('corporate')}
                        className={`p-1 rounded font-medium border ${selectedMockTheme === 'corporate' ? 'bg-blue-600/30 text-blue-400 border-blue-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                        Corporate Tech
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MOLDURA OVERLAY (High fidelity SVG overlay) */}
          {frame && (
            <div 
              className="absolute inset-0 z-20 pointer-events-none"
              dangerouslySetInnerHTML={{ __html: DEMO_FRAMES_SVG[frame.imageUrl] || '' }}
            />
          )}

          {/* SPONSORS OVERLAYS */}
          {sponsors.map((spons) => {
            const config = event.sponsorsConfig[spons.id] || { position: 'bottom_right', order: 1 };
            return (
              <div 
                key={spons.id}
                style={{ contentVisibility: 'auto' }}
                className={`absolute z-30 flex items-center gap-1.5 p-1.5 bg-slate-950/80 backdrop-blur-md rounded-lg shadow-md border border-slate-800 max-w-[130px] ${getSponsorClass(config.position)}`}>
                <img referrerPolicy="no-referrer" src={spons.logoUrl} alt={spons.name} className="w-6 h-6 object-cover rounded-full" />
                <span className="text-[9px] font-bold text-white tracking-wider truncate block">{spons.name}</span>
              </div>
            );
          })}

          {/* LIVE COUNTDOWN SCREENOVERLAY */}
          {recordingState === 'countdown' && (
            <div className="absolute inset-0 z-35 bg-black/60 backdrop-blur-xs flex items-center justify-center">
              <div className="text-center animate-bounce">
                <span className="text-7xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">
                  {countdown === 0 ? 'GRAVANDO!' : countdown}
                </span>
                <p className="text-xs text-slate-300 mt-2 tracking-widest font-mono">PREPARE SUA POSE 360!</p>
              </div>
            </div>
          )}

          {/* RECORDING LIVE STATUS CORNER */}
          {recordingState === 'recording' && (
            <div className="absolute top-10 left-4 z-40 flex items-center gap-2 bg-red-600 text-white rounded-full px-3 py-1 text-[10px] font-mono tracking-widest font-bold uppercase animate-pulse">
              <div className="w-2 h-2 rounded-full bg-white"></div>
              <span>REC {recordingSeconds.toFixed(1)}s / {event.videoDuration}s</span>
            </div>
          )}

          {/* ACTUAL SPEED EFFECT LIVE INDICATOR */}
          {recordingState === 'recording' && (
            <div className="absolute top-10 right-4 z-40 bg-indigo-900/90 text-indigo-200 border border-indigo-700 rounded-full px-3 py-1 text-[10px] font-mono font-bold uppercase">
              Vel: {currentSpeed.toFixed(1)}x
            </div>
          )}

          {/* PIPELINE RENDER LOADING OVERLAY */}
          {recordingState === 'processing' && (
            <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-center p-6 text-center text-white">
              <div className="max-w-[280px] mx-auto flex flex-col items-center">
                <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
                  <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                </div>
                
                <h4 className="text-lg font-display font-bold text-white mb-2">Processando Vídeo 360°</h4>
                
                {/* Simulated rendering console feedback */}
                <div className="w-full bg-slate-900 rounded-lg p-2.5 border border-slate-800 text-left font-mono text-[9px] mb-4 text-emerald-400 h-16 overflow-y-auto">
                  <div className="text-slate-500 text-[8px] mb-0.5">&gt; ffmpeg -i live_feed.webm -filter_complex ...</div>
                  <div>&gt; {processingStep}</div>
                </div>

                {/* Real-time bar */}
                <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-3.5 p-0.5 overflow-hidden mb-1">
                  <div 
                    style={{ width: `${processingProgress}%` }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-teal-400 rounded-full transition-all duration-300"
                  />
                </div>
                <div className="flex justify-between w-full text-[10px] text-slate-400">
                  <span>Pipeline render</span>
                  <span className="font-bold text-white">{processingProgress}%</span>
                </div>
              </div>
            </div>
          )}

          {/* SYSTEM HEADER AND FOOTER INTERIOR HUDS */}
          <div className="p-4 z-10 flex justify-between items-start pt-8 pointer-events-none">
            {recordingState === 'idle' && (
              <span className="text-[9px] font-mono text-slate-400 bg-slate-950/80 border border-slate-800 rounded-md px-2 py-1 flex items-center gap-1">
                <Film className="w-3 h-3 text-red-500" /> EVENTO ATIVO
              </span>
            )}
          </div>

          {/* BOTTOM INTERPRETED CONTROLS INSIDE TOTEM SCREEN */}
          <div className="p-4 z-10 flex flex-col gap-2 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pt-10">
            {recordingState === 'idle' && (
              <button
                onClick={handleStartCapture}
                style={{ backgroundColor: themeHex }}
                className="w-full py-3.5 text-center text-white font-display text-sm font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg scale-100 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer">
                <Camera className="w-5 h-5 fill-white/20" />
                <span>GRAVAR AGORA</span>
              </button>
            )}

            {recordingState === 'recording' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2 text-center text-[11px] text-amber-500 font-mono tracking-wide animate-pulse">
                SORRIA, GIRANDO O DISPOSITIVO 360°!
              </div>
            )}
            
            {/* Audio overlay helper */}
            {track && recordingState === 'idle' && (
              <div className="flex items-center justify-between text-white/90 bg-slate-900/90 border border-slate-800/80 rounded-xl px-3 py-2 text-[10px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Volume2 className="w-3.5 h-3.5 flex-none text-indigo-400" />
                  <div className="truncate">
                    <p className="font-bold truncate text-white">{track.title}</p>
                    <p className="text-slate-400 text-[9px] truncate">{track.artist}</p>
                  </div>
                </div>
                <button 
                  onClick={toggleAudioPreListen}
                  className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-400 px-2 py-1 rounded-md text-[9px] flex items-center gap-1 font-bold">
                  {isAudioPlaying ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                  {isAudioPlaying ? 'Pausar' : 'Escutar'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Totem Technical Information panel */}
      <div className="w-full lg:w-[350px] bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span 
              style={{ backgroundColor: `${themeHex}20`, color: themeHex }}
              className="text-xs font-bold font-mono uppercase px-2.5 py-1 rounded-lg">
              {event.category}
            </span>
          </div>

          <h2 className="text-2xl font-display font-bold text-white leading-tight mb-2">
            {event.name}
          </h2>
          
          <p className="text-slate-400 text-xs mb-6">
            {event.description || 'Nenhuma descrição fornecida para este evento.'}
          </p>

          <div className="space-y-4 border-t border-slate-800/80 pt-4 text-xs">
            
            {/* Stats list */}
            <div className="flex justify-between pb-2 border-b border-slate-800/40">
              <span className="text-slate-500">Duração Gravada:</span>
              <span className="font-mono text-white font-bold">{event.videoDuration} segundos</span>
            </div>

            <div className="flex justify-between pb-2 border-b border-slate-800/40">
              <span className="text-slate-500">Preset de Efeitos:</span>
              <span className="text-indigo-400 font-bold font-display">{effect?.name.split(':')[0] || 'Nenhum'}</span>
            </div>

            {frame && (
              <div className="flex justify-between pb-2 border-b border-slate-800/40">
                <span className="text-slate-500">Moldura overlay:</span>
                <span className="text-slate-300 truncate font-mono">{frame.name} (9:16)</span>
              </div>
            )}

            {track && (
              <div className="flex justify-between pb-2 border-b border-slate-800/40">
                <span className="text-slate-500">Trilha Musical:</span>
                <span className="text-slate-300 truncate font-mono">{track.title}</span>
              </div>
            )}

            <div className="flex justify-between pb-2">
              <span className="text-slate-500">Modo de Captura:</span>
              <span className="text-white font-mono">{event.enableLeadCapture ? 'Lead Ocorrido (LGPD)' : 'Livre (Sem cadastro)'}</span>
            </div>
          </div>

          {/* Quick instructions for operation */}
          <div className="mt-6 bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed font-mono">
            <span className="text-amber-500 font-bold block mb-1">💡 DICA OPERADOR:</span>
            O hardware Spin 360 deve girar continuamente a velocidade estável. O software detectará a gravação e aplicará as acelerações no pipeline imediatamente após a conclusão.
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col gap-2">
          {/* Camera Permission check helper status */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 px-1">
            <div className={`w-2 h-2 rounded-full ${useRealCamera ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
            <span>
              {useRealCamera ? 'Câmera física USB conectada' : 'Simulador Pro (Sem permissão)'}
            </span>
            {!useRealCamera && (
              <button 
                onClick={initRealCamera}
                className="ml-auto text-indigo-400 hover:underline font-bold text-[9px] flex items-center gap-0.5">
                <RefreshCw className="w-2.5 h-2.5" /> Re-checar
              </button>
            )}
          </div>

          <button
            onClick={onCancel}
            className="w-full py-2.5 text-center text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl font-medium text-xs transition-colors cursor-pointer">
            Voltar para Seleção
          </button>
        </div>
      </div>
    </div>
  );
}
