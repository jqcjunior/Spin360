/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Legend, Cell, PieChart, Pie
} from 'recharts';
import { 
  LayoutDashboard, Calendar, Image, Music, Users, ShieldAlert, Settings, FileSpreadsheet,
  Plus, Edit, Trash2, ShieldCheck, Check, Info, ToggleLeft, ToggleRight,
  Database, RefreshCw, Eye, Download, Share2, HelpCircle, AlertCircle, Sparkles
} from 'lucide-react';
import { 
  Event, Frame, Sponsor, MusicTrack, EffectPreset, EventStatus, 
  VideoLead, SystemSetting, AuditLog, LogoPosition
} from '../types';
import { SpinDb, SEED_EFFECTS, DEMO_FRAMES_SVG } from '../db';
import { uploadFile } from '../lib/storage';

interface AdminDashboardProps {
  onSelectEventForCapture: (event: Event) => void;
}

export default function AdminDashboard({ onSelectEventForCapture }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'events' | 'frames' | 'tracks' | 'sponsors' | 'leads' | 'audits' | 'settings'>('stats');

  // Trigger Database reloads
  const [dbTick, setDbTick] = useState(0);
  const [supabaseFrames, setSupabaseFrames] = useState<Frame[]>([]);
  const [supabaseTracks, setSupabaseTracks] = useState<MusicTrack[]>([]);

  useEffect(() => {
    const loadCatalog = async () => {
      const { data: framesData } = await supabase.from('frames').select('id, name, image_url, tags, is_active').eq('is_active', true);
      const { data: tracksData } = await supabase.from('music_tracks').select('id, name, file_url, volume, fade_in_seconds, fade_out_seconds, is_loop, start_point_seconds').eq('is_active', true);

      if (framesData) {
        const mapped = framesData.map((f: any) => ({
          id: f.id, name: f.name, imageUrl: f.image_url,
          category: 'Geral', tags: f.tags || [], isActive: true,
          createdAt: new Date().toISOString(),
        }));
        setSupabaseFrames(mapped);
        mapped.forEach(f => SpinDb.saveFrame(f));
      }

      if (tracksData) {
        const mapped = tracksData.map((t: any) => ({
          id: t.id, title: t.name, artist: '', audioUrl: t.file_url,
          volume: t.volume || 0.8, fadeIn: t.fade_in_seconds || 1,
          fadeOut: t.fade_out_seconds || 1, loop: t.is_loop || true,
          startPoint: t.start_point_seconds || 0, endPoint: 30,
          createdAt: new Date().toISOString(),
        }));
        setSupabaseTracks(mapped);
        mapped.forEach(t => SpinDb.saveMusicTrack(t));
      }
    };
    loadCatalog();
  }, []);
  const [isPending, startTransition] = useTransition();
  const triggerReload = () => startTransition(() => setDbTick(prev => prev + 1));

  // Resolved dynamic data from LocalStorage
  const events = useMemo(() => SpinDb.getEvents(), [dbTick]);
  const frames = useMemo(() => SpinDb.getFrames(), [dbTick]);
  const tracks = useMemo(() => SpinDb.getMusicTracks(), [dbTick]);
  const sponsors = useMemo(() => SpinDb.getSponsors(), [dbTick]);
  const leads = useMemo(() => SpinDb.getLeads(), [dbTick]);
  const videos = useMemo(() => SpinDb.getVideos(), [dbTick]);
  const audits = useMemo(() => SpinDb.getAuditLogs(), [dbTick]);
  const settings = useMemo(() => SpinDb.getSettings(), [dbTick]);

  // Modals / Form states
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // States for dynamic Frame, Track, Sponsor Creators
  const [isFrameModalOpen, setIsFrameModalOpen] = useState(false);
  const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);

  // Quick state overrides
  const [quickEventStatus, setQuickEventStatus] = useState<Record<string, EventStatus>>({});

  // Form states for Event CRUD
  const [evtName, setEvtName] = useState('');
  const [evtDesc, setEvtDesc] = useState('');
  const [evtDate, setEvtDate] = useState('');
  const [evtTime, setEvtTime] = useState('');
  const [evtCover, setEvtCover] = useState('');
  const [evtStatus, setEvtStatus] = useState<EventStatus>('draft');
  const [evtCategory, setEvtCategory] = useState('Sazonal');
  const [evtFrameId, setEvtFrameId] = useState('');
  const [evtMusicId, setEvtMusicId] = useState('');
  const [evtSponsorIds, setEvtSponsorIds] = useState<string[]>([]);
  const [evtSponsorConfigs, setEvtSponsorConfigs] = useState<Record<string, { position: LogoPosition; order: number }>>({});
  const [evtDuration, setEvtDuration] = useState<5 | 10 | 15>(10);
  const [evtEffectId, setEvtEffectId] = useState('eff_01');
  const [evtColor, setEvtColor] = useState('#6366f1');
  const [evtTotem, setEvtTotem] = useState(true);
  const [evtLeads, setEvtLeads] = useState(true);
  const [evtLeadFields, setEvtLeadFields] = useState({
    name: true, phone: true, city: false, email: true, instagram: false, company: false
  });
  const [evtLgpdText, setEvtLgpdText] = useState('Declaro consentimento para captação dos meus dados para gravação.');

  // Form states for Frame Creator
  const [frmName, setFrmName] = useState('');
  const [frmCategory, setFrmCategory] = useState('Geral');
  const [frmTags, setFrmTags] = useState('');
  const [frmImage, setFrmImage] = useState('cyberpunk'); // Preset pointer inside SpinDb.DEMO_FRAMES_SVG

  // Form states for Sponsor Creator
  const [sponsName, setSponsName] = useState('');
  const [sponsLogo, setSponsLogo] = useState('');
  const [sponsSite, setSponsSite] = useState('');
  const [sponsColor, setSponsColor] = useState('#4f46e5');

  // Form states for Track Creator
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [trackVol, setTrackVol] = useState(0.8);
  const [trackStart, setTrackStart] = useState(0);
  const [trackEnd, setTrackEnd] = useState(15);
  const [frmFile, setFrmFile] = useState<File | null>(null);
  const [frmUploading, setFrmUploading] = useState(false);
  const [trkFile, setTrkFile] = useState<File | null>(null);
  const [trkUploading, setTrkUploading] = useState(false);
  const [sponsFile, setSponsFile] = useState<File | null>(null);
  const [sponsUploading, setSponsUploading] = useState(false);

  // System statistics compilation
  const totalVideos = videos.length;
  const totalDownloads = useMemo(() => videos.reduce((acc, v) => acc + (v.downloadsCount || 0), 0), [videos]);
  const totalShares = useMemo(() => videos.reduce((acc, v) => acc + (v.sharesCount || 0), 0), [videos]);
  const totalViews = useMemo(() => videos.reduce((acc, v) => acc + (v.viewsCount || 0), 0), [videos]);

  // Chart data 1: Videos by date of registry
  const chartRegistryByDate = useMemo(() => {
    const registry: Record<string, number> = {};
    videos.forEach((v) => {
      const dateKey = v.createdAt.substring(0, 10);
      registry[dateKey] = (registry[dateKey] || 0) + 1;
    });
    // Convert to sorted chart array
    return Object.keys(registry).slice(-7).map(date => ({
      date: date.substring(5, 10), // mm-dd
      vídeos: registry[date]
    })).sort((a,b) => a.date.localeCompare(b.date));
  }, [videos]);

  // Chart data 2: Event rankings by shares
  const eventRankingsData = useMemo(() => {
    return events.map((e) => {
      const associatedVideos = videos.filter(v => v.eventId === e.id);
      const eShares = associatedVideos.reduce((acc, v) => acc + v.sharesCount, 0);
      const eDls = associatedVideos.reduce((acc, v) => acc + v.downloadsCount, 0);
      return {
        name: e.name.substring(0, 18) + (e.name.length > 18 ? '...' : ''),
        downloads: eDls,
        shares: eShares
      };
    }).sort((a, b) => b.shares - a.shares).slice(0, 5);
  }, [events, videos]);

  // Chart data 3: Share shares channel division
  const shareChannelData = useMemo(() => {
    return [
      { name: 'WhatsApp', value: 41, color: '#22c55e' },
      { name: 'QR Code', value: 25, color: '#a855f7' },
      { name: 'Instagram', value: 18, color: '#ec4899' },
      { name: 'Link Direto', value: 16, color: '#3b82f6' }
    ];
  }, []);

  // Preset theme colors helper
  const presetThemes = ['#6366f1', '#ca8a04', '#ef4444', '#d946ef', '#10b981', '#06b6d4'];

  // Handle Event create/edit submission
  const handleEventSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!evtFrameId) {
      alert("Aviso: Um evento ativo necessita de uma Moldura vinculada.");
      return;
    }

    const eventData: Event = {
      id: editingEvent ? editingEvent.id : 'evt_' + Math.floor(Math.random() * 1000000),
      name: evtName,
      description: evtDesc,
      date: evtDate,
      time: evtTime,
      coverUrl: evtCover || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&auto=format&fit=crop&q=60',
      status: evtStatus,
      category: evtCategory,
      frameId: evtFrameId,
      musicId: evtMusicId || undefined,
      sponsorIds: evtSponsorIds,
      sponsorsConfig: evtSponsorConfigs,
      videoDuration: evtDuration,
      effectPresetId: evtEffectId,
      themeColor: evtColor,
      enableTotemMode: evtTotem,
      enableLeadCapture: evtLeads,
      requiredLeadFields: evtLeadFields,
      lgpdConsentText: evtLgpdText,
      createdAt: editingEvent ? editingEvent.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    SpinDb.saveEvent(eventData);

    // Salva no Supabase com frame_id e music_id válidos (UUID do Supabase)
    try {
      const frameUuid = eventData.frameId?.length === 36 ? eventData.frameId : null;
      const musicUuid = eventData.musicId?.length === 36 ? eventData.musicId : null;
      
      await supabase.from('events').upsert({
        id: eventData.id?.length === 36 ? eventData.id : undefined,
        name: eventData.name,
        description: eventData.description || null,
        status: eventData.status,
        category: eventData.category || 'Geral',
        frame_id: frameUuid,
        music_id: musicUuid,
        video_duration_seconds: eventData.videoDuration,
        theme_color: eventData.themeColor || '#6366f1',
        totem_mode_enabled: eventData.enableTotemMode || false,
        lead_capture_config: { enabled: eventData.enableLeadCapture, fields: eventData.requiredLeadFields },
        created_at: eventData.createdAt,
        updated_at: new Date().toISOString(),
      } as any);
      console.log('[Admin] Evento salvo no Supabase:', eventData.name);
    } catch (err) {
      console.error('[Admin] Erro Supabase:', err);
    }
    setIsEventModalOpen(false);
    setEditingEvent(null);
    triggerReload();
  };

  const openEventCreate = () => {
    setEditingEvent(null);
    setEvtName('');
    setEvtDesc('');
    setEvtDate(new Date().toISOString().substring(0, 10));
    setEvtTime('19:00');
    setEvtCover('');
    setEvtStatus('draft');
    setEvtCategory('Corporativo');
    setEvtFrameId(frames[0]?.id || '');
    setEvtMusicId(tracks[0]?.id || '');
    setEvtSponsorIds([]);
    setEvtSponsorConfigs({});
    setEvtDuration(10);
    setEvtEffectId('eff_01');
    setEvtColor('#6366f1');
    setEvtTotem(true);
    setEvtLeads(false);
    setEvtLeadFields({
      name: true, phone: true, city: false, email: true, instagram: false, company: false
    });
    setEvtLgpdText('Declaro que dou consentimento para captação dos meus dados para gravação, em conformidade com as diretrizes da LGPD.');
    setIsEventModalOpen(true);
  };

  const openEventEdit = (event: Event) => {
    setEditingEvent(event);
    setEvtName(event.name);
    setEvtDesc(event.description);
    setEvtDate(event.date);
    setEvtTime(event.time);
    setEvtCover(event.coverUrl || '');
    setEvtStatus(event.status);
    setEvtCategory(event.category);
    setEvtFrameId(event.frameId);
    setEvtMusicId(event.musicId || '');
    setEvtSponsorIds(event.sponsorIds);
    setEvtSponsorConfigs(event.sponsorsConfig || {});
    setEvtDuration(event.videoDuration);
    setEvtEffectId(event.effectPresetId);
    setEvtColor(event.themeColor || '#6366f1');
    setEvtTotem(event.enableTotemMode);
    setEvtLeads(event.enableLeadCapture);
    setEvtLeadFields(event.requiredLeadFields);
    setEvtLgpdText(event.lgpdConsentText);
    setIsEventModalOpen(true);
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirm("Deseja realmente excluir este evento? Todos os logs do evento serão mantidos para auditoria.")) {
      SpinDb.deleteEvent(id);
      try {
        const { supabase } = await import('../lib/supabase');
        await supabase.from('events').delete().eq('id', id);
      } catch (err) {
        console.error('[AdminDashboard] Erro ao deletar evento no Supabase:', err);
      }
      triggerReload();
    }
  };

  // Switch event status helper
  const toggleStatus = (event: Event) => {
    const statuses: EventStatus[] = ['draft', 'active', 'paused', 'completed', 'archived'];
    const currentIdx = statuses.indexOf(event.status);
    const nextIdx = (currentIdx + 1) % statuses.length;
    const nextStatus = statuses[nextIdx];

    // Business rule validation: Active event needs Frame ID
    if (nextStatus === 'active' && !event.frameId) {
      alert("Erro de Regra de Negócio: Um evento não pode ter status 'ativo' sem uma moldura vinculada!");
      return;
    }

    const updated = { ...event, status: nextStatus };
    SpinDb.saveEvent(updated);
    triggerReload();
  };

  // Sponsor selection toggles
  const handleSponsorCheck = (sponsId: string) => {
    let nextSponsors = [...evtSponsorIds];
    if (nextSponsors.includes(sponsId)) {
      nextSponsors = nextSponsors.filter(id => id !== sponsId);
    } else {
      nextSponsors.push(sponsId);
    }
    setEvtSponsorIds(nextSponsors);

    // Provide default position configuration
    if (!evtSponsorConfigs[sponsId]) {
      setEvtSponsorConfigs(prev => ({
        ...prev,
        [sponsId]: { position: 'bottom_right', order: nextSponsors.length }
      }));
    }
  };

  // Position change helper
  const handleSponsorPosChange = (sponsId: string, pos: LogoPosition) => {
    setEvtSponsorConfigs(prev => ({
      ...prev,
      [sponsId]: { ...prev[sponsId], position: pos }
    }));
  };

  // Frame Creator save
  const handleFrameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFrmUploading(true);
    try {
      let imageUrl = frmImage;
      if (frmFile) {
        imageUrl = await uploadFile('frames', frmFile);
      }
      const newFrame: Frame = {
        id: 'frame_' + Math.floor(Math.random() * 1000000),
        name: frmName,
        imageUrl,
        category: frmCategory,
        tags: frmTags.split(',').map(t => t.trim()).filter(Boolean),
        isActive: true,
        createdAt: new Date().toISOString()
      };
      SpinDb.saveFrame(newFrame);
      setIsFrameModalOpen(false);
      setFrmName('');
      setFrmFile(null);
      triggerReload();
    } catch (err: any) {
      alert('Erro no upload da moldura: ' + err.message);
    } finally {
      setFrmUploading(false);
    }
  };

  // Sponsor Creator save
  const handleSponsorSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSponsUploading(true);
    try {
      let logoUrl = sponsLogo || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60';
      if (sponsFile) {
        logoUrl = await uploadFile('sponsors', sponsFile);
      }
      const newSpons: Sponsor = {
        id: 'spons_' + Math.floor(Math.random() * 1000000),
        name: sponsName,
        logoUrl,
        siteUrl: sponsSite || undefined,
        primaryColor: sponsColor,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      SpinDb.saveSponsor(newSpons);
      setIsSponsorModalOpen(false);
      setSponsName('');
      setSponsLogo('');
      setSponsFile(null);
      triggerReload();
    } catch (err: any) {
      alert('Erro no upload do logo: ' + err.message);
    } finally {
      setSponsUploading(false);
    }
  };

  // Track Creator save
  const handleTrackSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrkUploading(true);
    try {
      let audioUrl = trackUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3';
      if (trkFile) {
        audioUrl = await uploadFile('music', trkFile);
      }
      const newTrack: MusicTrack = {
        id: 'track_' + Math.floor(Math.random() * 1000000),
        title: trackTitle,
        artist: trackArtist,
        audioUrl,
        volume: trackVol,
        fadeIn: 1,
        fadeOut: 1,
        loop: true,
        startPoint: Number(trackStart),
        endPoint: Number(trackEnd),
        createdAt: new Date().toISOString()
      };
      SpinDb.saveMusicTrack(newTrack);
      setIsTrackModalOpen(false);
      setTrackTitle('');
      setTrackArtist('');
      setTrkFile(null);
      triggerReload();
    } catch (err: any) {
      alert('Erro no upload da trilha: ' + err.message);
    } finally {
      setTrkUploading(false);
    }
  };

  const handleSystemReset = () => {
    if (confirm("ATENÇÃO: Deseja redefinir todo o banco de dados local para os dados iniciais? Você perderá modificações feitas.")) {
      SpinDb.resetDatabase();
      triggerReload();
    }
  };

  // CSV Exporter for capturing lead data
  const handleExportLeadsCSV = () => {
    if (leads.length === 0) {
      alert("Nenhum lead capturado para exportar.");
      return;
    }
    const headers = ['ID', 'ID do Evento', 'Nome', 'WhatsApp', 'Cidade', 'E-mail', 'Instagram', 'Empresa', 'Consentimento LGPD', 'Data/Hora de Consentimento'];
    const rows = leads.map(l => [
      l.id, l.eventId, l.name || '', l.phone || '', l.city || '', l.email || '', l.instagram || '', l.company || '', l.lgpdConsent ? 'Sim' : 'Não', l.consentTimestamp
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Spin360_Leads_Export_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 items-stretch h-full">
      
      {/* SBAR NAVIGATION RAIL */}
      <div className="w-full md:w-60 bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col gap-1.5 flex-none justify-between">
        <ul className="space-y-1">
          <li className="px-3 py-2 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Painel Operador</li>
          
          <li>
            <button 
              onClick={() => setActiveTab('stats')}
              className={`w-full px-3 py-2 text-xs font-medium rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${activeTab === 'stats' ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <LayoutDashboard className="w-4 h-4 flex-none" />
              <span>Visão Geral</span>
            </button>
          </li>

          <li>
            <button 
              onClick={() => setActiveTab('events')}
              className={`w-full px-3 py-2 text-xs font-medium rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${activeTab === 'events' ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <Calendar className="w-4 h-4 flex-none" />
              <span>Gerenciar Eventos</span>
            </button>
          </li>

          <li className="px-3 py-2 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mt-3">Catálogo Técnico</li>

          <li>
            <button 
              onClick={() => setActiveTab('frames')}
              className={`w-full px-3 py-2 text-xs font-medium rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${activeTab === 'frames' ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <Image className="w-4 h-4 flex-none" />
              <span>Molduras PNG / SVG</span>
            </button>
          </li>

          <li>
            <button 
              onClick={() => setActiveTab('tracks')}
              className={`w-full px-3 py-2 text-xs font-medium rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${activeTab === 'tracks' ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <Music className="w-4 h-4 flex-none" />
              <span>Trilhas Musicais</span>
            </button>
          </li>

          <li>
            <button 
              onClick={() => setActiveTab('sponsors')}
              className={`w-full px-3 py-2 text-xs font-medium rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${activeTab === 'sponsors' ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <Sparkles className="w-4 h-4 flex-none" />
              <span>Patrocinadores</span>
            </button>
          </li>

          <li className="px-3 py-2 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mt-3">Leads &amp; Rastreamento</li>

          <li>
            <button 
              onClick={() => setActiveTab('leads')}
              className={`w-full px-3 py-2 text-xs font-medium rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${activeTab === 'leads' ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <Users className="w-4 h-4 flex-none" />
              <span>Leads Capturados</span>
            </button>
          </li>

          <li>
            <button 
              onClick={() => setActiveTab('audits')}
              className={`w-full px-3 py-2 text-xs font-medium rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${activeTab === 'audits' ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <ShieldAlert className="w-4 h-4 flex-none" />
              <span>Auditoria e Logs</span>
            </button>
          </li>

          <li>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full px-3 py-2 text-xs font-medium rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${activeTab === 'settings' ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <Settings className="w-4 h-4 flex-none" />
              <span>Preferências</span>
            </button>
          </li>
        </ul>

        {/* System telemetry label block */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-[10px] text-slate-500 font-mono space-y-1">
          <div className="flex justify-between">
            <span>BCO DE DADOS:</span>
            <span className="text-emerald-400 font-bold">SQL RLS</span>
          </div>
          <div className="flex justify-between">
            <span>ARMAZ.:</span>
            <span className="text-indigo-400 font-bold">19.4 MB</span>
          </div>
          <div className="flex justify-between text-[9px] border-t border-slate-800 pt-1 mt-1 text-slate-600">
            <span>ID APPLET:</span>
            <span className="font-sans">c5xxnlsd</span>
          </div>
        </div>
      </div>

      {/* CORE ACTIVE WORKSPACE */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 min-h-[500px]">
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-2xl font-display font-bold text-white">Consola de BI &amp; Relatórios</h2>
                <p className="text-xs text-slate-400">Dados consolidados do projeto ArtTech para cobranças e patrocinadores.</p>
              </div>
              <button 
                onClick={triggerReload}
                className="bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Atualizar BI
              </button>
            </div>

            {/* Quick Metrics grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-mono font-bold text-slate-550 uppercase">Vídeos Gravados</span>
                <p className="text-3xl font-display font-extrabold text-white mt-1">{totalVideos}</p>
                <div className="text-[9px] text-slate-500 font-mono mt-1">Concluídos com sucesso</div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-mono font-bold text-slate-550 uppercase">Total de Downloads</span>
                <p className="text-3xl font-display font-extrabold text-indigo-400 mt-1">{totalDownloads}</p>
                <div className="text-[9px] text-emerald-400 font-mono mt-1">▲ 14% nesta semana</div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-mono font-bold text-slate-550 uppercase">Total de Compart.</span>
                <p className="text-3xl font-display font-extrabold text-teal-400 mt-1">{totalShares}</p>
                <div className="text-[9px] text-slate-500 font-mono mt-1">WhastApp, Instagram, QR</div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
                <span className="text-[10px] font-mono font-bold text-slate-550 uppercase">Acessos a Páginas</span>
                <p className="text-3xl font-display font-extrabold text-amber-500 mt-1">{totalViews}</p>
                <div className="text-[9px] text-slate-500 font-mono mt-1">Views únicas de vídeo</div>
              </div>
            </div>

            {/* Analytics Graphics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Daily recordings */}
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl h-[280px] flex flex-col">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest block mb-4">Volume Diário de Gravações</span>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartRegistryByDate}>
                      <defs>
                        <linearGradient id="colorVideo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                      <Area type="monotone" dataKey="vídeos" stroke="#6366f1" fillOpacity={1} fill="url(#colorVideo)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Event Rank */}
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl h-[280px] flex flex-col">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest block mb-4">Top Eventos por Atividades (Downloads/Shares)</span>
                <div className="flex-1 min-h-0">
                  {eventRankingsData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500">Sem dados operacionais neste período</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={eventRankingsData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="downloads" fill="#3b82f6" name="Downloads" />
                        <Bar dataKey="shares" fill="#10b981" name="Compartilhamentos" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

            </div>

            {/* Shares Channels breakdown and sponsors table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl lg:col-span-1 flex flex-col">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">Canais de Log</span>
                <span className="text-[10px] text-slate-500 mb-4 block">Compartilhamento de leads</span>
                
                <div className="flex-1 flex items-center justify-center min-h-[160px] relative">
                  <div className="space-y-2 w-full text-xs">
                    {shareChannelData.map((c, i) => (
                      <div key={i} className="flex justify-between items-center bg-slate-900 border border-slate-800 p-2 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                          <span className="font-mono text-white">{c.name}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-400">{c.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl lg:col-span-2 flex flex-col overflow-x-auto">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest block mb-4">Engajamento de Patrocinadores</span>
                <table className="w-full text-left text-xs text-white">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px] font-mono tracking-widest uppercase">
                      <th className="pb-2">Patrocinador</th>
                      <th className="pb-2">Cliques no Site</th>
                      <th className="pb-2">Vídeos Gerados</th>
                      <th className="pb-2">Presença Layout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    <tr>
                      <td className="py-2.5 font-bold flex items-center gap-2">
                        <img referrerPolicy="no-referrer" src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=40&auto=format&fit=crop&q=60" className="w-5 h-5 rounded-full" />
                        Nike Air Max
                      </td>
                      <td className="py-2.5 font-mono text-emerald-400">1,504</td>
                      <td className="py-2.5 font-mono">112</td>
                      <td className="py-2.5"><span className="bg-blue-500/10 text-blue-400 text-[9px] px-2 py-0.5 rounded font-mono uppercase font-bold">Bottom Left</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold flex items-center gap-2">
                        <img referrerPolicy="no-referrer" src="https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=40&auto=format&fit=crop&q=60" className="w-5 h-5 rounded-full" />
                        Coca-Cola Zero
                      </td>
                      <td className="py-2.5 font-mono text-emerald-400">890</td>
                      <td className="py-2.5 font-mono">85</td>
                      <td className="py-2.5"><span className="bg-blue-500/10 text-blue-400 text-[9px] px-2 py-0.5 rounded font-mono uppercase font-bold">Top Right</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold flex items-center gap-2">
                        <img referrerPolicy="no-referrer" src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=40&auto=format&fit=crop&q=60" className="w-5 h-5 rounded-full" />
                        ArtTech Studio
                      </td>
                      <td className="py-2.5 font-mono text-emerald-400">433</td>
                      <td className="py-2.5 font-mono">41</td>
                      <td className="py-2.5"><span className="bg-blue-500/10 text-blue-400 text-[9px] px-2 py-0.5 rounded font-mono uppercase font-bold">Bottom Right</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-indigo-400" /> Eventos &amp; Ativações
                </h2>
                <p className="text-xs text-slate-400">Publique novos templates de totem, acione captura de leads e configure overlays.</p>
              </div>
              <button 
                onClick={openEventCreate}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 shadow-lg shadow-indigo-950/25">
                <Plus className="w-4 h-4" /> NOVO EVENTO
              </button>
            </div>

            {/* Event List table cards layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((e) => {
                const associatedVideos = videos.filter(v => v.eventId === e.id);
                return (
                  <div 
                    key={e.id}
                    style={{ borderLeftColor: e.themeColor || '#6366f1' }}
                    className="bg-slate-950 border-y border-r border-slate-800 rounded-2xl overflow-hidden shadow-md flex flex-col justify-between border-l-[6px]">
                    
                    <div className="p-4 flex gap-4">
                      {e.coverUrl && (
                        <img referrerPolicy="no-referrer" src={e.coverUrl} alt={e.name} className="w-16 h-16 object-cover rounded-xl flex-none border border-slate-800" />
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex justify-between items-start gap-1">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">{e.category}</span>
                          <span className={`text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full uppercase ${
                            e.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            e.status === 'paused' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {e.status}
                          </span>
                        </div>
                        <h3 className="text-white text-sm font-bold truncate leading-snug">{e.name}</h3>
                        <p className="text-slate-400 text-[11px] line-clamp-1">{e.description}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900/50 border-t border-slate-850 flex flex-wrap gap-2 justify-between items-center">
                      <div className="text-[10px] font-mono text-slate-500 space-x-2">
                        <span>📹 {associatedVideos.length} vídeos</span>
                        <span>⏱ {e.videoDuration}s</span>
                        <span>{e.enableLeadCapture ? '🔒 Leads' : '🔓 Livre'}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => toggleStatus(e)}
                          title="Alterar Status"
                          className="p-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono cursor-pointer">
                          Alterar status
                        </button>
                        <button 
                          onClick={() => openEventEdit(e)}
                          className="p-1 bg-slate-850 hover:bg-slate-700 text-teal-400 rounded cursor-pointer"
                          title="Editar Evento">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteEvent(e.id)}
                          className="p-1 bg-slate-850 hover:bg-red-950 text-red-400 rounded cursor-pointer"
                          title="Excluir Evento">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        
                        {e.status === 'active' && (
                          <button 
                            onClick={() => onSelectEventForCapture(e)}
                            className="p-1 px-2 text-[10px] font-bold font-mono text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 shadow cursor-pointer ml-1">
                            Lançar
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MOLDURAS PANEL */}
        {activeTab === 'frames' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                  <Image className="w-6 h-6 text-indigo-400" /> Biblioteca de Molduras PNG/SVG
                </h2>
                <p className="text-xs text-slate-400">Carregue novos overlays de enquadramento 9:16 (formato stories de gravação).</p>
              </div>
              <button 
                onClick={() => setIsFrameModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 shadow-lg">
                <Plus className="w-4 h-4" /> ADICIONAR MOLDURA
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {frames.map((f) => (
                <div key={f.id} className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between">
                  <div className="relative aspect-[9/16] bg-slate-900 border-b border-slate-800 flex items-center justify-center p-3 overflow-hidden">
                    {/* Simulated visual mockup of frame inside card */}
                    <div className="absolute inset-0 z-0 bg-gradient-to-tr from-slate-950 via-indigo-950/20 to-slate-950/40"></div>
                    
                    {/* Render exact micro version of frames overlay SVGs inside cards */}
                    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center overflow-hidden rounded-2xl">
                      {f.imageUrl && f.imageUrl.startsWith('http') ? (
                        <img
                          src={f.imageUrl}
                          alt={f.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div
                          className="absolute inset-0 p-1"
                          dangerouslySetInnerHTML={{ __html: DEMO_FRAMES_SVG[f.imageUrl] || '' }}
                        />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-600 font-mono z-20">Preview Overlay 9:16</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[9px] font-mono text-slate-500 uppercase">{f.category}</span>
                    <h4 className="text-white text-xs font-bold truncate mt-0.5">{f.name}</h4>
                    <div className="flex gap-1 mt-2.5 justify-between">
                      <span className="text-[9px] bg-slate-800 text-slate-400 font-mono p-1 rounded">SVG de Alta</span>
                      <button 
                        onClick={() => {
                          if(confirm("Deseja deletar esta moldura?")) {
                            SpinDb.deleteFrame(f.id);
                            triggerReload();
                          }
                        }}
                        className="text-red-400 hover:text-red-300 text-[10px] font-mono">
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MUSIC TRACKS PANEL */}
        {activeTab === 'tracks' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                  <Music className="w-6 h-6 text-indigo-400" /> Biblioteca de Trilhas Musicais
                </h2>
                <p className="text-xs text-slate-400">Configure arquivos de áudio que são mesclados ao vídeo bruto com loops e fade-ins.</p>
              </div>
              <button 
                onClick={() => setIsTrackModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 shadow-lg">
                <Plus className="w-4 h-4" /> NOVO ÁUDIO
              </button>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-850 overflow-hidden">
              <table className="w-full text-left text-xs text-white">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] font-mono tracking-widest uppercase">
                    <th className="p-3">Título / Artista</th>
                    <th className="p-3">Volume de Loop</th>
                    <th className="p-3">Ponto de Corte</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {tracks.map((t) => (
                    <tr key={t.id}>
                      <td className="p-3">
                        <p className="font-bold">{t.title}</p>
                        <p className="text-slate-400 text-[10px]">{t.artist}</p>
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        Vol {t.volume * 100}% • Loop: {t.loop ? 'Sim' : 'Não'}
                      </td>
                      <td className="p-3 font-mono text-indigo-400">
                        {t.startPoint}s - {t.endPoint}s ({t.endPoint - t.startPoint}s)
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => {
                            if(confirm("Deseja deletar esta trilha?")) {
                              SpinDb.deleteMusicTrack(t.id);
                              triggerReload();
                            }
                          }}
                          className="text-red-500 hover:text-red-400 font-mono text-[11px] cursor-pointer">
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SPONSORS PANEL */}
        {activeTab === 'sponsors' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-indigo-400" /> Biblioteca de Patrocinadores
                </h2>
                <p className="text-xs text-slate-400">Adicione as marcas, sites e logos transparentes que integram as molduras das ativações.</p>
              </div>
              <button 
                onClick={() => setIsSponsorModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 shadow-lg">
                <Plus className="w-4 h-4" /> NOVO CO-PATROCÍNIO
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {sponsors.map((s) => (
                <div key={s.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between items-center text-center">
                  <img referrerPolicy="no-referrer" src={s.logoUrl} alt={s.name} className="w-12 h-12 object-cover rounded-full border border-slate-800 mb-3" />
                  <div>
                    <h4 className="text-white text-xs font-bold">{s.name}</h4>
                    <p className="text-[10px] text-slate-400 truncate mt-1 w-32">{s.siteUrl || 'Sem link informado'}</p>
                  </div>
                  <div className="flex items-center gap-3 w-full border-t border-slate-900 mt-4 pt-3 justify-between">
                    <span style={{ backgroundColor: s.primaryColor }} className="w-3 h-3 rounded-full inline-block" title="Cor primária link" />
                    <button 
                      onClick={() => {
                        if(confirm("Deseja deletar este patrocinador?")) {
                          SpinDb.deleteSponsor(s.id);
                          triggerReload();
                        }
                      }}
                      className="text-red-500 hover:text-red-400 text-[10px] font-mono font-bold">
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CAPTURED LEADS PANEL WITH CSV EXPORTER */}
        {activeTab === 'leads' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                  <Users className="w-6 h-6 text-indigo-400" /> Participantes &amp; Leads Capturados (LGPD)
                </h2>
                <p className="text-xs text-slate-400 font-mono">Total de {leads.length} cadastros de leads vinculados a download de mídia.</p>
              </div>
              <button 
                onClick={handleExportLeadsCSV}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 shadow-lg">
                <FileSpreadsheet className="w-4 h-4" /> EXPORTAR CSV EXCEL
              </button>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-850 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-white min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px] font-mono tracking-widest uppercase bg-slate-900/50">
                      <th className="p-3">Nome / WhatsApp</th>
                      <th className="p-3">E-mail / Cidade</th>
                      <th className="p-3">Instagram / Empresa</th>
                      <th className="p-3">Consentimento LGPD</th>
                      <th className="p-3 text-right">Cadastrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {leads.map((l) => (
                      <tr key={l.id}>
                        <td className="p-3 font-bold">
                          <div>{l.name || 'Sem nome'}</div>
                          <div className="text-slate-400 text-[10px] font-mono">{l.phone || 'Sem celular'}</div>
                        </td>
                        <td className="p-3">
                          <div>{l.email || 'Sem e-mail'}</div>
                          <div className="text-slate-450 text-[10px]">{l.city || 'Petrolina - PE'}</div>
                        </td>
                        <td className="p-3">
                          <div>{l.instagram || 'Sem instagram'}</div>
                          <div className="text-slate-500 text-[10px]">{l.company || 'Visitante Avulso'}</div>
                        </td>
                        <td className="p-3">
                          <span className="bg-emerald-500/10 text-emerald-400 text-[9px] px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1 border border-emerald-500/20">
                            <ShieldCheck className="w-3.5 h-3.5" /> Ativo
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-500 text-[10px]">
                          {l.consentTimestamp.substring(11, 16)} • {l.consentTimestamp.substring(8, 10)}/{l.consentTimestamp.substring(5, 7)}
                        </td>
                      </tr>
                    ))}
                    {leads.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 text-xs font-mono">
                          Nenhum participante final realizou o fluxo completo de leads até o momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* AUDIT LOGS */}
        {activeTab === 'audits' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-indigo-400" /> Registro de Auditoria Administrativa
              </h2>
              <p className="text-xs text-slate-400">Visão obrigatória em conformidade com RN-07 para segurança de logs operacionais.</p>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-850 overflow-hidden font-mono text-[11px]">
              <div className="overflow-y-auto max-h-[460px] divide-y divide-slate-850">
                {audits.map((a) => (
                  <div key={a.id} className="p-3 text-slate-300 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500 font-bold">[{a.action.toUpperCase()}]</span>
                        <span className="text-slate-400 text-[10px]">por {a.userEmail}</span>
                      </div>
                      <p className="text-slate-200">
                        Operação na entidade &quot;<span className="text-indigo-400 font-bold">{a.entityType}</span>&quot;
                        {a.entityId && <span> (ID: {a.entityId})</span>}
                      </p>
                      {a.meta && (
                        <span className="text-[9px] bg-slate-900 border border-slate-800 p-1 rounded inline-block text-slate-400 text-wrap w-full">
                          METADATA: {JSON.stringify(a.meta)}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-500 text-[9px] text-right flex-none">
                      {a.createdAt.substring(11, 19)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SYSTEM PREFERENCES */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <Settings className="w-6 h-6 text-indigo-400" /> Configurações de Sistema &amp; Retenção
              </h2>
              <p className="text-xs text-slate-400">Altere variáveis globais, tempos de limpeza do Storage e banco de dados de semente.</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
                {settings.map((s) => (
                  <div key={s.key} className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">{s.description || s.key}</label>
                    <input 
                      type="text" 
                      value={s.value}
                      onChange={(e) => {
                        SpinDb.saveSetting(s.key, e.target.value);
                        triggerReload();
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-xs text-white"
                    />
                  </div>
                ))}
              </div>

              {/* Dangerous operations */}
              <div className="border-t border-slate-900 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest font-mono">Operações Destrutivas de Banco</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  Sendo o operador administrativo principal de testes do ArtTech, é possível retornar instantaneamente as configurações ao padrão preenchido, simulando novas sementes para visualização do fluxo limpo de totem.
                </p>
                <button
                  type="button"
                  onClick={handleSystemReset}
                  className="bg-red-950 hover:bg-red-900 text-red-450 border border-red-800 hover:text-white px-3.5 py-2 rounded-xl text-xs font-mono font-bold uppercase cursor-pointer">
                  Restaurar Banco de Semente
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* CREATE/EDIT EVENT MODAL (DURABLE & FULL PROPERTIES) */}
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-1 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-850 flex justify-between items-center">
              <h3 className="text-white font-display text-lg font-bold">
                {editingEvent ? '📝 Editar Configuração de Evento' : '✨ Criar Novo Evento Promocional'}
              </h3>
              <button 
                onClick={() => setIsEventModalOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-xs p-1">
                Fechar
              </button>
            </div>

            <form onSubmit={handleEventSave} className="p-6 space-y-4 text-xs text-slate-350">

              {/* ESSENCIAL */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Nome do Evento *</label>
                  <input
                    type="text" required placeholder="Ex: São João da Real Calçados 2026"
                    value={evtName} onChange={e => setEvtName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Moldura Vinculada *</label>
                  <select
                    value={evtFrameId} onChange={e => setEvtFrameId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none">
                    <option value="">Selecione uma Moldura...</option>
                    {[...supabaseFrames, ...frames.filter(f => !supabaseFrames.find(sf => sf.id === f.id))].map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Duração do Vídeo</label>
                    <select
                      value={evtDuration} onChange={e => setEvtDuration(Number(e.target.value) as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white">
                      <option value={5}>5 segundos</option>
                      <option value={10}>10 segundos</option>
                      <option value={15}>15 segundos</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Status</label>
                    <select
                      value={evtStatus} onChange={e => setEvtStatus(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white">
                      <option value="draft">Rascunho</option>
                      <option value="active">Ativo</option>
                      <option value="paused">Pausado</option>
                      <option value="finished">Finalizado</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Música de Fundo</label>
                  <select
                    value={evtMusicId} onChange={e => setEvtMusicId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white">
                    <option value="">Sem música</option>
                    {[...supabaseTracks, ...tracks.filter(t => !supabaseTracks.find(st => st.id === t.id))].map(t => <option key={t.id} value={t.id}>{t.title} — {t.artist}</option>)}
                  </select>
                </div>
              </div>

              {/* CONFIGURAÇÕES AVANÇADAS (colapsável) */}
              <details className="bg-slate-950 border border-slate-800 rounded-2xl">
                <summary className="px-4 py-3 text-[10px] font-mono font-bold text-slate-400 uppercase cursor-pointer select-none">
                  ⚙️ Configurações Avançadas (opcional)
                </summary>
                <div className="px-4 pb-4 space-y-3 mt-2">

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Descrição</label>
                    <textarea
                      value={evtDesc} onChange={e => setEvtDesc(e.target.value)} rows={2}
                      placeholder="Descrição do evento para relatórios"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Data</label>
                      <input type="date" value={evtDate} onChange={e => setEvtDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Horário</label>
                      <input type="time" value={evtTime} onChange={e => setEvtTime(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Imagem de Capa (URL)</label>
                    <input type="text" placeholder="https://..." value={evtCover} onChange={e => setEvtCover(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Categoria</label>
                    <select value={evtCategory} onChange={e => setEvtCategory(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white">
                      <option value="Balada / Festival">Balada / Festival</option>
                      <option value="Sazonal">Sazonal / São João</option>
                      <option value="Casamentos">Casamentos</option>
                      <option value="Corporativo">Corporativo / Marketing</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Efeito de Velocidade</label>
                    <select value={evtEffectId} onChange={e => setEvtEffectId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white">
                      {SEED_EFFECTS.map(eff => <option key={eff.id} value={eff.id}>{eff.name.split(':')[0]}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Cor-Tema</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={evtColor} onChange={e => setEvtColor(e.target.value)}
                        className="w-8 h-8 rounded border-none bg-transparent cursor-pointer" />
                      <div className="flex gap-1">
                        {['#6366f1','#ca8a04','#ef4444','#d946ef','#10b981','#06b6d4'].map(col => (
                          <button key={col} type="button" onClick={() => setEvtColor(col)}
                            style={{ backgroundColor: col }}
                            className={`w-5 h-5 rounded-full ${evtColor === col ? 'ring-2 ring-white scale-110' : ''}`} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Patrocinadores</label>
                    {sponsors.map(s => {
                      const isChecked = evtSponsorIds.includes(s.id);
                      const config = evtSponsorConfigs[s.id] || { position: 'bottom_right', order: 1 };
                      return (
                        <div key={s.id} className="flex flex-wrap items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 gap-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={isChecked} onChange={() => handleSponsorCheck(s.id)} className="rounded text-indigo-500" />
                            <span className="text-white text-xs font-bold">{s.name}</span>
                          </label>
                          {isChecked && (
                            <select value={config.position} onChange={e => handleSponsorPosChange(s.id, e.target.value as any)}
                              className="bg-slate-950 text-indigo-400 border border-slate-800 rounded px-1 py-0.5 text-[11px] font-mono">
                              <option value="top_left">Superior Esq.</option>
                              <option value="top_right">Superior Dir.</option>
                              <option value="bottom_left">Inferior Esq.</option>
                              <option value="bottom_right">Inferior Dir.</option>
                              <option value="center">Centro</option>
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={evtTotem} onChange={e => setEvtTotem(e.target.checked)} className="rounded text-indigo-500" />
                    <span className="text-white text-xs">Habilitar Modo Totem (botão gigante GRAVAR AGORA)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={evtLeads} onChange={e => setEvtLeads(e.target.checked)} className="rounded text-indigo-500" />
                    <span className="text-white text-xs">Capturar dados do participante antes de gravar (LGPD)</span>
                  </label>

                  {evtLeads && (
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 mt-2">
                      <span className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Campos obrigatórios:</span>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={evtLeadFields.name} onChange={e => setEvtLeadFields({ ...evtLeadFields, name: e.target.checked })} className="rounded text-indigo-500" />
                          <span>Nome</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={evtLeadFields.phone} onChange={e => setEvtLeadFields({ ...evtLeadFields, phone: e.target.checked })} className="rounded text-indigo-500" />
                          <span>WhatsApp</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={evtLeadFields.city} onChange={e => setEvtLeadFields({ ...evtLeadFields, city: e.target.checked })} className="rounded text-indigo-500" />
                          <span>Cidade</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={evtLeadFields.email} onChange={e => setEvtLeadFields({ ...evtLeadFields, email: e.target.checked })} className="rounded text-indigo-500" />
                          <span>E-mail</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={evtLeadFields.instagram} onChange={e => setEvtLeadFields({ ...evtLeadFields, instagram: e.target.checked })} className="rounded text-indigo-500" />
                          <span>Instagram</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={evtLeadFields.company} onChange={e => setEvtLeadFields({ ...evtLeadFields, company: e.target.checked })} className="rounded text-indigo-500" />
                          <span>Empresa</span>
                        </label>
                      </div>
                    </div>
                  )}

                </div>
              </details>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsEventModalOpen(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold font-mono text-xs">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold font-mono text-xs shadow-lg">
                  {editingEvent ? 'Salvar Alterações' : 'Criar Evento'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL CREATOR: FRAMES */}
      {isFrameModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleFrameSave} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl w-full max-w-md shadow-2xl space-y-4 text-xs">
            <h3 className="text-white text-lg font-display font-bold">Adicionar Nova Moldura SVG</h3>
            
            <div className="space-y-1">
              <label className="text-slate-405 block">Nome da Moldura</label>
              <input 
                type="text" required placeholder="e.g. Moldura Aniversário Florido"
                value={frmName} onChange={e => setFrmName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-405 block">Categoria Comercial</label>
              <select 
                value={frmCategory} onChange={e => setFrmCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white">
                <option value="Corporativo">Corporativo</option>
                <option value="Balada">Balada / Show</option>
                <option value="Casamentos">Casamentos</option>
                <option value="Sazonal">Sazonal / Junina</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-slate-405 block font-bold">Upload PNG/WebP (recomendado 1080×1920)</label>
              <input
                type="file"
                accept="image/png,image/webp"
                onChange={e => setFrmFile(e.target.files?.[0] || null)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white text-xs file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
              {frmFile && <p className="text-emerald-400 text-[10px] font-mono">✓ {frmFile.name}</p>}
              <label className="text-slate-500 text-[10px] block">Ou selecione um preset de demonstração:</label>
              <select
                value={frmImage} onChange={e => setFrmImage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white">
                <option value="cyberpunk">Cyberpunk Neon Pink HUD</option>
                <option value="festajunina">Festa Junina swags &amp; bonfire</option>
                <option value="wedding">Casamento Clássico Gold Floral</option>
                <option value="corporate">Leader Board Corporate Grid</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-405 block">Tags de busca (separadas por vírgula)</label>
              <input 
                type="text" placeholder="neon, glow, lights"
                value={frmTags} onChange={e => setFrmTags(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsFrameModalOpen(false)} className="flex-1 py-2 bg-slate-800 rounded-xl font-medium text-slate-300">Descartar</button>
              <button type="submit" disabled={frmUploading} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-60">
                {frmUploading ? 'Enviando...' : 'Salvar Moldura'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CREATOR: SPONSORS */}
      {isSponsorModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSponsorSave} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl w-full max-w-md shadow-2xl space-y-4 text-xs">
            <h3 className="text-white text-lg font-display font-bold">Adicionar Novo Patrocinador</h3>
            
            <div className="space-y-1">
              <label className="text-slate-405 block">Nome da Empresa</label>
              <input 
                type="text" required placeholder="e.g. Heineken Brasil"
                value={sponsName} onChange={e => setSponsName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-405 block font-bold">Upload do Logo (PNG / JPG / SVG)</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                onChange={e => setSponsFile(e.target.files?.[0] || null)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white text-xs file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
              {sponsFile && <p className="text-emerald-400 text-[10px] font-mono">✓ {sponsFile.name}</p>}
              <label className="text-slate-500 text-[10px] block">Ou cole uma URL de imagem:</label>
              <input
                type="text" placeholder="https://..."
                value={sponsLogo} onChange={e => setSponsLogo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-405 block">Website Promocional</label>
              <input 
                type="text" placeholder="https://exemplo.com"
                value={sponsSite} onChange={e => setSponsSite(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-405 block">Cor Geral do Layout</label>
              <input 
                type="color" value={sponsColor} onChange={e => setSponsColor(e.target.value)}
                className="w-10 h-8 rounded bg-transparent border-none cursor-pointer"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsSponsorModalOpen(false)} className="flex-1 py-2 bg-slate-800 rounded-xl font-medium text-slate-300">Descartar</button>
              <button type="submit" disabled={sponsUploading} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-60">
                {sponsUploading ? 'Enviando...' : 'Salvar Marca'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CREATOR: MUSIC TRACKS */}
      {isTrackModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleTrackSave} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl w-full max-w-md shadow-2xl space-y-4 text-xs">
            <h3 className="text-white text-lg font-display font-bold">Adicionar Trilha Sonora MP3</h3>
            
            <div className="space-y-1">
              <label className="text-slate-405 block">Título da Música</label>
              <input 
                type="text" required placeholder="e.g. Summer Bass Drop"
                value={trackTitle} onChange={e => setTrackTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-450 block">Artista / Banda</label>
              <input 
                type="text" required placeholder="e.g. DJ Alok Mix"
                value={trackArtist} onChange={e => setTrackArtist(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-450 block font-bold">Upload de Áudio (MP3 / WAV / M4A)</label>
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/m4a,audio/x-m4a"
                onChange={e => setTrkFile(e.target.files?.[0] || null)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white text-xs file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
              {trkFile && <p className="text-emerald-400 text-[10px] font-mono">✓ {trkFile.name}</p>}
              <label className="text-slate-500 text-[10px] block">Ou cole uma URL de stream:</label>
              <input
                type="text" placeholder="https://www.soundhelix.com/..."
                value={trackUrl} onChange={e => setTrackUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-slate-450 block">Início do Corte (s)</label>
                <input 
                  type="number" value={trackStart} min={0} onChange={e => setTrackStart(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-450 block">Término do Corte (s)</label>
                <input 
                  type="number" value={trackEnd} min={5} onChange={e => setTrackEnd(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsTrackModalOpen(false)} className="flex-1 py-2 bg-slate-800 rounded-xl font-medium text-slate-300">Descartar</button>
              <button type="submit" disabled={trkUploading} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-60">
                {trkUploading ? 'Enviando...' : 'Salvar Trilha'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
