
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"

// JSDelivr CDN - GitHub fayllari uchun eng ishonchli va CORS ruxsati ochiq bo'lgan tarmoq
const GUITAR_SAMPLE_URL = "https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/FatBoy/acoustic_guitar_nylon-mp3/E2.mp3"; 
const GUITAR_BODY_URL = "https://images.unsplash.com/photo-1550291652-6ea9114a47b1?q=80&w=1200&auto=format&fit=crop";

interface GuitarConfig {
  id: string;
  name: string;
  stringCount: number;
  ratios: number[];
  keys: string[];
  description: string;
}

const GUITAR_CONFIGS: Record<string, GuitarConfig> = {
  '4': {
    id: '4',
    name: '4-Torli Bass',
    stringCount: 4,
    ratios: [0.25, 0.334, 0.445, 0.595],
    keys: ['q', 'w', 'e', 'r'],
    description: 'Chuqur va gumburlovchi past chastotalar.'
  },
  '6': {
    id: '6',
    name: '6-Torli Standart',
    stringCount: 6,
    ratios: [0.5, 0.667, 0.891, 1.189, 1.587, 2.118],
    keys: ['q', 'w', 'e', 'r', 't', 'y'],
    description: 'Har qanday janr uchun mos klassik tanlov.'
  },
  '7': {
    id: '7',
    name: '7-Torli Modern',
    stringCount: 7,
    ratios: [0.375, 0.5, 0.667, 0.891, 1.189, 1.587, 2.118],
    keys: ['q', 'w', 'e', 'r', 't', 'y', 'u'],
    description: 'Og\'irroq rifflar va keng diapazon uchun.'
  },
  '12': {
    id: '12',
    name: '12-Torli Premium',
    stringCount: 12,
    ratios: [0.5, 1.0, 0.667, 1.334, 0.891, 1.782, 1.189, 2.378, 1.587, 1.587, 2.118, 2.118],
    keys: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
    description: 'Boy, rezonansli va kristalldek tiniq ovoz.'
  }
};

export default function App() {
  const [selectedConfig, setSelectedConfig] = useState<GuitarConfig | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [vibratingStrings, setVibratingStrings] = useState<boolean[]>([]);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [isBodyResonating, setIsBodyResonating] = useState(false);
  const [audioStatus, setAudioStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [logs, setLogs] = useState<{msg: string, type: 'info' | 'error' | 'success'}[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sampleBufferRef = useRef<AudioBuffer | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const lastPlayedTime = useRef<number[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [...prev, { msg, type }]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const initAudio = useCallback(async () => {
    setAudioStatus('loading');
    addLog('Audio tizimi yuklanmoqda...');
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = audioContextRef.current || new AudioCtx();
      audioContextRef.current = ctx;
      
      const masterGain = ctx.createGain();
      const gainValue = 3.0;
      if (Number.isFinite(gainValue)) {
        masterGain.gain.value = gainValue;
      }
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      addLog(`Resurs so'ralmoqda: ${GUITAR_SAMPLE_URL.split('/').pop()}...`);
      
      const response = await fetch(GUITAR_SAMPLE_URL, { 
        method: 'GET',
        cache: 'no-cache'
      });
      
      if (!response.ok) throw new Error(`Server javobi: ${response.status} ${response.statusText}`);
      
      const arrayBuffer = await response.arrayBuffer();
      addLog('Audio ma\'lumotlari dekodlanmoqda...');
      sampleBufferRef.current = await ctx.decodeAudioData(arrayBuffer);
      
      setAudioStatus('ready');
      addLog('Audio yuklandi', 'success');
    } catch (e: any) {
      const errorMsg = e.message || 'Noma\'lum xatolik';
      console.error("Audio yuklashda xatolik:", e);
      setAudioStatus('error');
      addLog(`Audio yuklashda xatolik: ${errorMsg}`, 'error');
    }
  }, [addLog]);

  useEffect(() => {
    initAudio();
  }, [initAudio]);

  const playString = useCallback((index: number) => {
    if (!audioContextRef.current || !sampleBufferRef.current || !selectedConfig || !masterGainRef.current) {
        return;
    }
    
    // index oralig'ini tekshirish
    if (index < 0 || index >= selectedConfig.ratios.length) return;

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const now = audioContextRef.current.currentTime;
    // 'now' qiymati finite ekanligini tekshirish
    if (!Number.isFinite(now)) return;

    if (now - (lastPlayedTime.current[index] || 0) < 0.05) return;
    lastPlayedTime.current[index] = now;

    try {
      const source = audioContextRef.current.createBufferSource();
      const stringGain = audioContextRef.current.createGain();
      
      source.buffer = sampleBufferRef.current;
      
      const playbackRate = selectedConfig.ratios[index] * 1.5;
      if (Number.isFinite(playbackRate)) {
        source.playbackRate.value = playbackRate; 
      }
      
      const initialGain = 2.2;
      const finalGain = 0.001;
      const duration = 5.5;

      if (Number.isFinite(initialGain) && Number.isFinite(now)) {
        stringGain.gain.setValueAtTime(initialGain, now); 
      }
      
      if (Number.isFinite(finalGain) && Number.isFinite(now + duration)) {
        // exponentialRampToValueAtTime uchun qiymat > 0 bo'lishi kerak
        stringGain.gain.exponentialRampToValueAtTime(finalGain, now + duration); 
      }
      
      source.connect(stringGain);
      stringGain.connect(masterGainRef.current);
      
      source.start(0);
      
      setVibratingStrings(prev => {
        const next = [...prev];
        if (index < next.length) next[index] = true;
        return next;
      });
      
      setIsBodyResonating(true);
      setTimeout(() => {
        setVibratingStrings(prev => {
          const next = [...prev];
          if (index < next.length) next[index] = false;
          return next;
        });
      }, 150);
      setTimeout(() => setIsBodyResonating(false), 300);
    } catch (err) {
      console.warn("String play error:", err);
    }
  }, [selectedConfig]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isStarted || !selectedConfig || e.repeat) return;
      const key = e.key.toLowerCase();
      const idx = selectedConfig.keys.indexOf(key);
      if (idx !== -1) {
        playString(idx);
        setActiveKeys(prev => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setActiveKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isStarted, playString, selectedConfig]);

  const handleStart = (config: GuitarConfig) => {
    if (audioStatus !== 'ready') return;
    if (audioContextRef.current) audioContextRef.current.resume();
    setSelectedConfig(config);
    setVibratingStrings(new Array(config.stringCount).fill(false));
    lastPlayedTime.current = new Array(config.stringCount).fill(0);
    setIsStarted(true);
    addLog(`Sessiya boshlandi: ${config.name}`);
    
    setTimeout(() => {
        config.ratios.forEach((_, i) => {
            setTimeout(() => playString(i), i * 80);
        });
    }, 400);
  };

  const ConsoleUI = () => (
    <div className="fixed bottom-6 left-6 w-80 max-h-40 overflow-y-auto bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 font-mono text-[10px] z-[100] shadow-2xl">
      <div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-2">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
          <div className="w-2 h-2 rounded-full bg-amber-500/50"></div>
          <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
        </div>
        <span className="text-neutral-500 uppercase tracking-widest font-bold">Studio Console</span>
      </div>
      <div className="space-y-1">
        {logs.map((log, i) => (
          <div key={i} className={`
            ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-neutral-400'}
            flex gap-2
          `}>
            <span className="opacity-30">[{new Date().toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span>
            <span className="break-all">{log.msg}</span>
          </div>
        ))}
        <div ref={logEndRef}></div>
      </div>
    </div>
  );

  if (!isStarted) {
    return (
      <>
        <Analytics />
        <SpeedInsights />
        <div id="container-48d438ea1e23fdf8fa9472782463213f"></div>
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">
        <ConsoleUI />
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <img src={GUITAR_BODY_URL} className="w-full h-full object-cover grayscale scale-110" alt="Background" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-[#0a0a0a]"></div>
        </div>
        
        <div className="z-10 space-y-12 w-full max-w-4xl text-center">
          <div className="space-y-4">
             <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl text-xs font-bold tracking-[0.2em] uppercase mb-4 shadow-2xl">
                <div className={`w-2.5 h-2.5 rounded-full ${audioStatus === 'ready' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : audioStatus === 'error' ? 'bg-red-500 shadow-[0_0_15px_red] animate-pulse' : 'bg-amber-500 animate-pulse'}`}></div>
                {audioStatus === 'ready' ? (
                  <span className="text-green-400">Audio Tizimi Faol</span>
                ) : audioStatus === 'error' ? (
                  <div className="flex items-center gap-3">
                    <span className="text-red-500 font-black">Yuklashda xato</span>
                    <button onClick={initAudio} className="bg-red-500/20 hover:bg-red-500/40 px-3 py-1 rounded-md transition-all text-white border border-red-500/50">Qayta yuklash</button>
                  </div>
                ) : (
                  <span className="text-amber-500">Audio Tayyorlanmoqda...</span>
                )}
             </div>
            <h1 className="text-6xl md:text-9xl font-black tracking-tighter uppercase italic leading-none drop-shadow-2xl">
              VIRTUAL <span className="text-amber-600">GUITAR</span>
            </h1>
            <p className="text-xl text-neutral-400 font-light tracking-widest max-w-2xl mx-auto uppercase">Professional darajadagi akustik ovoz sintezi</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
            {Object.values(GUITAR_CONFIGS).map((config) => (
              <button
                key={config.id}
                onClick={() => handleStart(config)}
                disabled={audioStatus !== 'ready'}
                className={`group relative bg-neutral-900/40 backdrop-blur-md border border-white/5 p-10 rounded-[2.5rem] text-left transition-all duration-700 overflow-hidden ${audioStatus === 'ready' ? 'hover:border-amber-500/50 hover:bg-neutral-800/60 hover:shadow-[0_0_60px_rgba(245,158,11,0.15)] hover:-translate-y-2' : 'opacity-20 cursor-not-allowed'}`}
              >
                <div className="absolute -right-6 -top-6 text-[10rem] font-black text-white/5 pointer-events-none group-hover:text-amber-500/10 transition-all duration-700 group-hover:scale-110">
                   {config.stringCount}
                </div>
                <div className="flex flex-col h-full relative z-10">
                  <span className="text-5xl font-black text-amber-600 mb-3 drop-shadow-lg">{config.stringCount}T</span>
                  <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{config.name}</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed font-semibold uppercase tracking-wider">{config.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col font-sans text-white overflow-hidden relative">
      <Analytics />
      <SpeedInsights />
      <ConsoleUI />
      <header className="px-12 py-10 flex justify-between items-center z-20">
        <div className="flex items-center space-x-6">
           <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-800 rounded-3xl flex items-center justify-center text-white font-black shadow-2xl shadow-amber-900/30 text-3xl transform -rotate-3 hover:rotate-0 transition-transform">
             {selectedConfig?.stringCount}
           </div>
           <div>
             <span className="font-black text-4xl tracking-tighter uppercase block leading-none">{selectedConfig?.name}</span>
             <span className="text-[11px] text-amber-600 font-bold tracking-[0.4em] uppercase mt-2 block opacity-90">Studio High-Fidelity Audio Active</span>
           </div>
        </div>
        <div className="flex items-center space-x-12">
          <button 
            onClick={() => setIsStarted(false)}
            className="text-[11px] font-black uppercase tracking-[0.3em] bg-neutral-900/80 border border-white/10 px-10 py-5 rounded-full hover:bg-amber-600 transition-all hover:border-amber-400 shadow-2xl hover:scale-105 active:scale-95"
          >
            Bosh Sahifa
          </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center relative px-10 guitar-container group">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
           <img 
            src={GUITAR_BODY_URL} 
            className={`guitar-body h-full w-full object-contain max-h-[85vh] transition-all duration-700 ${isBodyResonating ? 'scale-[1.06] brightness-125' : ''}`} 
            alt="Guitar Body"
           />
           <div className={`absolute inset-0 bg-radial-blur transition-opacity duration-700 ${isBodyResonating ? 'opacity-30' : 'opacity-100'}`}></div>
        </div>

        <div className="relative w-full max-w-7xl aspect-[21/9] flex items-center justify-center z-10">
          <div className="w-full h-full flex justify-between items-center px-16 md:px-36">
            {selectedConfig?.ratios.map((_, i) => {
              const key = selectedConfig.keys[i];
              const isKeyActive = activeKeys.has(key);
              
              return (
                <div 
                  key={i}
                  onMouseEnter={() => playString(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    playString(i);
                  }}
                  className="relative h-full w-full flex items-center justify-center cursor-pointer group/string"
                >
                  <div 
                    className={`
                      h-[85%] transition-all duration-75 origin-center
                      ${(vibratingStrings[i] || isKeyActive)
                        ? 'w-[7px] bg-amber-400 shadow-[0_0_50px_rgba(251,191,36,1)] brightness-150' 
                        : 'w-[2px] bg-white/10 shadow-[0_0_8px_rgba(255,255,255,0.05)] group-hover/string:bg-white/40 group-hover/string:w-[4px]'
                      }
                    `}
                    style={{ 
                      transform: (vibratingStrings[i] || isKeyActive)
                        ? `translateX(${(Math.random() - 0.5) * 20}px) scaleY(1.05)` 
                        : 'none' 
                    }}
                  ></div>

                  <div className={`
                    absolute bottom-[8%] flex flex-col items-center transition-all duration-300 pointer-events-none
                    ${(vibratingStrings[i] || isKeyActive) ? 'opacity-100 scale-150 -translate-y-8' : 'opacity-20 scale-100'}
                  `}>
                     <span className="text-sm font-black text-amber-500 drop-shadow-[0_0_20px_rgba(245,158,11,1)]">{key.toUpperCase()}</span>
                  </div>
                  <div className="absolute inset-0 h-full w-full bg-transparent"></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-20 left-0 right-0 flex justify-center animate-in fade-in slide-in-from-bottom duration-1000">
           <div className="bg-neutral-900/80 backdrop-blur-3xl border border-white/10 px-20 py-10 rounded-[4rem] flex flex-wrap justify-center items-center gap-20 shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-8">
                 <div className="flex gap-3">
                   {selectedConfig?.keys.slice(0, Math.ceil(selectedConfig.stringCount / 2)).map(k => (
                     <kbd key={k} className={`transition-all duration-200 px-5 py-3 rounded-2xl text-sm font-black border ${activeKeys.has(k) ? 'bg-amber-600 border-amber-400 text-white scale-110 shadow-2xl shadow-amber-900/60' : 'bg-neutral-800 text-neutral-500 border-white/5'}`}>
                       {k.toUpperCase()}
                     </kbd>
                   ))}
                 </div>
                 <span className="text-[12px] text-neutral-500 uppercase tracking-[0.3em] font-black">Bass Section</span>
              </div>
              <div className="w-px h-14 bg-white/10"></div>
              <div className="flex items-center gap-8">
                 <div className="flex gap-3">
                   {selectedConfig?.keys.slice(Math.ceil(selectedConfig.stringCount / 2)).map(k => (
                     <kbd key={k} className={`transition-all duration-200 px-5 py-3 rounded-2xl text-sm font-black border ${activeKeys.has(k) ? 'bg-amber-600 border-amber-400 text-white scale-110 shadow-2xl shadow-amber-900/60' : 'bg-neutral-800 text-neutral-500 border-white/5'}`}>
                       {k.toUpperCase()}
                     </kbd>
                   ))}
                 </div>
                 <span className="text-[12px] text-neutral-500 uppercase tracking-[0.3em] font-black">Treble Section</span>
              </div>
           </div>
        </div>
      </main>

      <footer className="px-12 py-12 flex justify-between items-center text-[11px] uppercase tracking-[0.6em] text-neutral-600 font-black z-20">
        <div className="flex gap-10 items-center">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${audioStatus === 'ready' ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)] animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-neutral-400">{audioStatus === 'ready' ? 'Engine: CDN-Optimized v3.0' : 'Engine: Critical Failure'}</span>
          </div>
        </div>
        <div className="flex gap-12">
          <span className="text-amber-600/60 font-black animate-pulse">SICHQONCHA YOKI KLAVIATURA BILAN CHALING</span>
          <span className="text-neutral-800">|</span>
          <span className="text-neutral-500">Virtual Audio Lab v4.0</span>
        </div>
      </footer>

      <style>{`
        .guitar-body {
           filter: contrast(1.15) brightness(0.9);
           mask-image: linear-gradient(to bottom, black 85%, transparent 100%);
           transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), filter 0.4s ease;
           will-change: transform, filter;
        }
        .bg-radial-blur {
          background: radial-gradient(circle at center, transparent 0%, #050505 90%);
          position: absolute;
          inset: 0;
        }
        ::-webkit-scrollbar {
          width: 4px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
