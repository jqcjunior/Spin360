/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  User, Frame, FrameCategory, Sponsor, MusicTrack, EffectPreset, 
  Event, VideoRecord, VideoLead, VideoView, VideoDownload, VideoShare, 
  SystemSetting, AuditLog, SystemLog, LogoPosition
} from './types';

// Storage Keys
const STORAGE_KEY_PREFIX = 'spin360_';
const keyOf = (name: string) => `${STORAGE_KEY_PREFIX}${name}`;

// Raw SVGs for Frames to allow beautiful scaling and high performance rendering in Canvas
export const DEMO_FRAMES_SVG: Record<string, string> = {
  cyberpunk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="100%" height="100%">
    <!-- Ambient cyberpunk neon grid border -->
    <rect x="30" y="30" width="1020" height="1860" rx="30" fill="none" stroke="url(#neon-grad)" stroke-width="20" />
    <rect x="50" y="50" width="980" height="1820" rx="15" fill="none" stroke="#22d3ee" stroke-width="2" stroke-dasharray="10 15" opacity="0.6"/>
    <!-- Tech Corners -->
    <path d="M 20 150 L 20 20 L 150 20" fill="none" stroke="#f43f5e" stroke-width="12" />
    <path d="M 1060 150 L 1060 20 L 930 20" fill="none" stroke="#f43f5e" stroke-width="12" />
    <path d="M 20 1770 L 20 1900 L 150 1900" fill="none" stroke="#6366f1" stroke-width="12" />
    <path d="M 1060 1770 L 1060 1900 L 930 1900" fill="none" stroke="#6366f1" stroke-width="12" />
    <!-- Bottom HUD decoration -->
    <rect x="340" y="1840" width="400" height="40" rx="5" fill="#0f172a" stroke="#22d3ee" stroke-width="3"/>
    <text x="540" y="1866" fill="#22d3ee" font-family="monospace" font-size="22" font-weight="bold" text-anchor="middle" letter-spacing="4">SPIN 360 SYSTEM</text>
    <!-- Top HUD -->
    <rect x="390" y="40" width="300" height="35" rx="5" fill="#0f172a" stroke="#f43f5e" stroke-width="2"/>
    <text x="540" y="64" fill="#f43f5e" font-family="monospace" font-size="16" text-anchor="middle" letter-spacing="2">REC MODE: 360FPS</text>
    <defs>
      <linearGradient id="neon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f43f5e"/>
        <stop offset="50%" stop-color="#a855f7"/>
        <stop offset="100%" stop-color="#6366f1"/>
      </linearGradient>
    </defs>
  </svg>`,

  festajunina: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="100%" height="100%">
    <!-- Wood frame aesthetic -->
    <rect x="25" y="25" width="1030" height="1870" rx="30" fill="none" stroke="#78350f" stroke-width="25" />
    <rect x="45" y="45" width="990" height="1830" rx="15" fill="none" stroke="#b45309" stroke-width="8" />
    <!-- Colorful Bunting/Bandeirinhas at top -->
    <g id="bandeirinhas" opacity="0.95">
      <path d="M 45 45 Q 270 150, 540 45 Q 810 150, 1035 45" fill="none" stroke="#f59e0b" stroke-width="4" stroke-dasharray="2 10" />
      <!-- Swag 1 -->
      <polygon points="100,50 140,50 120,120" fill="#ef4444" />
      <polygon points="170,60 210,65 190,130" fill="#3b82f6" />
      <polygon points="240,75 280,82 260,145" fill="#10b981" />
      <polygon points="310,85 350,90 330,150" fill="#f59e0b" />
      <polygon points="380,90 420,90 400,150" fill="#ec4899" />
      <polygon points="450,85 490,75 470,140" fill="#8b5cf6" />
      <!-- Swag 2 -->
      <polygon points="580,75 620,85 600,140" fill="#ef4444" />
      <polygon points="650,90 690,90 670,150" fill="#3b82f6" />
      <polygon points="720,90 760,85 740,150" fill="#10b981" />
      <polygon points="790,82 830,75 810,145" fill="#f59e0b" />
      <polygon points="860,65 900,60 880,130" fill="#ec4899" />
      <polygon points="930,50 970,50 950,120" fill="#8b5cf6" />
    </g>
    <!-- Decorative Balloons (Balões de Festa Junina) -->
    <g transform="translate(100, 200) scale(0.6)">
      <polygon points="100,0 150,80 100,160 50,80" fill="#f59e0b" stroke="#78350f" stroke-width="5"/>
      <polygon points="100,0 100,160 50,80" fill="#ef4444" />
      <rect x="95" y="158" width="10" height="30" fill="#b45309" />
      <path d="M 80 188 L 120 188" stroke="#ef4444" stroke-width="4" />
    </g>
    <g transform="translate(880, 200) scale(0.6)">
      <polygon points="100,0 150,80 100,160 50,80" fill="#10b981" stroke="#78350f" stroke-width="5"/>
      <polygon points="100,0 100,160 50,80" fill="#3b82f6" />
      <rect x="95" y="158" width="10" height="30" fill="#b45309" />
      <path d="M 80 188 L 120 188" stroke="#10b981" stroke-width="4" />
    </g>
    <!-- Bonfire (Fogueira) at bottom -->
    <g transform="translate(440, 1690) scale(1)">
      <!-- logs -->
      <rect x="20" y="110" width="160" height="30" rx="10" fill="#78350f" transform="rotate(-15 100 120)" />
      <rect x="20" y="110" width="160" height="30" rx="10" fill="#b45309" transform="rotate(15 100 120)" />
      <!-- flames -->
      <path d="M 70 120 C 50 60, 80 10, 100 0 C 120 30, 130 60, 120 120 Z" fill="#ef4444" opacity="0.9"/>
      <path d="M 80 120 C 70 80, 90 40, 100 30 C 110 50, 120 80, 110 120 Z" fill="#f97316" opacity="0.95"/>
      <path d="M 90 120 C 85 95, 95 70, 100 60 C 105 70, 110 95, 105 120 Z" fill="#eab308" />
    </g>
    <!-- Festivities Text banner at bottom -->
    <rect x="180" y="1810" width="720" height="60" rx="30" fill="#f59e0b" stroke="#78350f" stroke-width="4"/>
    <text x="540" y="1850" fill="#78350f" font-family="sans-serif" font-weight="900" font-size="28" text-anchor="middle">★ ARRAIÁ SPIN 360 ★</text>
  </svg>`,

  wedding: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="100%" height="100%">
    <!-- Subtle luxury gold double border -->
    <rect x="40" y="40" width="1000" height="1840" rx="20" fill="none" stroke="#d97706" stroke-width="4" opacity="0.75" />
    <rect x="52" y="52" width="976" height="1816" rx="12" fill="none" stroke="#f59e0b" stroke-width="1.5" opacity="0.5" />
    <!-- Botanical corner curves -->
    <g stroke="#d97706" stroke-width="2" fill="none" opacity="0.8">
      <!-- Top Left Leaf Swirl -->
      <path d="M 50 140 C 50 80, 80 50, 140 50" />
      <path d="M 50 160 C 50 70, 70 50, 160 50" />
      <circle cx="95" cy="95" r="8" fill="#f59e0b" />
      <!-- Top Right Leaf Swirl -->
      <path d="M 1030 140 C 1030 80, 1000 50, 940 50" />
      <path d="M 1030 160 C 1030 70, 1010 50, 920 50" />
      <circle cx="985" cy="95" r="8" fill="#f59e0b" />
      <!-- Bottom Left Swirl -->
      <path d="M 50 1780 C 50 1840, 80 1870, 140 1870" />
      <circle cx="95" cy="1825" r="8" fill="#f59e0b" />
      <!-- Bottom Right Swirl -->
      <path d="M 1030 1780 C 1030 1840, 1000 1870, 940 1870" />
      <circle cx="985" cy="1825" r="8" fill="#f59e0b" />
    </g>
    <!-- Elegant Wedding Crest / Footer -->
    <rect x="290" y="1770" width="500" height="85" rx="10" fill="#ffffff" stroke="#d97706" stroke-width="2" opacity="0.95"/>
    <text x="540" y="1808" fill="#1e293b" font-family="'Playfair Display', 'Didot', 'Georgia', serif" font-weight="bold" font-size="24" text-anchor="middle">A &amp; T</text>
    <text x="540" y="1838" fill="#d97706" font-family="'Playfair Display', serif" font-style="italic" font-weight="medium" font-size="18" text-anchor="middle">Nossa União • 18 de Junho de 2026</text>
  </svg>`,

  corporate: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="100%" height="100%">
    <!-- Clean professional grid borders -->
    <rect x="30" y="30" width="1020" height="1860" rx="8" fill="none" stroke="#475569" stroke-width="4" />
    <line x1="30" y1="120" x2="1050" y2="120" stroke="#475569" stroke-width="2"/>
    <line x1="30" y1="1800" x2="1050" y2="1800" stroke="#475569" stroke-width="2"/>
    
    <!-- Info Header Dots -->
    <circle cx="60" cy="75" r="10" fill="#ef4444" />
    <circle cx="90" cy="75" r="10" fill="#eab308" />
    <circle cx="120" cy="75" r="10" fill="#22c55e" />
    
    <text x="200" y="82" fill="#94a3b8" font-family="'Space Grotesk', system-ui, sans-serif" font-weight="600" font-size="20">SPIN 360 PRO PANEL</text>
    <text x="1020" y="82" fill="#22c55e" font-family="monospace" font-size="20" font-weight="bold" text-anchor="end">● SYS ACTIVE</text>
    
    <!-- Diagonal Corner Accent strips -->
    <polygon points="30,220 120,30 140,30 30,140" fill="#3b82f6" opacity="0.5" />
    <polygon points="1050,1700 960,1890 940,1890 1050,1780" fill="#3b82f6" opacity="0.5" />

    <!-- Brand Label Background footer -->
    <rect x="30" y="1800" width="1020" height="90" fill="#0f172a" opacity="0.9" />
    <text x="540" y="1855" fill="#ffffff" font-family="'Space Grotesk', sans-serif" font-weight="bold" font-size="28" letter-spacing="4" text-anchor="middle">GLOBAL MARKETING SUMMIT</text>
  </svg>`
};

// Initial Seed Assets (Logos & covers are base64-ish mocks of standard placeholder forms and visual graphics)
export const SEED_SPONSORS: Sponsor[] = [
  {
    id: 'spons_nike',
    name: 'Nike Air Max',
    logoUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=120&auto=format&fit=crop&q=60',
    siteUrl: 'https://nike.com',
    primaryColor: '#f97316',
    secondaryColor: '#ffffff',
    isActive: true,
    createdAt: new Date('2026-06-01').toISOString()
  },
  {
    id: 'spons_cocacola',
    name: 'Coca-Cola Zero',
    logoUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=120&auto=format&fit=crop&q=60',
    siteUrl: 'https://cocacola.com.br',
    primaryColor: '#ef4444',
    secondaryColor: '#000000',
    isActive: true,
    createdAt: new Date('2026-06-02').toISOString()
  },
  {
    id: 'spons_arttech',
    name: 'ArtTech Studio',
    logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60',
    siteUrl: 'https://arttech.dev',
    primaryColor: '#6366f1',
    secondaryColor: '#10b981',
    isActive: true,
    createdAt: new Date('2026-06-03').toISOString()
  }
];

export const SEED_M_TRACKS: MusicTrack[] = [
  {
    id: 'track_electro',
    title: 'Neon Horizon',
    artist: 'RetroSynths',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // royalty free stream URL
    volume: 0.8,
    fadeIn: 1,
    fadeOut: 1.5,
    loop: true,
    startPoint: 10,
    endPoint: 25,
    createdAt: new Date('2026-06-04').toISOString()
  },
  {
    id: 'track_junina',
    title: 'Sanfona de Ouro',
    artist: 'Trio Nordeste',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    volume: 0.9,
    fadeIn: 0.5,
    fadeOut: 1,
    loop: true,
    startPoint: 0,
    endPoint: 15,
    createdAt: new Date('2026-06-05').toISOString()
  },
  {
    id: 'track_luxury',
    title: 'Acoustic Wedding Love',
    artist: 'Strings & Co.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    volume: 0.7,
    fadeIn: 2,
    fadeOut: 2,
    loop: true,
    startPoint: 15,
    endPoint: 30,
    createdAt: new Date('2026-06-06').toISOString()
  },
  {
    id: 'track_corporate',
    title: 'Upbeat Tech Summit',
    artist: 'Corporate Beats',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    volume: 0.8,
    fadeIn: 1,
    fadeOut: 1,
    loop: true,
    startPoint: 5,
    endPoint: 20,
    createdAt: new Date('2026-06-07').toISOString()
  }
];

export const SEED_EFFECTS: EffectPreset[] = [
  {
    id: 'eff_01',
    name: 'Efeito 01: Acelerar → Super Slowmotion',
    description: 'Inicia rápido (2.0x) para impacto e desacelera para câmera lenta épica (0.5x)',
    steps: [
      { speed: 2.0, duration: 2 },
      { speed: 0.5, duration: 8 }
    ],
    isDefault: true
  },
  {
    id: 'eff_02',
    name: 'Efeito 02: Pêndulo Rítmico',
    description: 'Slowmotion inicial (0.5x), explosão de velocidade (2.0x), retorno ao Slow (0.5x)',
    steps: [
      { speed: 0.5, duration: 4 },
      { speed: 2.0, duration: 3 },
      { speed: 0.5, duration: 3 }
    ]
  },
  {
    id: 'eff_03',
    name: 'Efeito 03: Dança Dinâmica',
    description: 'Aceleração dupla (2.0x) dividida por um breve respiro em super slowmotion (0.5x)',
    steps: [
      { speed: 2.0, duration: 3 },
      { speed: 0.5, duration: 4 },
      { speed: 2.0, duration: 3 }
    ]
  },
  {
    id: 'eff_04',
    name: 'Efeito 04: Transição Natural',
    description: 'Velocidade normal (1.0x), mergulho em slowmotion (0.5x), retomada (1.0x) no fim',
    steps: [
      { speed: 1.0, duration: 3 },
      { speed: 0.5, duration: 4 },
      { speed: 1.0, duration: 3 }
    ]
  }
];

export const SEED_FRAMES: Frame[] = [
  {
    id: 'frame_cyber',
    name: 'Cyberpunk Neon Studio',
    imageUrl: 'cyberpunk',
    category: 'Balada / Festival',
    tags: ['Cyber', 'Neon', 'Sci-fi', 'Balada'],
    isActive: true,
    createdAt: new Date('2026-06-08').toISOString()
  },
  {
    id: 'frame_festa',
    name: 'Festa Junina Imperial',
    imageUrl: 'festajunina',
    category: 'Sazonal',
    tags: ['São João', 'Festa Junina', 'Quentão', 'Flags'],
    isActive: true,
    createdAt: new Date('2026-06-09').toISOString()
  },
  {
    id: 'frame_wedding',
    name: 'Casamento Clássico Ouro',
    imageUrl: 'wedding',
    category: 'Casamentos',
    tags: ['Wedding', 'Ouro', 'Leaves', 'Clássico'],
    isActive: true,
    createdAt: new Date('2026-06-10').toISOString()
  },
  {
    id: 'frame_corp',
    name: 'Leader Board Corporate',
    imageUrl: 'corporate',
    category: 'Corporativo',
    tags: ['Tech', 'Corporate', 'Summit', 'Clean'],
    isActive: true,
    createdAt: new Date('2026-06-11').toISOString()
  }
];

export const SEED_EVENTS: Event[] = [
  {
    id: 'evt_cyber_night',
    name: 'Festival Electric Galaxy 2026',
    description: 'Ativação promocional na área VIP da arena eletrônica principal.',
    date: '2026-06-25',
    time: '22:00',
    coverUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=60',
    status: 'active',
    category: 'Balada / Festival',
    frameId: 'frame_cyber',
    musicId: 'track_electro',
    sponsorIds: ['spons_nike', 'spons_arttech'],
    sponsorsConfig: {
      'spons_nike': { position: 'bottom_left', order: 1 },
      'spons_arttech': { position: 'bottom_right', order: 2 }
    },
    videoDuration: 10,
    effectPresetId: 'eff_01',
    themeColor: '#d946ef', // Fuchsia
    enableTotemMode: true,
    enableLeadCapture: true,
    requiredLeadFields: {
      name: true,
      phone: true,
      city: false,
      email: true,
      instagram: true,
      company: false
    },
    lgpdConsentText: 'Declaro que dou consentimento para captação dos meus dados e gravação do meu vídeo de imagem para fins de divulgação e envio por WhatsApp pela equipe da Spin 360 e patrocinadores autorizados.',
    createdAt: new Date('2026-06-12T14:00:00Z').toISOString(),
    updatedAt: new Date('2026-06-12T14:30:00Z').toISOString()
  },
  {
    id: 'evt_junina',
    name: 'Grande São João de Petrolina',
    description: 'A maior festa junina do estado com muita animação e registros 360 épicos.',
    date: '2026-06-23',
    time: '18:00',
    coverUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&auto=format&fit=crop&q=60',
    status: 'active',
    category: 'Sazonal',
    frameId: 'frame_festa',
    musicId: 'track_junina',
    sponsorIds: ['spons_cocacola'],
    sponsorsConfig: {
      'spons_cocacola': { position: 'top_right', order: 1 }
    },
    videoDuration: 15,
    effectPresetId: 'eff_02',
    themeColor: '#ca8a04', // Yellowish Gold
    enableTotemMode: true,
    enableLeadCapture: true,
    requiredLeadFields: {
      name: true,
      phone: true,
      city: true,
      email: false,
      instagram: false,
      company: false
    },
    lgpdConsentText: 'Autorizo o tratamento de informações cadastrais e captação de imagem para fins promocionais em parceria com a Coca-Cola Zero.',
    createdAt: new Date('2026-06-13T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-06-13T10:00:00Z').toISOString()
  },
  {
    id: 'evt_wedding_at',
    name: 'Casamento Amanda & Thiago',
    description: 'Registre sua mensagem especial para os noivos no nosso totem Spin 360!',
    date: '2026-06-20',
    time: '17:00',
    coverUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&auto=format&fit=crop&q=60',
    status: 'active',
    category: 'Casamentos',
    frameId: 'frame_wedding',
    musicId: 'track_luxury',
    sponsorIds: [],
    sponsorsConfig: {},
    videoDuration: 10,
    effectPresetId: 'eff_04',
    themeColor: '#d97706', // gold
    enableTotemMode: false,
    enableLeadCapture: false,
    requiredLeadFields: {
      name: false,
      phone: false,
      city: false,
      email: false,
      instagram: false,
      company: false
    },
    lgpdConsentText: 'Autorizo o envio do meu vídeo para a pasta privada dos noivos.',
    createdAt: new Date('2026-06-14T08:00:00Z').toISOString(),
    updatedAt: new Date('2026-06-14T08:00:00Z').toISOString()
  },
  {
    id: 'evt_tech_summit',
    name: 'Global Business Summit 2026',
    description: 'Ativação corporativa focada em líderes e executivos do setor de inovação.',
    date: '2026-07-10',
    time: '09:00',
    coverUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&auto=format&fit=crop&q=60',
    status: 'draft',
    category: 'Corporativo',
    frameId: 'frame_corp',
    musicId: 'track_corporate',
    sponsorIds: ['spons_arttech'],
    sponsorsConfig: {
      'spons_arttech': { position: 'bottom_right', order: 1 }
    },
    videoDuration: 5,
    effectPresetId: 'eff_03',
    themeColor: '#3b82f6', // blue
    enableTotemMode: true,
    enableLeadCapture: true,
    requiredLeadFields: {
      name: true,
      phone: false,
      city: false,
      email: true,
      instagram: false,
      company: true
    },
    lgpdConsentText: 'Concordo com os Termos de Uso e Política de Privacidade da Spin 360 para download do conteúdo gravado e compartilhamento empresarial com a equipe do ArtTech Studio.',
    createdAt: new Date('2026-06-15T11:00:00Z').toISOString(),
    updatedAt: new Date('2026-06-15T11:00:00Z').toISOString()
  }
];

// Seeded Video Records
export const SEED_VIDEOS: VideoRecord[] = [
  {
    id: 'vid_01',
    slug: 'e8g4b',
    eventId: 'evt_cyber_night',
    leadId: 'lead_01',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-dancing-with-neon-lights-42289-large.mp4', // beautiful high resolution stock dancing video
    thumbnailUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&auto=format&fit=crop&q=60',
    duration: 10,
    status: 'completed',
    effectAppliedId: 'eff_01',
    frameAppliedId: 'frame_cyber',
    musicAppliedId: 'track_electro',
    viewsCount: 142,
    downloadsCount: 88,
    sharesCount: 41,
    createdAt: new Date('2026-06-18T01:30:00Z').toISOString()
  },
  {
    id: 'vid_02',
    slug: 'j5k2w',
    eventId: 'evt_cyber_night',
    leadId: 'lead_02',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-with-neon-makeup-dancing-31620-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=300&auto=format&fit=crop&q=60',
    duration: 10,
    status: 'completed',
    effectAppliedId: 'eff_01',
    frameAppliedId: 'frame_cyber',
    musicAppliedId: 'track_electro',
    viewsCount: 94,
    downloadsCount: 54,
    sharesCount: 23,
    createdAt: new Date('2026-06-18T02:15:00Z').toISOString()
  },
  {
    id: 'vid_03',
    slug: 'v4n8f',
    eventId: 'evt_junina',
    leadId: 'lead_03',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-countryside-cheerful-party-dancing-40919-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=300&auto=format&fit=crop&q=60',
    duration: 15,
    status: 'completed',
    effectAppliedId: 'eff_02',
    frameAppliedId: 'frame_festa',
    musicAppliedId: 'track_junina',
    viewsCount: 210,
    downloadsCount: 165,
    sharesCount: 98,
    createdAt: new Date('2026-06-18T00:10:00Z').toISOString()
  }
];

export const SEED_LEADS: VideoLead[] = [
  {
    id: 'lead_01',
    eventId: 'evt_cyber_night',
    name: 'Carlos Oliveira',
    phone: '(11) 98765-4321',
    email: 'carlos.oli@gmail.com',
    instagram: '@carlos_oli',
    lgpdConsent: true,
    consentTimestamp: new Date('2026-06-18T01:28:00Z').toISOString()
  },
  {
    id: 'lead_02',
    eventId: 'evt_cyber_night',
    name: 'Mariana Abreu',
    phone: '(21) 99888-2211',
    email: 'mabreu.designer@outlook.com',
    instagram: '@mariabreu.art',
    lgpdConsent: true,
    consentTimestamp: new Date('2026-06-18T02:13:00Z').toISOString()
  },
  {
    id: 'lead_03',
    eventId: 'evt_junina',
    name: 'João Silva Filho',
    phone: '(87) 98122-4455',
    city: 'Petrolina - PE',
    lgpdConsent: true,
    consentTimestamp: new Date('2026-06-18T00:08:00Z').toISOString()
  }
];

export const SEED_SETTINGS: SystemSetting[] = [
  { key: 'system_pwa_name', value: 'Spin 360', description: 'Nome visível do PWA', updatedAt: new Date().toISOString() },
  { key: 'retention_days', value: '30', description: 'Dias para retenção de vídeos gerados antes de expirar do storage', updatedAt: new Date().toISOString() },
  { key: 'default_theme_color', value: '#6366f1', description: 'Cor principal padrão para eventos', updatedAt: new Date().toISOString() },
  { key: 'pwa_version', value: '1.0.0', description: 'Versão do Software', updatedAt: new Date().toISOString() },
  { key: 'max_recording_limit_mb', value: '50', description: 'Tamanho máximo permitido de upload bruto (MB)', updatedAt: new Date().toISOString() }
];

export const SEED_AUDITS: AuditLog[] = [
  { id: 'aud_01', userId: 'usr_admin', userEmail: 'jqcjunior1981@gmail.com', action: 'database_initialized', entityType: 'system', createdAt: new Date('2026-06-18T00:01:00Z').toISOString() },
  { id: 'aud_02', userId: 'usr_admin', userEmail: 'jqcjunior1981@gmail.com', action: 'create_event', entityType: 'event', entityId: 'evt_cyber_night', meta: { name: 'Festival Electric Galaxy' }, createdAt: new Date('2026-06-18T00:05:00Z').toISOString() },
  { id: 'aud_03', userId: 'usr_admin', userEmail: 'jqcjunior1981@gmail.com', action: 'pwa_settings_applied', entityType: 'setting', createdAt: new Date('2026-06-18T00:08:00Z').toISOString() }
];

export const SEED_SYSTEM_LOGS: SystemLog[] = [
  { id: 'logs_01', level: 'info', message: 'Sistema de arquivos local inicializado com 19 tabelas simuladas.', module: 'DATABASE', createdAt: new Date('2026-06-18T00:00:10Z').toISOString() },
  { id: 'logs_02', level: 'info', message: 'Filtro de GPU para renderização de efeitos 2x/0.5x pré-aquecido.', module: 'RENDER_PIPELINE', createdAt: new Date('2026-06-18T00:00:45Z').toISOString() },
  { id: 'logs_03', level: 'warn', message: 'Navegador hospeda iFrame restrito: Câmera física pode requerer fallback simulado.', module: 'CAMERA_SERVICE', createdAt: new Date('2026-06-18T00:01:15Z').toISOString() }
];

// Shares Tracker
export const SEED_SHARES: VideoShare[] = [
  { id: 'shr_01', videoId: 'vid_01', channel: 'whatsapp', createdAt: new Date('2026-06-18T01:35:00Z').toISOString() },
  { id: 'shr_02', videoId: 'vid_01', channel: 'instagram', createdAt: new Date('2026-06-18T01:36:00Z').toISOString() },
  { id: 'shr_03', videoId: 'vid_02', channel: 'link', createdAt: new Date('2026-06-18T02:20:00Z').toISOString() },
  { id: 'shr_04', videoId: 'vid_03', channel: 'whatsapp', createdAt: new Date('2026-06-18T00:41:00Z').toISOString() },
  { id: 'shr_05', videoId: 'vid_03', channel: 'qrcode', createdAt: new Date('2026-06-18T00:43:00Z').toISOString() }
];

// Downloads Tracker
export const SEED_DOWNLOADS: VideoDownload[] = [
  { id: 'dl_01', videoId: 'vid_01', createdAt: new Date('2026-06-18T01:38:00Z').toISOString() },
  { id: 'dl_02', videoId: 'vid_02', createdAt: new Date('2026-06-18T02:22:00Z').toISOString() },
  { id: 'dl_03', videoId: 'vid_03', createdAt: new Date('2026-06-18T00:45:00Z').toISOString() }
];

// Views Tracker
export const SEED_VIEWS: VideoView[] = [
  { id: 'v_01', videoId: 'vid_01', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0...)', createdAt: new Date('2026-06-18T01:32:00Z').toISOString() },
  { id: 'v_02', videoId: 'vid_01', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X...)', createdAt: new Date('2026-06-18T01:34:00Z').toISOString() },
  { id: 'v_03', videoId: 'vid_03', userAgent: 'Mozilla/5.0 (Android 12; Pixel 6...)', createdAt: new Date('2026-06-18T00:15:00Z').toISOString() }
];

// Database Engine Wrapper
export class SpinDb {
  private static init() {
    if (!localStorage.getItem(keyOf('initialized'))) {
      localStorage.setItem(keyOf('sponsors'), JSON.stringify(SEED_SPONSORS));
      localStorage.setItem(keyOf('tracks'), JSON.stringify(SEED_M_TRACKS));
      localStorage.setItem(keyOf('effects'), JSON.stringify(SEED_EFFECTS));
      localStorage.setItem(keyOf('frames'), JSON.stringify(SEED_FRAMES));
      localStorage.setItem(keyOf('events'), JSON.stringify(SEED_EVENTS));
      localStorage.setItem(keyOf('videos'), JSON.stringify(SEED_VIDEOS));
      localStorage.setItem(keyOf('leads'), JSON.stringify(SEED_LEADS));
      localStorage.setItem(keyOf('settings'), JSON.stringify(SEED_SETTINGS));
      localStorage.setItem(keyOf('audits'), JSON.stringify(SEED_AUDITS));
      localStorage.setItem(keyOf('system_logs'), JSON.stringify(SEED_SYSTEM_LOGS));
      localStorage.setItem(keyOf('shares'), JSON.stringify(SEED_SHARES));
      localStorage.setItem(keyOf('downloads'), JSON.stringify(SEED_DOWNLOADS));
      localStorage.setItem(keyOf('views'), JSON.stringify(SEED_VIEWS));
      
      // Default logged in user
      const defaultUser: User = {
        id: 'usr_admin',
        email: 'jqcjunior1981@gmail.com',
        name: 'ArtTech Admin',
        role: 'admin',
        createdAt: new Date('2026-06-18').toISOString()
      };
      localStorage.setItem(keyOf('currentUser'), JSON.stringify(defaultUser));
      localStorage.setItem(keyOf('initialized'), 'true');
    }
  }

  // Generic Getters
  private static get<T>(name: string): T[] {
    this.init();
    const data = localStorage.getItem(keyOf(name));
    return data ? JSON.parse(data) : [];
  }

  // Generic Savers
  private static set<T>(name: string, value: T[]): void {
    localStorage.setItem(keyOf(name), JSON.stringify(value));
  }

  // Reset database helper
  public static resetDatabase() {
    localStorage.removeItem(keyOf('initialized'));
    this.init();
    this.logAudit('usr_admin', 'database_reset', 'system', 'sys', { msg: 'Banco de dados restaurado aos padrões de semente' });
  }

  // Current logged in user properties
  public static getCurrentUser(): User {
    this.init();
    const u = localStorage.getItem(keyOf('currentUser'));
    return u ? JSON.parse(u) : { id: 'usr_admin', email: 'jqcjunior1981@gmail.com', name: 'ArtTech Admin', role: 'admin', createdAt: new Date('2026-06-18').toISOString() };
  }

  public static setCurrentUser(user: User | null): void {
    if (user) {
      localStorage.setItem(keyOf('currentUser'), JSON.stringify(user));
    } else {
      localStorage.removeItem(keyOf('currentUser'));
    }
  }

  // SPONSORS CRUD
  public static getSponsors(): Sponsor[] {
    return this.get<Sponsor>('sponsors');
  }

  public static saveSponsor(sponsor: Sponsor): void {
    const sponsors = this.getSponsors();
    const idx = sponsors.findIndex(s => s.id === sponsor.id);
    if (idx >= 0) {
      sponsors[idx] = sponsor;
      this.logAudit(this.getCurrentUser().id, 'update_sponsor', 'sponsor', sponsor.id, { name: sponsor.name });
    } else {
      sponsors.push(sponsor);
      this.logAudit(this.getCurrentUser().id, 'create_sponsor', 'sponsor', sponsor.id, { name: sponsor.name });
    }
    this.set('sponsors', sponsors);
  }

  public static deleteSponsor(id: string): void {
    const sponsors = this.getSponsors().filter(s => s.id !== id);
    this.set('sponsors', sponsors);
    this.logAudit(this.getCurrentUser().id, 'delete_sponsor', 'sponsor', id);
  }

  // MUSIC TRACKS CRUD
  public static getMusicTracks(): MusicTrack[] {
    return this.get<MusicTrack>('tracks');
  }

  public static saveMusicTrack(track: MusicTrack): void {
    const tracks = this.getMusicTracks();
    const idx = tracks.findIndex(t => t.id === track.id);
    if (idx >= 0) {
      tracks[idx] = track;
      this.logAudit(this.getCurrentUser().id, 'update_track', 'track', track.id, { title: track.title });
    } else {
      tracks.push(track);
      this.logAudit(this.getCurrentUser().id, 'create_track', 'track', track.id, { title: track.title });
    }
    this.set('tracks', tracks);
  }

  public static deleteMusicTrack(id: string): void {
    const tracks = this.getMusicTracks().filter(t => t.id !== id);
    this.set('tracks', tracks);
    this.logAudit(this.getCurrentUser().id, 'delete_track', 'track', id);
  }

  // EFFECTS CRUD
  public static getEffectPresets(): EffectPreset[] {
    return this.get<EffectPreset>('effects');
  }

  public static saveEffectPreset(preset: EffectPreset): void {
    const presets = this.getEffectPresets();
    const idx = presets.findIndex(p => p.id === preset.id);
    if (idx >= 0) {
      presets[idx] = preset;
      this.logAudit(this.getCurrentUser().id, 'update_effect', 'effect', preset.id, { name: preset.name });
    } else {
      presets.push(preset);
      this.logAudit(this.getCurrentUser().id, 'create_effect', 'effect', preset.id, { name: preset.name });
    }
    this.set('effects', presets);
  }

  public static deleteEffectPreset(id: string): void {
    const presets = this.getEffectPresets().filter(p => p.id !== id);
    this.set('effects', presets);
    this.logAudit(this.getCurrentUser().id, 'delete_effect', 'effect', id);
  }

  // FRAMES CRUD
  public static getFrames(): Frame[] {
    return this.get<Frame>('frames');
  }

  public static saveFrame(frame: Frame): void {
    const frames = this.getFrames();
    const idx = frames.findIndex(f => f.id === frame.id);
    if (idx >= 0) {
      frames[idx] = frame;
      this.logAudit(this.getCurrentUser().id, 'update_frame', 'frame', frame.id, { name: frame.name });
    } else {
      frames.push(frame);
      this.logAudit(this.getCurrentUser().id, 'create_frame', 'frame', frame.id, { name: frame.name });
    }
    this.set('frames', frames);
  }

  public static deleteFrame(id: string): void {
    const frames = this.getFrames().filter(f => f.id !== id);
    this.set('frames', frames);
    this.logAudit(this.getCurrentUser().id, 'delete_frame', 'frame', id);
  }

  // EVENTS CRUD
  public static getEvents(): Event[] {
    return this.get<Event>('events');
  }

  public static saveEvent(event: Event): void {
    const events = this.getEvents();
    const idx = events.findIndex(e => e.id === event.id);
    if (idx >= 0) {
      events[idx] = { ...event, updatedAt: new Date().toISOString() };
      this.logAudit(this.getCurrentUser().id, 'update_event', 'event', event.id, { name: event.name, status: event.status });
    } else {
      events.push({ ...event, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      this.logAudit(this.getCurrentUser().id, 'create_event', 'event', event.id, { name: event.name });
    }
    this.set('events', events);
  }

  public static deleteEvent(id: string): void {
    const events = this.getEvents().filter(e => e.id !== id);
    this.set('events', events);
    this.logAudit(this.getCurrentUser().id, 'delete_event', 'event', id);
  }

  // LEADS
  public static getLeads(): VideoLead[] {
    return this.get<VideoLead>('leads');
  }

  public static saveLead(lead: VideoLead): void {
    const leads = this.getLeads();
    leads.push(lead);
    this.set('leads', leads);
    // Silent creation log
    this.logSystem('info', `Lead capturado com sucesso para o evento ${lead.eventId}`, 'DEVICES');
  }

  // VIDEOS CRUD & STATS
  public static getVideos(): VideoRecord[] {
    return this.get<VideoRecord>('videos');
  }

  public static getVideoBySlug(slug: string): VideoRecord | undefined {
    return this.getVideos().find(v => v.slug === slug);
  }

  public static saveVideo(video: VideoRecord): void {
    const videos = this.getVideos();
    const idx = videos.findIndex(v => v.id === video.id);
    if (idx >= 0) {
      videos[idx] = video;
    } else {
      videos.push(video);
    }
    this.set('videos', videos);
  }

  public static deleteVideo(id: string): void {
    const videos = this.getVideos().filter(v => v.id !== id);
    this.set('videos', videos);
    this.logAudit(this.getCurrentUser().id, 'delete_video', 'video', id);
  }

  // Audit Logs Getter & Logger
  public static getAuditLogs(): AuditLog[] {
    return this.get<AuditLog>('audits');
  }

  public static logAudit(userId: string, action: string, entityType: string, entityId?: string, meta?: any): void {
    const user = this.getCurrentUser();
    const audits = this.get<AuditLog>('audits');
    const newLog: AuditLog = {
      id: 'aud_' + Math.floor(Math.random() * 1000000),
      userId: userId || user.id,
      userEmail: user?.email || 'anonymous',
      action,
      entityType,
      entityId,
      meta,
      ipAddress: '127.0.0.1',
      createdAt: new Date().toISOString()
    };
    audits.unshift(newLog); // Put news first
    this.set('audits', audits);
  }

  // System Logs
  public static getSystemLogs(): SystemLog[] {
    return this.get<SystemLog>('system_logs');
  }

  public static logSystem(level: 'info' | 'warn' | 'error', message: string, module: string): void {
    const logs = this.get<SystemLog>('system_logs');
    const newLog: SystemLog = {
      id: 'sys_' + Math.floor(Math.random() * 1000000),
      level,
      message,
      module,
      createdAt: new Date().toISOString()
    };
    logs.unshift(newLog);
    this.set('system_logs', logs);
  }

  // Video Tracker logs
  public static registerView(videoId: string, userAgent?: string): void {
    // Add view tally count
    const videos = this.getVideos();
    const video = videos.find(v => v.id === videoId);
    if (video) {
      video.viewsCount = (video.viewsCount || 0) + 1;
      this.saveVideo(video);
    }

    const views = this.get<VideoView>('views');
    views.push({
      id: 'vw_' + Math.floor(Math.random() * 1000000),
      videoId,
      userAgent: userAgent || 'Client Web Tracker',
      createdAt: new Date().toISOString()
    });
    this.set('views', views);
  }

  public static registerDownload(videoId: string): void {
    const videos = this.getVideos();
    const video = videos.find(v => v.id === videoId);
    if (video) {
      video.downloadsCount = (video.downloadsCount || 0) + 1;
      this.saveVideo(video);
    }

    const dls = this.get<VideoDownload>('downloads');
    dls.push({
      id: 'dl_' + Math.floor(Math.random() * 1000000),
      videoId,
      createdAt: new Date().toISOString()
    });
    this.set('downloads', dls);
    this.logAudit('', 'video_downloaded', 'video', videoId);
  }

  public static registerShare(videoId: string, channel: VideoShare['channel']): void {
    const videos = this.getVideos();
    const video = videos.find(v => v.id === videoId);
    if (video) {
      video.sharesCount = (video.sharesCount || 0) + 1;
      this.saveVideo(video);
    }

    const shares = this.get<VideoShare>('shares');
    shares.push({
      id: 'sh_' + Math.floor(Math.random() * 1000000),
      videoId,
      channel,
      createdAt: new Date().toISOString()
    });
    this.set('shares', shares);
    this.logAudit('', 'video_shared', 'video', videoId, { channel });
  }

  // SETTINGS CRUD
  public static getSettings(): SystemSetting[] {
    return this.get<SystemSetting>('settings');
  }

  public static saveSetting(key: string, value: string): void {
    const settings = this.getSettings();
    const idx = settings.findIndex(s => s.key === key);
    if (idx >= 0) {
      settings[idx].value = value;
      settings[idx].updatedAt = new Date().toISOString();
    } else {
      settings.push({ key, value, updatedAt: new Date().toISOString() });
    }
    this.set('settings', settings);
    this.logAudit(this.getCurrentUser().id, 'update_setting', 'setting', key, { value });
  }
}
