/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// User profile roles
export type UserRole = 'admin' | 'operator' | 'client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

// Catálogo: Molduras (Frames)
export interface Frame {
  id: string;
  name: string;
  imageUrl: string; // Base64 or URL
  category: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
}

export interface FrameCategory {
  id: string;
  name: string;
  createdAt: string;
}

// Catálogo: Patrocinadores (Sponsors)
export type LogoPosition = 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'center';

export interface Sponsor {
  id: string;
  name: string;
  logoUrl: string; // Base64 or URL
  siteUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  isActive: boolean;
  createdAt: string;
}

export interface EventSponsor {
  eventId: string;
  sponsorId: string;
  position: LogoPosition;
  displayOrder: number;
}

// Catálogo: Músicas (Music Tracks)
export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl: string; // Path or base64
  volume: number; // 0.0 to 1.0
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  loop: boolean;
  startPoint: number; // seconds
  endPoint: number; // seconds
  createdAt: string;
}

// Catálogo: Efeitos de Velocidade (Effect Presets)
export interface SpeedStep {
  speed: number; // e.g. 0.5, 1.0, 2.0
  duration: number; // duration of stage in seconds
}

export interface EffectPreset {
  id: string;
  name: string;
  description: string;
  steps: SpeedStep[]; // Sequência de etapas
  isDefault?: boolean;
}

// Operação: Eventos
export type EventStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export interface LeadFieldConfig {
  name: boolean;
  phone: boolean;
  city: boolean;
  email: boolean;
  instagram: boolean;
  company: boolean;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  time: string;
  coverUrl?: string;
  status: EventStatus;
  category: string;
  frameId: string; // Required for 'active'
  musicId?: string;
  sponsorIds: string[]; // Linked sponsor IDs
  sponsorsConfig: Record<string, { position: LogoPosition; order: number }>;
  videoDuration: 5 | 10 | 15; // Restricted values
  effectPresetId: string; // Link to Speed Effect
  themeColor: string; // hex color for UI
  enableTotemMode: boolean;
  enableLeadCapture: boolean;
  requiredLeadFields: LeadFieldConfig;
  lgpdConsentText: string;
  createdAt: string;
  updatedAt: string;
}

// Captura de Leads
export interface VideoLead {
  id: string;
  eventId: string;
  name?: string;
  phone?: string;
  city?: string;
  email?: string;
  instagram?: string;
  company?: string;
  lgpdConsent: boolean;
  consentTimestamp: string;
}

// Vídeos gravados e renderizados
export type VideoStatus = 'processing' | 'completed' | 'failed' | 'pending';

export interface VideoRecord {
  id: string;
  slug: string; // Unique URL shortener code e.g. "a3bf9"
  eventId: string;
  leadId?: string;
  url: string; // Final video source
  thumbnailUrl: string;
  duration: number;
  status: VideoStatus;
  errorMessage?: string;
  effectAppliedId?: string;
  frameAppliedId?: string;
  musicAppliedId?: string;
  viewsCount: number;
  downloadsCount: number;
  sharesCount: number;
  createdAt: string;
}

// Logs de monitoramento
export interface VideoView {
  id: string;
  videoId: string;
  userAgent?: string;
  ip?: string;
  createdAt: string;
}

export interface VideoDownload {
  id: string;
  videoId: string;
  createdAt: string;
}

export interface VideoShare {
  id: string;
  videoId: string;
  channel: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'airdrop' | 'link' | 'qrcode' | 'other';
  createdAt: string;
}

// Governança e Configurações
export interface SystemSetting {
  key: string;
  value: string;
  description?: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string; // empty if anonymous participant action
  userEmail?: string;
  action: string; // 'login', 'create_event', 'delete_video', etc.
  entityType: string; // 'event', 'video', 'sponsor', etc.
  entityId?: string;
  meta?: any;
  ipAddress?: string;
  createdAt: string;
}

export interface SystemLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  module: string;
  createdAt: string;
}
