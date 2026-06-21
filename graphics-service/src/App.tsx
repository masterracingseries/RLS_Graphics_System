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

interface Circuit {
  id: string;
  name: string;
  country: string;
  background: string;
}

const F1_CIRCUITS: Circuit[] = [
  { id: 'bahrain',      name: 'Sakhir',       country: 'Bahréin',        background: `${FONDOS_PATH}/bahrain.jpg` },
  { id: 'jeddah',      name: 'Jeddah',        country: 'Arabia Saudita', background: `${FONDOS_PATH}/jeddah.jpg` },
  { id: 'melbourne',   name: 'Melbourne',     country: 'Australia',      background: `${FONDOS_PATH}/melbourne.jpg` },
  { id: 'suzuka',      name: 'Suzuka',        country: 'Japón',          background: `${FONDOS_PATH}/suzuka.jpg` },
  { id: 'shanghai',    name: 'Shanghai',      country: 'China',          background: `${FONDOS_PATH}/shanghai.jpg` },
  { id: 'miami',       name: 'Miami',         country: 'Estados Unidos', background: `${FONDOS_PATH}/miami.jpg` },
  { id: 'imola',       name: 'Imola',         country: 'Italia',         background: `${FONDOS_PATH}/imola.jpg` },
  { id: 'monaco',      name: 'Mónaco',        country: 'Mónaco',         background: `${FONDOS_PATH}/monaco.jpg` },
  { id: 'barcelona',   name: 'Barcelona',     country: 'España',         background: `${FONDOS_PATH}/barcelona.jpg` },
  { id: 'montreal',    name: 'Montreal',      country: 'Canadá',         background: `${FONDOS_PATH}/montreal.jpg` },
  { id: 'spielberg',   name: 'Red Bull Ring', country: 'Austria',        background: `${FONDOS_PATH}/spielberg.jpg` },
  { id: 'silverstone', name: 'Silverstone',   country: 'Gran Bretaña',   background: `${FONDOS_PATH}/silverstone.jpg` },
  { id: 'spa',         name: 'Spa',           country: 'Bélgica',        background: `${FONDOS_PATH}/spa_fondo.jpg` },
  { id: 'budapest',    name: 'Budapest',      country: 'Hungría',        background: `${FONDOS_PATH}/budapest.jpg` },
  { id: 'zandvoort',   name: 'Zandvoort',     country: 'Países Bajos',   background: `${FONDOS_PATH}/zandvoort.jpg` },
  { id: 'monza',       name: 'Monza',         country: 'Italia',         background: `${FONDOS_PATH}/monza.jpg` },
  { id: 'baku',        name: 'Baku',          country: 'Azerbaiyán',     background: `${FONDOS_PATH}/baku.jpg` },
  { id: 'singapore',   name: 'Singapur',      country: 'Singapur',       background: `${FONDOS_PATH}/singapore.jpg` },
  { id: 'austin',      name: 'Austin (COTA)', country: 'Estados Unidos', background: `${FONDOS_PATH}/austin.jpg` },
  { id: 'mexico',      name: 'Ciudad de México', country: 'México',      background: `${FONDOS_PATH}/mexico.jpg` },
  { id: 'saopaulo',    name: 'São Paulo',     country: 'Brasil',         background: `${FONDOS_PATH}/saopaulo.jpg` },
  { id: 'lasvegas',    name: 'Las Vegas',     country: 'Estados Unidos', background: `${FONDOS_PATH}/lasvegas.jpg` },
  { id: 'lusail',      name: 'Lusail',        country: 'Qatar',          background: `${FONDOS_PATH}/lusail.jpg` },
  { id: 'abudhabi',    name: 'Yas Marina',    country: 'Abu Dabi',       background: `${FONDOS_PATH}/abudhabi.jpg` },
  { id: 'madrid',      name: 'IFEMA Madrid',  country: 'España',         background: `${FONDOS_PATH}/madrid.jpg` },
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
    car: `${AUTO_PATH}/auto_mercedes.avif`,
    color: '#00a19c' 
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
    name: 'RB F1 Team',
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
};

export default function App() {
  const [data, setData] = useState<PilotData>(INITIAL_DATA);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
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
    } catch (err: any) {
      setDownloadError(`Error al generar: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsGenerating(false);
    }
  }, []);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: generatedImageUrl,
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
  }, [generatedImageUrl, data]);

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

  // Calculate preview scale for mobile - Maximized for full view
  const previewScale = windowWidth < 1024 
    ? Math.min(1.2, (windowWidth - 24) / 360) 
    : 1;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-600 selection:text-white pb-20">
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
            <span className="text-[10px] text-white/20 font-mono mt-1">v1.5.0</span>
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
                {/* Background Image - User Provided F1 Wallpaper */}
                <div className="absolute inset-0 z-0">
                  <img 
                    src={getExportUrl(data.background)} 
                    alt="F1 Wallpaper" 
                    className="w-full h-full object-cover opacity-80 contrast-125"
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
                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black" />
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
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[85%] h-20 z-5 pointer-events-none opacity-70">
                  <img 
                    src={getExportUrl(activeCarImage)} 
                    alt="F1 Car Background" 
                    className="w-full h-full object-contain filter blur-[1.5px]"
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
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: 'linear-gradient(to bottom, transparent 30%, #050505 85%), linear-gradient(to right, #050505 0%, transparent 18%, transparent 82%, #050505 100%)' }}
                      />
                    </div>
                  ) : (
                    <div className="mt-24 w-36 h-36 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                      <User className="w-10 h-10 text-white/10" />
                    </div>
                  )}
                </div>

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
              </div>
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

            {/* Imagen (área scrolleable) */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex items-start justify-center">
              <img
                src={generatedImageUrl}
                alt="Gráfica generada"
                className="w-full max-w-[360px] h-auto rounded-2xl shadow-2xl border border-white/10"
              />
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
