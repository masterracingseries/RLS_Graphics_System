/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { toJpeg } from 'html-to-image';
import { removeBackground } from '@imgly/background-removal';
import { 
  Upload, 
  Download, 
  Trophy, 
  User, 
  Flag, 
  Shield, 
  Hash, 
  Layout,
  RefreshCw,
  Camera,
  ChevronDown,
  Sparkles,
  Link
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

const GITHUB_BASE = 'https://raw.githubusercontent.com/masterracingseries/paginaweb-mrs/main';
const LOGO_PATH = `${GITHUB_BASE}/logos_f1`;
const AUTO_PATH = `${GITHUB_BASE}/autos_f1`;
const FONDOS_PATH = `${GITHUB_BASE}/fondos_f1`;

// ── LOCAL_ASSETS ──────────────────────────────────────────────
// Por defecto, logos/autos/fondos se sirven desde el repo externo
// `paginaweb-mrs` (ver README, sección "Assets externos").
//
// Si no tenés permiso de push ahí, o simplemente preferís no
// depender de un repo aparte, podés alojar un asset puntual DENTRO
// de este proyecto en vez de la ruta de GITHUB_BASE:
//
//   1. Poné el archivo en public/assets/<carpeta>/<archivo>
//      (ej: public/assets/autos_f1/auto_mercedes.avif)
//   2. En F1_TEAMS o F1_CIRCUITS, reemplazá esa entrada puntual por
//      la ruta local: '/assets/autos_f1/auto_mercedes.avif'
//
// Todo lo que viva en public/ se sirve tal cual en la raíz del sitio
// (Vite lo copia a dist/ en el build) y, al ser mismo origen, no
// pasa por /api/proxy-image ni por su caché de 1 año.
// ────────────────────────────────────────────────────────────────

interface Circuit {
  id: string;
  name: string;
  city: string;
  country: string;
  background: string;
}

const F1_CIRCUITS: Circuit[] = [
  { id: 'bahrain',      name: 'Sakhir',          city: 'Sakhir',      country: 'Bahréin',        background: `${FONDOS_PATH}/bahrain.jpg` },
  { id: 'jeddah',      name: 'Jeddah',           city: 'Jeddah',      country: 'Arabia Saudita', background: `${FONDOS_PATH}/jeddah.jpg` },
  { id: 'melbourne',   name: 'Melbourne',        city: 'Melbourne',   country: 'Australia',      background: `${FONDOS_PATH}/melbourne.jpg` },
  { id: 'suzuka',      name: 'Suzuka',           city: 'Suzuka',      country: 'Japón',          background: `${FONDOS_PATH}/suzuka.jpg` },
  { id: 'shanghai',    name: 'Shanghai',         city: 'Shanghai',    country: 'China',          background: `${FONDOS_PATH}/shanghai.jpg` },
  { id: 'miami',       name: 'Miami',            city: 'Miami',       country: 'Estados Unidos', background: `${FONDOS_PATH}/miami.jpg` },
  { id: 'imola',       name: 'Imola',            city: 'Imola',       country: 'Italia',         background: `${FONDOS_PATH}/imola.jpg` },
  { id: 'monaco',      name: 'Mónaco',           city: 'Mónaco',      country: 'Mónaco',         background: `${FONDOS_PATH}/monaco.jpg` },
  { id: 'barcelona',   name: 'Barcelona',        city: 'Barcelona',   country: 'España',         background: `${FONDOS_PATH}/barcelona.jpg` },
  { id: 'montreal',    name: 'Montreal',         city: 'Montreal',    country: 'Canadá',         background: `${FONDOS_PATH}/montreal.jpg` },
  { id: 'spielberg',   name: 'Red Bull Ring',    city: 'Spielberg',   country: 'Austria',        background: `${FONDOS_PATH}/spielberg.jpg` },
  { id: 'silverstone', name: 'Silverstone',      city: 'Silverstone', country: 'Gran Bretaña',   background: `${FONDOS_PATH}/silverstone.jpg` },
  { id: 'spa',         name: 'Spa',              city: 'Spa',         country: 'Bélgica',        background: `${FONDOS_PATH}/spa_fondo.jpg` },
  { id: 'budapest',    name: 'Budapest',         city: 'Budapest',    country: 'Hungría',        background: `${FONDOS_PATH}/budapest.jpg` },
  { id: 'zandvoort',   name: 'Zandvoort',        city: 'Zandvoort',   country: 'Países Bajos',   background: `${FONDOS_PATH}/zandvoort.jpg` },
  { id: 'monza',       name: 'Monza',            city: 'Monza',       country: 'Italia',         background: `${FONDOS_PATH}/monza.jpg` },
  { id: 'baku',        name: 'Baku',             city: 'Bakú',        country: 'Azerbaiyán',     background: `${FONDOS_PATH}/baku.jpg` },
  { id: 'singapore',   name: 'Singapur',         city: 'Singapur',    country: 'Singapur',       background: `${FONDOS_PATH}/singapore.jpg` },
  { id: 'austin',      name: 'Austin (COTA)',    city: 'Austin',      country: 'Estados Unidos', background: `${FONDOS_PATH}/austin.jpg` },
  { id: 'mexico',      name: 'Ciudad de México', city: 'México',      country: 'México',         background: `${FONDOS_PATH}/mexico.jpg` },
  { id: 'saopaulo',    name: 'São Paulo',        city: 'São Paulo',   country: 'Brasil',         background: `${FONDOS_PATH}/saopaulo.jpg` },
  { id: 'lasvegas',    name: 'Las Vegas',        city: 'Las Vegas',   country: 'Estados Unidos', background: `${FONDOS_PATH}/lasvegas.jpg` },
  { id: 'lusail',      name: 'Lusail',           city: 'Lusail',      country: 'Qatar',          background: `${FONDOS_PATH}/lusail.jpg` },
  { id: 'abudhabi',    name: 'Yas Marina',       city: 'Abu Dabi',    country: 'Abu Dabi',       background: `${FONDOS_PATH}/abudhabi.jpg` },
  { id: 'madrid',      name: 'IFEMA Madrid',     city: 'Madrid',      country: 'España',         background: `${FONDOS_PATH}/madrid.jpg` },
];

const getBase64FromUrl = async (url: string): Promise<string> => {
  try {
    if (!url || url.startsWith('data:')) return url || '';

    // Use proxy for all external URLs to ensure CORS is bypassed
    const isExternal = url.startsWith('http') && !url.includes(window.location.host);
    const targetUrl = isExternal 
      ? `/api/proxy-image?url=${encodeURIComponent(url)}` 
      : url;
      
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', url, error);
    return url; // Fallback to original URL
  }
};

const getProxiedUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/')) return url;
  
  // Always proxy GitHub URLs to avoid CORS issues entirely on mobile
  if (url.includes('githubusercontent.com') || url.includes('raw.githubusercontent.com')) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  
  return url;
};

const getExportUrl = (url: string | null) => {
  if (!url) return '';
  return getProxiedUrl(url) || '';
};

// Reduce una imagen (data URL) a un tamaño máximo y la comprime a JPEG/PNG liviano.
// Clave para iOS: el <foreignObject> de WebKit no soporta imágenes muy pesadas,
// así que la foto del piloto (PNG grande tras quitar el fondo) debe achicarse.
const downscaleImage = (dataUrl: string, maxSize = 1200): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      // PNG para conservar la transparencia del fondo recortado
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

// Captura la gráfica a JPEG. Pre-convierte las imágenes externas a blob URLs
// locales para eliminar problemas de CORS en mobile.
const captureGraphicToJpeg = async (element: HTMLDivElement): Promise<string> => {
  const images = Array.from(element.getElementsByTagName('img')) as HTMLImageElement[];
  const blobUrls: string[] = [];
  const originalSrcs = new Map<HTMLImageElement, string>();

  try {
    await Promise.all(images.map(async (img) => {
      const src = img.src;
      if (!src || src.startsWith('blob:') || src.startsWith('data:')) return;
      originalSrcs.set(img, src);

      try {
        const isExternal = src.startsWith('http') && !src.includes(window.location.host);
        const fetchUrl = isExternal ? `/api/proxy-image?url=${encodeURIComponent(src)}` : src;

        const res = await fetch(fetchUrl);
        if (!res.ok) return;

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrls.push(blobUrl);
        img.src = blobUrl;
        try { await img.decode(); } catch (_) {}
      } catch (e) {
        console.warn('No se pudo preparar imagen:', src.slice(0, 80), e);
      }
    }));

    await new Promise(resolve => setTimeout(resolve, 500));

    // Renders de "calentamiento": html-to-image en iOS suele fallar los
    // primeros intentos porque las imágenes embebidas aún no cargaron en el
    // SVG interno. Renderizamos 3 veces y usamos el último resultado.
    const opts = {
      quality: 0.92,
      backgroundColor: '#050505',
      pixelRatio: 2,
      style: { transform: 'none' },
      cacheBust: false,
    };
    let dataUrl = '';
    for (let i = 0; i < 3; i++) {
      dataUrl = await toJpeg(element, opts);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return dataUrl;
  } finally {
    for (const [img, src] of originalSrcs) img.src = src;
    blobUrls.forEach(url => URL.revokeObjectURL(url));
  }
};

const getCrossOrigin = (url: string | null) => {
  if (!url) return undefined;
  // If it's proxied or external, we need anonymous to allow canvas capture
  if (url.includes('/api/proxy-image') || url.startsWith('http')) {
    return "anonymous";
  }
  return undefined;
};
const RLS_LOGO_URL = `${LOGO_PATH}/logo_rls_sinfondo.png`;
const RLS_THEME_COLOR = '#d62f3d';

interface Team {
  id: string;
  name: string;
  logo: string;
  car: string;
  color: string;
  // Factor opcional para agrandar/achicar el auto dentro de su caja.
  // Útil cuando el recorte del asset es más "cuadrado" que el resto
  // (menos ancho relativo) y por eso se ve más chico al hacer object-contain.
  carScale?: number;
}

const F1_TEAMS: Team[] = [
  { 
    id: 'red-bull', 
    name: 'Red Bull Racing', 
    logo: `${LOGO_PATH}/logo_redbull.png`,
    car: `${AUTO_PATH}/auto_redbull.avif`,
    color: '#0600ef' 
  },
  { 
    id: 'ferrari', 
    name: 'Ferrari', 
    logo: `${LOGO_PATH}/logo_ferrari.png`,
    car: `${AUTO_PATH}/auto_ferrari.avif`,
    color: '#ef1a2d' 
  },
  { 
    id: 'mercedes', 
    name: 'Mercedes-AMG', 
    logo: `${LOGO_PATH}/logo_mercedes.png`,
    // Auto 2026 (W17) alojado localmente en /public — ver nota LOCAL_ASSETS abajo
    car: '/assets/autos_f1/auto_mercedes.avif',
    color: '#00a19c',
    // Este asset tiene un recorte más "cuadrado" (menos ancho relativo)
    // que el resto de los autos, así que se ve chico dentro de la caja.
    // Lo agrandamos un poco para compensar. Ajustar si hace falta.
    carScale: 1.15,
  },
  { 
    id: 'mclaren', 
    name: 'McLaren', 
    logo: `${LOGO_PATH}/logo_mclaren.png`,
    car: `${AUTO_PATH}/auto_mclaren.avif`,
    color: '#ff8700' 
  },
  { 
    id: 'aston-martin', 
    name: 'Aston Martin', 
    logo: `${LOGO_PATH}/logo_aston.png`,
    car: `${AUTO_PATH}/auto_astonmartin.avif`,
    color: '#006f62' 
  },
  { 
    id: 'alpine', 
    name: 'Alpine', 
    logo: `${LOGO_PATH}/logo_alpine.png`,
    car: `${AUTO_PATH}/auto_alpine.avif`,
    color: '#0090ff' 
  },
  { 
    id: 'williams', 
    name: 'Williams', 
    logo: `${LOGO_PATH}/logo_williams.png`,
    car: `${AUTO_PATH}/auto_williams.avif`,
    color: '#005aff' 
  },
  {
    id: 'rb',
    name: 'Racing Bulls',
    logo: `${LOGO_PATH}/logo_visacashapp.png`,
    car: `${AUTO_PATH}/auto_racingbull.avif`,
    color: '#6692ff'
  },
  {
    id: 'audi',
    name: 'Audi F1 Team',
    logo: `${LOGO_PATH}/logo_audi.png`,
    car: `${AUTO_PATH}/auto_audi.avif`,
    color: '#bb0a14'
  },
  {
    id: 'cadillac',
    name: 'Cadillac F1 Team',
    logo: `${LOGO_PATH}/logo_cadillac.png`,
    car: `${AUTO_PATH}/auto_cadillac.avif`,
    color: '#cc0000'
  },
  { 
    id: 'haas', 
    name: 'Haas F1 Team', 
    logo: `${LOGO_PATH}/logo_haas.png`,
    car: `${AUTO_PATH}/auto_haas.avif`,
    color: '#ffffff' 
  },
];

type TemplateId = 'protagonista' | 'broadcast' | 'card' | 'esports';

interface PilotData {
  league: string;
  division: string;
  teamId: string;
  circuitId: string;
  qualifying: string;
  race: string;
  realName: string;
  nickname: string;
  instagram: string;
  image: string | null;
  background: string;
  templateId: TemplateId;
}

const INITIAL_DATA: PilotData = {
  league: 'F1 LATAM SERIES',
  division: 'DIVISIÓN 1',
  teamId: 'red-bull',
  circuitId: 'spa',
  qualifying: 'P3',
  race: 'P1',
  realName: 'Nombre Piloto',
  nickname: 'Id Piloto',
  instagram: '',
  image: null,
  background: F1_CIRCUITS.find(c => c.id === 'spa')?.background || `${FONDOS_PATH}/spa_fondo.jpg`,
  templateId: 'protagonista',
};

// ── Helpers compartidos por los templates ──
const BG_FALLBACK = 'https://images.unsplash.com/photo-1533130061792-64b345e4a833?q=80&w=2070&auto=format&fit=crop';

const handleBgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const target = e.target as HTMLImageElement;
  if (target.src !== BG_FALLBACK) target.src = BG_FALLBACK;
};

interface TemplateProps {
  data: PilotData;
  team: Team;
  circuit?: Circuit;
}

// ════════ TEMPLATE 2: BROADCAST (estética TV F1) ════════
function BroadcastTemplate({ data, team, circuit }: TemplateProps) {
  const color = team.color;
  const longName = (data.nickname || 'PILOTO').length > 12;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#08080d' }}>
      {/* Fondo circuito (más visible) */}
      <div className="absolute inset-0 z-0">
        <img
          src={getExportUrl(data.background)} alt="" className="w-full h-full object-cover opacity-55 contrast-110"
          referrerPolicy="no-referrer" crossOrigin={getCrossOrigin(getExportUrl(data.background))} onError={handleBgError}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #08080d 6%, transparent 50%), linear-gradient(to right, rgba(8,8,13,0.8) 0%, transparent 45%, transparent 70%, rgba(8,8,13,0.5) 100%)' }} />
      </div>

      {/* Barra lateral color equipo */}
      <div className="absolute left-0 top-0 bottom-0 w-[8px] z-40" style={{ backgroundColor: color }} />

      {/* Foto piloto centrada y grande */}
      <div className="absolute inset-x-0 top-[7%] bottom-[76px] z-[5] flex items-end justify-center">
        {data.image ? (
          <div className="relative h-full w-[82%] flex items-end justify-center">
            <img src={getExportUrl(data.image)} alt="Pilot" className="h-full w-full object-contain object-bottom"
              referrerPolicy="no-referrer" crossOrigin={getCrossOrigin(getExportUrl(data.image))} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent 78%, #08080d 99%)' }} />
          </div>
        ) : (
          <User className="w-12 h-12 text-white/10 mb-10" />
        )}
      </div>

      {/* Logo RLS grande y protagonista */}
      <img src={getExportUrl(RLS_LOGO_URL)} alt="RLS" className="absolute top-2 right-3 h-20 object-contain z-30 drop-shadow-[0_2px_10px_rgba(0,0,0,1)]"
        referrerPolicy="no-referrer" crossOrigin={getCrossOrigin(getExportUrl(RLS_LOGO_URL))} />

      {/* Etiqueta superior + liga */}
      <div className="absolute top-4 left-5 z-30">
        <div className="text-[11px] tracking-[0.25em] text-white/80 uppercase" style={{ fontFamily: "'Courier New', monospace", textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>Race Result · {circuit?.name || ''}</div>
        <div className="text-[12px] font-black tracking-[0.15em] uppercase mt-1" style={{ color, textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>{data.league}</div>
      </div>

      {/* Auto reducido bajo la liga */}
      <div className="absolute top-[54px] left-4 w-[150px] h-9 z-20 pointer-events-none overflow-visible">
        <img src={getExportUrl(team.car)} alt="" className="w-full h-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
          style={{ transform: `scale(${team.carScale ?? 1})` }}
          referrerPolicy="no-referrer" crossOrigin={getCrossOrigin(getExportUrl(team.car))} />
      </div>

      {/* Torre de tiempos (resultado) a la izquierda */}
      <div className="absolute top-[100px] left-3 z-30 flex flex-col gap-2" style={{ fontFamily: "'Courier New', monospace" }}>
        <div className="px-3 py-1.5" style={{ backgroundColor: 'rgba(8,8,13,0.74)', borderLeft: `3px solid ${color}` }}>
          <div className="text-[10px] tracking-[0.3em] uppercase font-bold" style={{ color }}>Finish</div>
          <div className="text-white font-black leading-[0.85]" style={{ fontSize: '62px' }}>{data.race}</div>
        </div>
        <div className="px-3 py-1 self-start" style={{ backgroundColor: 'rgba(8,8,13,0.62)', borderLeft: '3px solid rgba(255,255,255,0.3)' }}>
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/50">Qualifying</div>
          <div className="text-white font-black leading-none" style={{ fontSize: '26px' }}>{data.qualifying}</div>
        </div>
      </div>

      {/* Barra inferior tipo timing */}
      <div className="absolute bottom-0 left-0 w-full z-30 px-4 py-2.5 pl-5" style={{ backgroundColor: '#101019', borderTop: `2px solid ${color}` }}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className={`text-white font-black italic uppercase tracking-tight leading-none truncate ${longName ? 'text-base' : 'text-xl'}`}>{data.nickname || 'PILOTO'}</div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5 truncate">{data.realName} · {data.division}</div>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/60 flex-shrink-0 text-right">{team.name}</span>
        </div>
        <div className="flex items-center justify-between mt-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="text-[9px] tracking-widest uppercase text-white/30">© Racing Latam Sport</span>
          <span className="text-[10px] font-black italic tracking-wider" style={{ color }}>@racinglatamsport</span>
        </div>
      </div>
    </div>
  );
}

// ════════ TEMPLATE 3: CARD COLECCIONABLE (estilo FUT) ════════
function CardTemplate({ data, team, circuit }: TemplateProps) {
  const color = team.color;
  const textOnColor = color === '#ffffff' ? '#000000' : '#ffffff';
  const longName = (data.nickname || 'PILOTO').length > 13;
  const attrs: [string, string][] = [
    ['Quali', data.qualifying],
    ['Race', data.race],
    ['Pista', circuit?.city || '—'],
    ['Div', data.division.replace(/divisi[oó]n/i, '').trim() || data.division],
  ];
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#0e0e16', border: `3px solid ${color}` }}>
      {/* Fondo circuito tenue + tinte equipo */}
      <div className="absolute inset-0 z-0">
        <img src={getExportUrl(data.background)} alt="" className="w-full h-full object-cover opacity-25 contrast-125"
          referrerPolicy="no-referrer" crossOrigin={getCrossOrigin(getExportUrl(data.background))} onError={handleBgError} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${color}33, transparent 35%, #0e0e16 86%)` }} />
      </div>

      {/* Auto como identidad de equipo, detrás del nombre de la liga */}
      <div className="absolute left-1/2 -translate-x-1/2 w-[98%] h-20 z-[1] opacity-45 pointer-events-none" style={{ top: '65%' }}>
        <img src={getExportUrl(team.car)} alt="" className="w-full h-full object-contain"
          style={{ transform: `scale(${team.carScale ?? 1})` }}
          referrerPolicy="no-referrer" crossOrigin={getCrossOrigin(getExportUrl(team.car))} />
      </div>

      {/* Foto piloto grande protagonista */}
      <div className="absolute inset-x-0 top-[42px] z-[10] flex justify-center" style={{ height: '54%' }}>
        {data.image ? (
          <div className="relative h-full w-[90%] flex items-end justify-center">
            <img src={getExportUrl(data.image)} alt="Pilot" className="h-full w-full object-contain object-bottom"
              referrerPolicy="no-referrer" crossOrigin={getCrossOrigin(getExportUrl(data.image))} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent 76%, #0e0e16 99%)' }} />
          </div>
        ) : (
          <div className="h-full flex items-center"><User className="w-12 h-12 text-white/10" /></div>
        )}
      </div>

      {/* Resultado tipo rating (arriba izquierda) */}
      <div className="absolute top-3 left-4 z-30 text-center leading-none">
        <div className="text-white font-black italic" style={{ fontSize: '50px', lineHeight: 0.85, textShadow: '0 2px 12px rgba(0,0,0,0.95)' }}>{data.race}</div>
        <div className="text-[11px] font-black tracking-[0.2em] uppercase mt-0.5" style={{ color }}>Pos</div>
      </div>

      {/* Logo RLS grande (arriba derecha) */}
      <img src={getExportUrl(RLS_LOGO_URL)} alt="RLS" className="absolute top-3 right-4 h-[68px] object-contain z-30 drop-shadow-[0_2px_10px_rgba(0,0,0,1)]"
        referrerPolicy="no-referrer" crossOrigin={getCrossOrigin(getExportUrl(RLS_LOGO_URL))} />

      {/* Título RACE RESULT */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none transform -skew-x-12 px-3 py-0.5" style={{ backgroundColor: color }}>
        <span className="block transform skew-x-12 text-[11px] font-black uppercase tracking-[0.2em] italic whitespace-nowrap" style={{ color: textOnColor }}>Race Result</span>
      </div>

      {/* Banner nickname + liga destacada */}
      <div className="absolute left-0 w-full z-20" style={{ top: '57%' }}>
        <div className="w-full py-1.5 text-center" style={{ backgroundColor: color, transform: 'skewY(-3deg)' }}>
          <div className="inline-block" style={{ transform: 'skewY(3deg)' }}>
            <span className={`font-black italic uppercase tracking-tight ${longName ? 'text-lg' : 'text-2xl'}`} style={{ color: textOnColor }}>{data.nickname || 'PILOTO'}</span>
          </div>
        </div>
        <div className="text-center text-[10px] text-white/50 uppercase tracking-[0.2em] mt-1.5">{data.realName}</div>
        <div className="text-center text-[13px] font-black uppercase tracking-[0.15em] mt-0.5 text-white">{data.league}</div>
      </div>

      {/* Atributos */}
      <div className="absolute bottom-7 left-4 right-4 z-20 grid grid-cols-2 gap-x-5 gap-y-1.5">
        {attrs.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="text-[11px] uppercase tracking-widest text-white/45">{label}</span>
            <span className="text-[11px] font-black uppercase text-white truncate ml-2">{value}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="absolute bottom-2 left-0 w-full flex items-center justify-center z-20">
        <span className="text-[10px] font-black italic tracking-wider" style={{ color }}>@racinglatamsport</span>
      </div>
    </div>
  );
}

// ════════ TEMPLATE 4: ESPORTS (RACE RESULT + auto protagonista abajo) ════════
function EsportsTemplate({ data, team, circuit }: TemplateProps) {
  const color = team.color;
  const longName = (data.nickname || 'PILOTO').length > 13;
  const stats: [string, string][] = [
    ['Qualy', data.qualifying],
    ['Circuito', circuit?.city || '—'],
    ['Carrera', data.race],
    ['Division', data.division.replace(/divisi[oó]n/i, '').trim() || data.division],
  ];
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#05070a' }}>
      {/* Fondo circuito */}
      <div className="absolute inset-0 z-0">
        <img src={getExportUrl(data.background)} alt="" className="w-full h-full object-cover"
          referrerPolicy="no-referrer" crossOrigin={getCrossOrigin(getExportUrl(data.background))} onError={handleBgError} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(4,6,10,0.6) 0%, rgba(4,6,10,0.2) 28%, rgba(5,7,10,0.65) 52%, #05070a 78%)' }} />
        {/* Tinte de color del equipo, look esports profesional */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 0%, ${color}14 55%, ${color}22 100%)` }} />
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 100%, ${color}33 0%, transparent 60%)` }} />
      </div>

      {/* Etiqueta RACE RESULT (arriba izquierda) */}
      <div className="absolute top-[18px] left-4 z-30 transform -skew-x-12 px-4 py-1" style={{ backgroundColor: color, boxShadow: `0 2px 14px ${color}66` }}>
        <span className="block transform skew-x-12 text-[12px] font-black uppercase tracking-[0.25em] italic whitespace-nowrap" style={{ color: color === '#ffffff' ? '#000' : '#fff' }}>Resultado Carrera</span>
      </div>

      {/* P1 grande */}
      <div className="absolute top-[42px] left-4 z-30 leading-none">
        <div className="text-white font-black italic" style={{ fontSize: '78px', lineHeight: 0.85, textShadow: '0 4px 18px rgba(0,0,0,0.9)' }}>{data.race}</div>
        <div className="text-[12px] font-bold uppercase tracking-[0.35em] mt-0.5" style={{ color }}>Posición</div>
      </div>

      {/* Logo RLS + marca (arriba derecha) */}
      <div className="absolute top-[18px] right-4 z-30 flex flex-col items-center">
        <img src={getExportUrl(RLS_LOGO_URL)} alt="RLS" className="h-16 object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,1)]"
          referrerPolicy="no-referrer" crossOrigin={getCrossOrigin(getExportUrl(RLS_LOGO_URL))} />
        <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-white/70 -mt-1 whitespace-nowrap">Racing Latam Esport</span>
      </div>

      {/* Foto piloto */}
      <div className="absolute inset-x-0 top-[58px] z-[5] flex justify-center" style={{ height: '42%' }}>
        {data.image ? (
          <div className="relative h-full w-[90%] flex items-end justify-center">
            <img src={getExportUrl(data.image)} alt="Pilot" className="h-full w-full object-contain object-bottom"
              referrerPolicy="no-referrer" crossOrigin={getCrossOrigin(getExportUrl(data.image))} />
          </div>
        ) : (
          <div className="h-full flex items-end pb-6"><User className="w-14 h-14 text-white/10" /></div>
        )}
      </div>

      {/* Banner nickname con cortes diagonales */}
      <div className="absolute left-0 w-full z-20 px-3" style={{ top: '50%' }}>
        <div className="relative flex items-center">
          <div className="w-4 h-6 flex-shrink-0" style={{ backgroundColor: color, transform: 'skewX(-20deg)', marginRight: '-6px' }} />
          <div className="flex-1 py-1 px-3 text-center" style={{ backgroundColor: 'rgba(6,10,14,0.9)', borderTop: `1px solid ${color}88`, borderBottom: `2px solid ${color}` }}>
            <div className={`text-white font-black italic uppercase tracking-tight leading-none ${longName ? 'text-base' : 'text-lg'}`}>{data.nickname || 'PILOTO'}</div>
            <div className="text-[9px] text-white/50 uppercase tracking-[0.25em] mt-0.5">{data.realName}</div>
          </div>
          <div className="w-4 h-6 flex-shrink-0" style={{ backgroundColor: color, transform: 'skewX(-20deg)', marginLeft: '-6px' }} />
        </div>
        <div className="text-center text-[9px] font-bold uppercase tracking-[0.3em] text-white/70 mt-0.5">{data.league}</div>
      </div>

      {/* Resplandor + reflejo de piso detrás del auto */}
      <div className="absolute left-1/2 -translate-x-1/2 w-[92%] h-[100px] z-[8] pointer-events-none rounded-full"
        style={{ top: '58%', background: `radial-gradient(ellipse at center, ${color}55 0%, transparent 70%)`, filter: 'blur(10px)' }} />
      <div className="absolute left-1/2 -translate-x-1/2 w-[80%] h-[18px] z-[9] pointer-events-none rounded-full"
        style={{ top: '85.5%', background: `radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, transparent 75%)`, filter: 'blur(3px)' }} />

      {/* Auto protagonista, grande y nítido */}
      <div className="absolute left-1/2 -translate-x-1/2 w-[100%] h-[152px] z-[15] pointer-events-none" style={{ top: '57.5%' }}>
        <img src={getExportUrl(team.car)} alt="" className="w-full h-full object-contain"
          style={{ filter: 'contrast(1.2) saturate(1.3) brightness(1.1) drop-shadow(0 16px 18px rgba(0,0,0,0.8))' }}
          referrerPolicy="no-referrer" crossOrigin={getCrossOrigin(getExportUrl(team.car))} />
      </div>

      {/* Barra de estadísticas */}
      <div className="absolute left-3 right-3 z-20 flex items-stretch justify-between rounded-xl px-2 py-2.5 overflow-hidden" style={{ bottom: '14px', background: 'linear-gradient(180deg, rgba(10,14,20,0.92) 0%, rgba(4,6,10,0.94) 100%)', border: `1px solid ${color}55`, boxShadow: `0 -2px 0 0 ${color} inset, 0 8px 24px rgba(0,0,0,0.5)` }}>
        {stats.map(([label, value], i) => (
          <div key={label} className="flex-1 flex flex-col items-center justify-center px-1" style={{ borderLeft: i > 0 ? `1px solid ${color}33` : 'none' }}>
            <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-white/45">{label}</span>
            <span className="font-black uppercase leading-none mt-1" style={{ fontSize: value.length > 3 ? '13px' : '18px', color: '#fff', textShadow: `0 0 14px ${color}aa` }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AppProps {
  onSwitchToAdmin?: () => void;
  onLogout?: () => void;
}

export default function App({ onSwitchToAdmin, onLogout }: AppProps = {}) {
  const [data, setData] = useState<PilotData>(INITIAL_DATA);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [caption, setCaption] = useState('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [nicknameScale, setNicknameScale] = useState(1);

  useEffect(() => {
    if (downloadError) {
      const timer = setTimeout(() => setDownloadError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [downloadError]);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
  const [logoError, setLogoError] = useState(false);
  const [carError, setCarError] = useState(false);
  
  const graphicRef = useRef<HTMLDivElement>(null);
  const nicknameRef = useRef<HTMLHeadingElement>(null);
  const nicknameContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update window width on resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    
    // Force background update to new GitHub URL if it's still the old one
    if (!data.background.includes('spa_fondo.jpg')) {
      setData(prev => ({ ...prev, background: INITIAL_DATA.background }));
    }
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'circuitId') {
      const circuit = F1_CIRCUITS.find(c => c.id === value);
      setData(prev => ({ ...prev, circuitId: value, background: circuit?.background || prev.background }));
    } else {
      setData(prev => ({ ...prev, [name]: value }));
    }
    if (name === 'teamId') {
      setLogoError(false);
      setCarError(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRemovingBg(true);

    const readAsDataUrl = (b: Blob): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(b);
    });

    try {
      let dataUrl: string;
      try {
        const blob = await removeBackground(file);
        dataUrl = await readAsDataUrl(blob);
      } catch (err) {
        console.error('Error removing background:', err);
        dataUrl = await readAsDataUrl(file);
      }
      // Achicar la foto para que iOS pueda renderizarla en la captura
      const optimized = await downscaleImage(dataUrl, 1200);
      setData(prev => ({ ...prev, image: optimized }));
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'rls' | 'team') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'rls') {
          setData(prev => ({ ...prev, rlsLogo: reader.result as string }));
        } else {
          setData(prev => ({ ...prev, customTeamLogo: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const isMobile = windowWidth < 768;

  const fetchCaption = useCallback(async () => {
    setIsGeneratingCaption(true);
    setCaption('');
    try {
      const selectedTeamData = F1_TEAMS.find(t => t.id === data.teamId) || F1_TEAMS[0];
      const selectedCircuit = F1_CIRCUITS.find(c => c.id === data.circuitId);
      // Si un campo quedó en su valor por defecto, lo mandamos vacío para que
      // Gemini no use placeholders como "Nombre Piloto" / "Id Piloto" en el texto.
      const clean = (val: string, def: string) => (val.trim() === def ? '' : val.trim());
      const res = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('rls_token') || ''}`,
        },
        body: JSON.stringify({
          pilotData: {
            realName: clean(data.realName, INITIAL_DATA.realName),
            nickname: clean(data.nickname, INITIAL_DATA.nickname),
            instagram: data.instagram,
            league: data.league,
            division: data.division,
            teamName: selectedTeamData.name,
            circuitName: selectedCircuit ? `${selectedCircuit.name}, ${selectedCircuit.country}` : 'N/A',
            qualifying: data.qualifying,
            race: data.race,
          }
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setCaption(json.caption || '');
      }
    } catch {
      setCaption('');
    } finally {
      setIsGeneratingCaption(false);
    }
  }, [data]);

  // PASO 1: generar la imagen y mostrarla en la vista previa para que el
  // piloto valide antes de enviar.
  const generatePreview = useCallback(async () => {
    if (!graphicRef.current) return;
    setIsGenerating(true);
    setDownloadError(null);
    try {
      const dataUrl = await captureGraphicToJpeg(graphicRef.current);
      if (!dataUrl || dataUrl === 'data:,') throw new Error('No se pudo generar la imagen');
      setGeneratedImageUrl(dataUrl);
      setShowPreviewModal(true);
      fetchCaption();
    } catch (err: any) {
      setDownloadError(`Error al generar: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsGenerating(false);
    }
  }, [fetchCaption]);

  // PASO 2a: enviar la imagen YA generada (la que el piloto está viendo).
  const submitGeneratedImage = useCallback(async () => {
    if (!generatedImageUrl) return;
    setIsSubmitting(true);
    setDownloadError(null);
    try {
      const selectedTeamData = F1_TEAMS.find(t => t.id === data.teamId) || F1_TEAMS[0];
      const selectedCircuit = F1_CIRCUITS.find(c => c.id === data.circuitId);

      const response = await fetch('/api/submit-graphic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('rls_token') || ''}`,
        },
        body: JSON.stringify({
          imageBase64: generatedImageUrl,
          caption,
          pilotData: {
            realName: data.realName,
            nickname: data.nickname,
            instagram: data.instagram,
            league: data.league,
            division: data.division,
            teamName: selectedTeamData.name,
            circuitName: selectedCircuit ? `${selectedCircuit.name}, ${selectedCircuit.country}` : 'N/A',
            qualifying: data.qualifying,
            race: data.race,
            template: data.templateId,
          }
        })
      });

      if (!response.ok) throw new Error('Error al enviar al servidor');
      setShowPreviewModal(false);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 6000);
    } catch (err: any) {
      setDownloadError(`Error al enviar: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [generatedImageUrl, data, caption]);

  // PASO 2b: descargar la imagen ya generada.
  const downloadGeneratedImage = useCallback(() => {
    if (!generatedImageUrl) return;
    const link = document.createElement('a');
    link.href = generatedImageUrl;
    link.download = `RLS-Result-${data.nickname || 'Pilot'}.jpg`;
    link.click();
  }, [generatedImageUrl, data.nickname]);

  const triggerImageUpload = () => fileInputRef.current?.click();

  // Auto-scaling nickname logic
  useLayoutEffect(() => {
    if (nicknameRef.current && nicknameContainerRef.current) {
      const containerWidth = nicknameContainerRef.current.offsetWidth;
      const textWidth = nicknameRef.current.scrollWidth;
      
      if (textWidth > containerWidth) {
        // More aggressive scaling to ensure it stays within margins
        setNicknameScale((containerWidth - 10) / textWidth);
      } else {
        setNicknameScale(1);
      }
    }
  }, [data.nickname]);

  const selectedTeam = F1_TEAMS.find(t => t.id === data.teamId) || F1_TEAMS[0];
  const selectedCircuit = F1_CIRCUITS.find(c => c.id === data.circuitId);
  
  // Logic to determine which logos to use
  const activeRlsLogo = RLS_LOGO_URL;
  const activeTeamLogo = selectedTeam.logo;
  const activeCarImage = selectedTeam.car;
  const activeCarScale = selectedTeam.carScale ?? 1;

  // Calculate preview scale for mobile - Maximized for full view
  const previewScale = windowWidth < 1024 
    ? Math.min(1.2, (windowWidth - 24) / 360) 
    : 1;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-600 selection:text-white pb-20">
      {/* Admin / Logout buttons */}
      {(onSwitchToAdmin || onLogout) && (
        <div className="fixed top-3 right-3 z-50 flex gap-2">
          {onSwitchToAdmin && (
            <button
              onClick={onSwitchToAdmin}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
            >
              Panel Admin
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
            >
              Salir
            </button>
          )}
        </div>
      )}

      {/* Success Toast */}
      <AnimatePresence>
        {submitSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-4 left-4 sm:left-auto sm:w-80 bg-green-600 text-white px-4 py-3 rounded-xl text-xs font-bold shadow-2xl z-[100] border border-white/20"
          >
            ✅ Gráfica enviada para aprobación. ¡Listo!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {downloadError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-4 left-4 sm:left-auto sm:w-80 bg-red-600 text-white px-4 py-3 rounded-xl text-xs font-bold shadow-2xl z-[100] border border-white/20 flex items-center justify-between"
          >
            <span>{downloadError}</span>
            <button onClick={() => setDownloadError(null)} className="ml-2 p-1 hover:bg-white/10 rounded">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 py-6 lg:py-20 flex flex-col items-center gap-12">
        {/* 1. Preview Section - Always at the top */}
        <section className="w-full flex flex-col items-center gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-600 flex items-center justify-center rounded-sm transform -skew-x-12 mx-auto mb-4 shadow-lg shadow-red-600/20">
              <span className="font-black italic text-2xl tracking-tighter">RLS</span>
            </div>
            <h3 className="text-sm font-black uppercase tracking-[0.4em] text-white/40 italic">Vista Previa</h3>
            <span className="text-[10px] text-white/20 font-mono mt-1">v1.7.0</span>
          </div>
          
          {/* Responsive Scaling Wrapper */}
          <div 
            className="w-full flex justify-center overflow-hidden"
            style={{ height: windowWidth < 1024 ? `${450 * previewScale}px` : 'auto' }}
          >
            <div 
              className="origin-top transition-transform duration-300"
              style={{ transform: `scale(${previewScale})` }}
            >
              {/* The Actual Graphic to Export */}
              <div 
                ref={graphicRef}
                id="graphic-container"
                className="relative w-[360px] h-[450px] bg-[#050505] overflow-hidden shadow-2xl shadow-red-600/40 border border-white/10 flex-shrink-0"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {data.templateId === 'protagonista' && (
                <>
                {/* Background Image - User Provided F1 Wallpaper */}
                <div className="absolute inset-0 z-0">
                  <img
                    src={getExportUrl(data.background)}
                    alt="F1 Wallpaper"
                    className="w-full h-full object-cover opacity-90 contrast-125"
                    referrerPolicy="no-referrer"
                    crossOrigin={getCrossOrigin(getExportUrl(data.background))}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const fallback = 'https://images.unsplash.com/photo-1533130061792-64b345e4a833?q=80&w=2070&auto=format&fit=crop';
                      if (target.src !== fallback) {
                        target.src = fallback;
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black" />
                  <div className="absolute inset-0 bg-red-900/5 mix-blend-overlay" />
                </div>
                
                {/* Lighting Effects */}
                <div className="absolute inset-0 pointer-events-none z-1">
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-red-600/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent" />
                </div>

                {/* Header Content */}
                <div className="absolute -top-1 left-0 w-full flex flex-col items-center z-30 pointer-events-none">
                  <img
                    src={getExportUrl(activeRlsLogo)}
                    className="h-16 object-contain drop-shadow-[0_5px_20px_rgba(0,0,0,1)] -mb-1"
                    alt="RLS"
                    referrerPolicy="no-referrer"
                    crossOrigin={getCrossOrigin(getExportUrl(activeRlsLogo))}
                  />
                  <div className="bg-red-600 px-5 py-0.5 transform -skew-x-12 shadow-lg shadow-red-600/20">
                    <span className="text-base font-black tracking-[0.3em] text-white uppercase block italic">Race Result</span>
                  </div>
                </div>

                {/* F1 Car Display - Background Style (Protagonist is the Pilot) */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[88%] h-24 z-5 pointer-events-none opacity-75">
                  <img 
                    src={getExportUrl(activeCarImage)} 
                    alt="F1 Car Background" 
                    className="w-full h-full object-contain filter blur-[1.5px]"
                    style={{ transform: `scale(${activeCarScale})` }}
                    referrerPolicy="no-referrer"
                    crossOrigin={getCrossOrigin(getExportUrl(activeCarImage))}
                    onError={() => setCarError(true)}
                  />
                </div>

                {/* Pilot Image Area - The Protagonist */}
                <div className="absolute inset-0 flex items-start justify-center z-10 pt-12">
                  {data.image ? (
                    <div className="relative w-full h-[72%] flex items-center justify-center overflow-hidden">
                      <img
                        src={getExportUrl(data.image)}
                        alt="Pilot"
                        className="w-full h-full object-contain object-center"
                        referrerPolicy="no-referrer"
                        crossOrigin={getCrossOrigin(getExportUrl(data.image))}
                      />
                    </div>
                  ) : (
                    <div className="mt-24 w-36 h-36 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                      <User className="w-10 h-10 text-white/10" />
                    </div>
                  )}
                </div>

                {/* Viñeteado y fundido del piloto, a nivel de la gráfica (inset-0).
                    Antes vivían dentro del contenedor de la foto, que va de 10.9%
                    a 74.9%: sus bordes dejaban dos cortes duros, uno justo sobre
                    el banner Race Result y otro sobre las stats. Al ocupar toda
                    la altura no tienen borde donde cortarse. */}
                {data.image && (
                  <>
                    <div
                      className="absolute inset-0 z-[14] pointer-events-none"
                      style={{ background: 'linear-gradient(to right, #050505 0%, transparent 18%, transparent 82%, #050505 100%)' }}
                    />
                    <div
                      className="absolute inset-0 z-[15] pointer-events-none"
                      style={{ background: 'linear-gradient(to bottom, transparent 30%, #050505 65%, #050505 80%, rgba(5,5,5,0.75) 100%)' }}
                    />
                  </>
                )}

                {/* Bottom Content Area */}
                <div className="absolute bottom-0 left-0 w-full p-5 z-20 space-y-3">
                  {/* Name Section */}
                  <div className="space-y-1">
                    <div ref={nicknameContainerRef} className="flex items-center gap-2 overflow-hidden h-8">
                      <div className="w-1 h-5 bg-red-600 flex-shrink-0" />
                      <h2
                        ref={nicknameRef}
                        style={{
                          transform: `scale(${nicknameScale})`,
                          transformOrigin: 'left center',
                          whiteSpace: 'nowrap'
                        }}
                        className="text-3xl font-black italic uppercase tracking-tighter leading-none transition-transform duration-300"
                      >
                        {data.nickname || 'PILOTO'}
                      </h2>
                    </div>
                    <div className="flex flex-col ml-3 gap-0.5">
                      <p className="text-xs font-medium text-white/50 uppercase tracking-widest">
                        {data.realName}
                      </p>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-black text-red-600 uppercase tracking-[0.2em] drop-shadow-sm">{data.league}</span>
                          <span className="text-[9px] font-medium text-white/20">•</span>
                          <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{selectedCircuit?.name || ''}</span>
                          <span className="text-[9px] font-medium text-white/20">•</span>
                          <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">{data.division}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <img
                            src={getExportUrl(activeTeamLogo)}
                            alt={selectedTeam.name}
                            className="h-3 object-contain opacity-80"
                            referrerPolicy="no-referrer" 
                            crossOrigin={getCrossOrigin(getExportUrl(activeTeamLogo))}
                          />
                          <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{selectedTeam.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/15 backdrop-blur-md border-l-2 border-red-600 p-2">
                      <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest block mb-0.5">Qualifying</span>
                      <span className="text-xl font-black italic tracking-tighter text-white">{data.qualifying}</span>
                    </div>
                    <div className="bg-red-600 p-2">
                      <span className="text-[8px] font-bold text-white/80 uppercase tracking-widest block mb-0.5">Race Result</span>
                      <span className="text-xl font-black italic tracking-tighter text-white">{data.race}</span>
                    </div>
                  </div>

                  {/* Footer Info */}
                  <div className="flex justify-between items-end pt-2 border-t border-white/10">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedTeam.color }} />
                        <span className="text-[8px] font-bold uppercase tracking-widest text-white/40">© Racing Latam Sport • All Rights Reserved</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 bg-white/10 rounded-full flex items-center justify-center">
                            <span className="text-[8px] font-bold">ig</span>
                          </div>
                          <span className="text-[10px] font-black tracking-wider text-red-500 italic">@racinglatamsport</span>
                        </div>
                        {data.instagram && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 bg-white/10 rounded-full flex items-center justify-center">
                              <span className="text-[8px] font-bold">ig</span>
                            </div>
                            <span className="text-[10px] font-black tracking-wider text-white/60 italic">{data.instagram.startsWith('@') ? data.instagram : `@${data.instagram}`}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-1 h-1 bg-red-600 rounded-full" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-1/2 -left-4 w-8 h-32 bg-red-600/10 blur-xl rounded-full transform -translate-y-1/2" />
                <div className="absolute bottom-20 -right-4 w-12 h-36 bg-red-600/5 blur-2xl rounded-full" />
                </>
                )}

                {data.templateId === 'broadcast' && (
                  <BroadcastTemplate data={data} team={selectedTeam} circuit={selectedCircuit} />
                )}
                {data.templateId === 'card' && (
                  <CardTemplate data={data} team={selectedTeam} circuit={selectedCircuit} />
                )}
                {data.templateId === 'esports' && (
                  <EsportsTemplate data={data} team={selectedTeam} circuit={selectedCircuit} />
                )}
              </div>
            </div>
          </div>

          {/* Template Selector */}
          <div className="w-full max-w-[360px]">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 text-center mb-3">Elegí tu estilo</p>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { id: 'protagonista', label: 'Protagonista', icon: User },
                { id: 'broadcast', label: 'Broadcast', icon: Layout },
                { id: 'card', label: 'Card', icon: Trophy },
                { id: 'esports', label: 'Esports', icon: Flag },
              ] as { id: TemplateId; label: string; icon: any }[]).map(t => {
                const active = data.templateId === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setData(prev => ({ ...prev, templateId: t.id }))}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border transition-all ${active ? 'bg-red-600/20 border-red-600 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[9px] font-black uppercase tracking-widest">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full max-w-[360px] flex flex-col gap-4">
            <button
              onClick={generatePreview}
              disabled={isGenerating || isRemovingBg || isSubmitting}
              className="w-full bg-red-600 text-white py-5 rounded-2xl font-black text-base uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl shadow-red-600/40 active:scale-95 transition-all disabled:opacity-50"
            >
              {isGenerating ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
              {isGenerating ? 'GENERANDO...' : 'GENERAR GRÁFICA'}
            </button>

            <button
              onClick={() => {
                const el = document.getElementById('edit-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
            >
              <Layout className="w-5 h-5" /> Configurar Datos
            </button>
          </div>
        </section>

        {/* 2. Controls Section */}
        <section id="edit-section" className="w-full max-w-2xl mx-auto space-y-8">
          <div className="bg-white/5 rounded-[2.5rem] p-8 sm:p-12 border border-white/10 space-y-10 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-600 flex items-center justify-center rounded-sm transform -skew-x-12 shadow-lg shadow-red-600/20">
                <span className="font-black italic text-2xl tracking-tighter">RLS</span>
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight italic">Panel de Edición</h2>
                <p className="text-[10px] text-red-500 uppercase tracking-[0.3em] font-black">Personaliza cada detalle</p>
              </div>
            </div>

            {/* Image Upload Area */}
            <div 
              onClick={triggerImageUpload}
              className="relative group cursor-pointer aspect-video rounded-3xl border-2 border-dashed border-white/20 hover:border-red-500/50 transition-all overflow-hidden bg-black/40 flex flex-col items-center justify-center gap-4"
            >
              {isRemovingBg ? (
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="w-10 h-10 text-red-500 animate-spin" />
                  <p className="text-sm font-black uppercase tracking-widest animate-pulse">Eliminando fondo con IA...</p>
                </div>
              ) : data.image ? (
                <>
                  <img src={data.image} alt="Preview" className="absolute inset-0 w-full h-full object-contain p-6 group-hover:opacity-40 transition-opacity" />
                  <div className="relative z-10 flex flex-col items-center bg-black/60 px-6 py-3 rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                    <Camera className="w-6 h-6 text-white mb-1" />
                    <span className="text-xs font-black uppercase tracking-widest">Cambiar Foto del Piloto</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-2 group-hover:bg-red-600/10 transition-colors">
                    <Upload className="w-8 h-8 text-white/30 group-hover:text-red-500 transition-colors" />
                  </div>
                  <div className="text-center px-6">
                    <p className="text-base font-black uppercase tracking-widest">Subir foto del piloto</p>
                    <p className="text-[10px] text-white/40 mt-2 flex items-center justify-center gap-2 bg-white/5 px-4 py-1.5 rounded-full">
                      <Sparkles className="w-3 h-3 text-red-500" /> IA: Eliminación de fondo automática
                    </p>
                    <p className="text-[10px] text-white/30 mt-3 leading-relaxed max-w-[220px] mx-auto">
                      Foto de medio cuerpo, centrada y con el fondo lo más neutro posible (igual se elimina automáticamente).
                    </p>
                  </div>
                </>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                className="hidden" 
                accept="image/*" 
              />
            </div>

            {/* Form Fields */}
            <div className="grid sm:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2 ml-1">
                  <Flag className="w-3.5 h-3.5 text-red-500" /> Liga / Torneo
                </label>
                <input
                  type="text"
                  name="league"
                  value={data.league}
                  onChange={handleInputChange}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-600/10 transition-all"
                  placeholder="Ej: F1 LATAM SERIES"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2 ml-1">
                  <Layout className="w-3.5 h-3.5 text-red-500" /> División
                </label>
                <input
                  type="text"
                  name="division"
                  value={data.division}
                  onChange={handleInputChange}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-600/10 transition-all"
                  placeholder="Ej: DIVISIÓN 1"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2 ml-1">
                  <Shield className="w-3.5 h-3.5 text-red-500" /> Escudería
                </label>
                <div className="relative">
                  <select
                    name="teamId"
                    value={data.teamId}
                    onChange={handleInputChange}
                    className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-600/10 transition-all appearance-none cursor-pointer"
                  >
                    {F1_TEAMS.map(team => (
                      <option key={team.id} value={team.id} className="bg-[#1a1a1a]">
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2 ml-1">
                  <Flag className="w-3.5 h-3.5 text-red-500" /> Circuito
                </label>
                <div className="relative">
                  <select
                    name="circuitId"
                    value={data.circuitId}
                    onChange={handleInputChange}
                    className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-600/10 transition-all appearance-none cursor-pointer"
                  >
                    {F1_CIRCUITS.map(circuit => (
                      <option key={circuit.id} value={circuit.id} className="bg-[#1a1a1a]">
                        {circuit.name} · {circuit.country}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2 ml-1">
                  <Hash className="w-3.5 h-3.5 text-red-500" /> Clasificación
                </label>
                <input
                  type="text"
                  name="qualifying"
                  value={data.qualifying}
                  onChange={handleInputChange}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-600/10 transition-all"
                  placeholder="Ej: P3"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2 ml-1">
                  <Trophy className="w-3.5 h-3.5 text-red-500" /> Carrera
                </label>
                <input
                  type="text"
                  name="race"
                  value={data.race}
                  onChange={handleInputChange}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-600/10 transition-all"
                  placeholder="Ej: P1"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2 ml-1">
                  <User className="w-3.5 h-3.5 text-red-500" /> Nombre Piloto
                </label>
                <input
                  type="text"
                  name="realName"
                  value={data.realName}
                  onChange={handleInputChange}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-600/10 transition-all"
                  placeholder="Ej: Nombre Piloto"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2 ml-1">
                  <User className="w-3.5 h-3.5 text-red-500" /> Id Piloto
                </label>
                <input
                  type="text"
                  name="nickname"
                  value={data.nickname}
                  onChange={handleInputChange}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-600/10 transition-all"
                  placeholder="Ej: RLS_IRONHUNTER"
                />
              </div>

              <div className="space-y-3 sm:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2 ml-1">
                  <Link className="w-3.5 h-3.5 text-red-500" /> @ Instagram
                </label>
                <input
                  type="text"
                  name="instagram"
                  value={data.instagram}
                  onChange={handleInputChange}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-600/10 transition-all"
                  placeholder="Ej: @ironhunter_rls"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-white/20 mt-6 pt-8 border-t border-white/5">
              <Shield className="w-4 h-4 text-red-500/40" />
              <span className="font-medium uppercase tracking-widest leading-relaxed">
                Seguridad: Tus fotos se procesan localmente en tu navegador mediante IA y no se guardan en ningún servidor externo.
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Loading Overlay */}
      <AnimatePresence>
        {(isGenerating || isRemovingBg) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative mb-8">
              <div className="w-24 h-24 border-4 border-red-600/20 border-t-red-600 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <img src={RLS_LOGO_URL} alt="RLS" className="w-full h-full object-contain" />
              </div>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-2 italic">
              {isRemovingBg ? 'Procesando Piloto' : 'Generando Gráfica'}
            </h2>
            <p className="text-white/50 text-sm max-w-xs uppercase tracking-widest font-medium">
              {isRemovingBg 
                ? 'Estamos eliminando el fondo de la imagen mediante IA. Por favor espera un momento...' 
                : 'Estamos procesando las imágenes y aplicando los efectos de iluminación. Un momento...'}
            </p>
            {isMobile && !isRemovingBg && (
              <p className="text-red-500/60 text-[10px] mt-8 uppercase tracking-widest font-bold">
                Tip: Si la descarga no inicia, revisa si se abrió una nueva pestaña
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .mask-gradient-v2 {
          -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 95%);
          mask-image: linear-gradient(to bottom, black 70%, transparent 95%);
        }
        @media (max-width: 350px) {
          .xs\\:hidden { display: block; }
          .xs\\:inline { display: none; }
        }
      `}</style>
      {/* Vista previa de validación a pantalla completa */}
      <AnimatePresence>
        {showPreviewModal && generatedImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col"
          >
            {/* Header fijo */}
            <div className="flex-shrink-0 flex justify-between items-center px-5 py-4 border-b border-white/10">
              <div>
                <h3 className="text-base font-black uppercase tracking-tight italic">Revisa tu gráfica</h3>
                <p className="text-[10px] text-red-500 uppercase tracking-[0.2em] font-black">¿Está todo correcto?</p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                disabled={isSubmitting}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors disabled:opacity-40 text-xl leading-none"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {/* Imagen + caption (área scrolleable) */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col items-center gap-5">
              <img
                src={generatedImageUrl}
                alt="Gráfica generada"
                className="w-full max-w-[360px] h-auto rounded-2xl shadow-2xl border border-white/10"
              />
              {/* Caption editable */}
              <div className="w-full max-w-[360px] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-red-500" /> Caption Instagram
                  </label>
                  {!isGeneratingCaption && (
                    <button
                      onClick={fetchCaption}
                      className="flex items-center gap-1 text-[10px] text-red-500 font-bold uppercase tracking-widest hover:text-red-400 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Regenerar
                    </button>
                  )}
                </div>
                {isGeneratingCaption ? (
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <RefreshCw className="w-3 h-3 animate-spin text-red-500 flex-shrink-0" />
                    <span className="text-[11px] text-white/40">Generando con IA...</span>
                  </div>
                ) : (
                  <textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    rows={5}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-red-600/50 resize-none transition-colors"
                    placeholder="Caption generado por IA (podés editarlo antes de enviar)..."
                  />
                )}
              </div>
            </div>

            {/* Botones de acción fijos abajo */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-white/10 bg-black/60 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                onClick={submitGeneratedImage}
                disabled={isSubmitting}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-red-600/30 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                {isSubmitting ? 'ENVIANDO...' : 'ENVIAR PARA APROBACIÓN'}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={downloadGeneratedImage}
                  disabled={isSubmitting}
                  className="bg-white/5 border border-white/10 text-white py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  <Download className="w-4 h-4" /> Descargar
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  disabled={isSubmitting}
                  className="bg-white/5 border border-white/10 text-white py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" /> Editar
                </button>
              </div>
              {isMobile && (
                <p className="text-[10px] text-white/40 text-center italic pt-1">
                  Tip: también puedes mantener presionada la imagen para guardarla en Fotos.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
