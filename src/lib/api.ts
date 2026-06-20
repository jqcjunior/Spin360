import { supabase } from './supabase';
import { Event, Frame, MusicTrack, Sponsor } from '../types';

// ============================================================
// EVENTOS
// ============================================================
export async function getActiveEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, frames:frame_id(id,name,image_url,tags), music_tracks:music_id(id,name,file_url,volume,fade_in_seconds,fade_out_seconds,is_loop,start_point_seconds)')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((e: any) => ({
    id: e.id,
    name: e.name,
    description: e.description || '',
    date: e.event_date || '',
    time: e.event_time || '',
    coverUrl: e.cover_image_url || undefined,
    status: e.status,
    category: e.category || 'Geral',
    frameId: e.frame_id || '',
    musicId: e.music_id || undefined,
    sponsorIds: [],
    sponsorsConfig: {},
    videoDuration: e.video_duration_seconds || 10,
    effectPresetId: 'eff_01',
    themeColor: e.theme_color || '#6366f1',
    enableTotemMode: e.totem_mode_enabled !== false,
    enableLeadCapture: e.lead_capture_config?.enabled || false,
    requiredLeadFields: e.lead_capture_config?.fields || { name: true, phone: true, city: false, email: false, instagram: false, company: false },
    lgpdConsentText: e.lead_capture_config?.lgpd_text || 'Autorizo a captação dos meus dados.',
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  }));
}

export async function getAllEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((e: any) => ({
    id: e.id,
    name: e.name,
    description: e.description || '',
    date: e.event_date || '',
    time: e.event_time || '',
    coverUrl: e.cover_image_url || undefined,
    status: e.status,
    category: e.category || 'Geral',
    frameId: e.frame_id || '',
    musicId: e.music_id || undefined,
    sponsorIds: [],
    sponsorsConfig: {},
    videoDuration: e.video_duration_seconds || 10,
    effectPresetId: 'eff_01',
    themeColor: e.theme_color || '#6366f1',
    enableTotemMode: e.totem_mode_enabled !== false,
    enableLeadCapture: e.lead_capture_config?.enabled || false,
    requiredLeadFields: e.lead_capture_config?.fields || { name: true, phone: true, city: false, email: false, instagram: false, company: false },
    lgpdConsentText: e.lead_capture_config?.lgpd_text || 'Autorizo a captação dos meus dados.',
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  }));
}

export async function saveEvent(event: Event): Promise<void> {
  const frameUuid = event.frameId?.length === 36 ? event.frameId : null;
  const musicUuid = event.musicId?.length === 36 ? event.musicId : null;
  const eventId = event.id?.length === 36 ? event.id : undefined;

  await (supabase.from('events') as any).upsert({
    ...(eventId ? { id: eventId } : {}),
    name: event.name,
    description: event.description || null,
    event_date: event.date || null,
    event_time: event.time || null,
    cover_image_url: event.coverUrl || null,
    status: event.status,
    category: event.category || 'Geral',
    frame_id: frameUuid,
    music_id: musicUuid,
    video_duration_seconds: event.videoDuration,
    theme_color: event.themeColor || '#6366f1',
    totem_mode_enabled: event.enableTotemMode || false,
    lead_capture_config: {
      enabled: event.enableLeadCapture,
      fields: event.requiredLeadFields,
      lgpd_text: event.lgpdConsentText,
    },
    created_at: event.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function deleteEvent(id: string): Promise<void> {
  await supabase.from('events').delete().eq('id', id);
}

// ============================================================
// MOLDURAS
// ============================================================
export async function getFrames(): Promise<Frame[]> {
  const { data, error } = await supabase
    .from('frames')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map((f: any) => ({
    id: f.id,
    name: f.name,
    imageUrl: f.image_url,
    category: 'Geral',
    tags: f.tags || [],
    isActive: f.is_active,
    createdAt: f.created_at,
  }));
}

// ============================================================
// MÚSICAS
// ============================================================
export async function getMusicTracks(): Promise<MusicTrack[]> {
  const { data, error } = await supabase
    .from('music_tracks')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map((t: any) => ({
    id: t.id,
    title: t.name,
    artist: '',
    audioUrl: t.file_url,
    volume: t.volume || 0.8,
    fadeIn: t.fade_in_seconds || 1,
    fadeOut: t.fade_out_seconds || 1,
    loop: t.is_loop !== false,
    startPoint: t.start_point_seconds || 0,
    endPoint: t.end_point_seconds || 30,
    createdAt: t.created_at,
  }));
}

// ============================================================
// PATROCINADORES
// ============================================================
export async function getSponsors(): Promise<Sponsor[]> {
  const { data, error } = await supabase
    .from('sponsors')
    .select('*')
    .eq('is_active', true);

  if (error || !data) return [];

  return data.map((s: any) => ({
    id: s.id,
    name: s.name,
    logoUrl: s.logo_url,
    siteUrl: s.website,
    primaryColor: s.primary_color,
    secondaryColor: s.secondary_color,
    isActive: s.is_active,
    createdAt: s.created_at,
  }));
}