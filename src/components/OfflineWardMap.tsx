import { useState, useEffect, useRef, TouchEvent, MouseEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MapPin, 
  ZoomIn, 
  ZoomOut, 
  Wifi, 
  WifiOff, 
  Download, 
  Trash2, 
  CheckCircle2, 
  Compass,
  AlertCircle,
  HelpCircle
} from "lucide-react";
import { wardLocations } from "../data/mockOfficials";

interface OfflineWardMapProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  language: "en" | "hi" | "ta" | "te";
}

// Tile coordinate math
function latLngToTile(lat: number, lng: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n;
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const clampedLatRad = (clampedLat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(clampedLatRad) + 1 / Math.cos(clampedLatRad)) / Math.PI) / 2 * n;
  return { x, y };
}

function tileToLatLng(x: number, y: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

const CACHE_NAME = "offline-map-tiles";

export default function OfflineWardMap({ latitude, longitude, onChange, language }: OfflineWardMapProps) {
  const [zoom, setZoom] = useState(15);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [tileUrls, setTileUrls] = useState<Record<string, string>>({});
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [cachingProgress, setCachingProgress] = useState<{ active: boolean; current: number; total: number } | null>(null);
  const [cachedWards, setCachedWards] = useState<Record<string, boolean>>({});

  // Navigation drag/touch state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const mapCenterStart = useRef({ lat: 0, lng: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Translations dictionary
  const t = {
    en: {
      mapTitle: "Interactive Offline Ward Map",
      desc: "Drag the map or move sliders to pinpoint the exact location. Pre-cache tiles to ensure map works without internet connection.",
      online: "Online Mode",
      offline: "Offline Mode (Cached)",
      preCacheBtn: "Pre-Cache Current Ward Area",
      clearCacheBtn: "Clear Map Cache",
      cachingStatus: "Caching map tiles...",
      cachedSuccess: "Ward map ready offline!",
      markerLabel: "Report Location",
      zoomIn: "Zoom In",
      zoomOut: "Zoom Out",
      clampedWarning: "Location snapped to Coimbatore/Chennai zone for official coverage."
    },
    hi: {
      mapTitle: "इंटरएक्टिव ऑफलाइन वार्ड मानचित्र",
      desc: "सटीक स्थान को इंगित करने के लिए मानचित्र को खींचें या स्लाइडर का उपयोग करें। बिना इंटरनेट के काम करने के लिए टाइल्स को प्री-कैश करें।",
      online: "ऑनलाइन मोड",
      offline: "ऑफ़लाइन मोड (कैश्ड)",
      preCacheBtn: "वर्तमान वार्ड क्षेत्र को प्री-कैश करें",
      clearCacheBtn: "मानचित्र कैश साफ करें",
      cachingStatus: "मानचित्र टाइलें कैश की जा रही हैं...",
      cachedSuccess: "वार्ड मानचित्र ऑफ़लाइन तैयार है!",
      markerLabel: "रिपोर्ट स्थान",
      zoomIn: "ज़ूम इन",
      zoomOut: "ज़ूम आउट",
      clampedWarning: "आधिकारिक कवरेज के लिए स्थान को कोयंबटूर/चेन्नई क्षेत्र में स्थानांतरित किया गया है।"
    },
    ta: {
      mapTitle: "ஊடாடும் ஆஃப்லைன் வார்டு வரைபடம்",
      desc: "சரியான இடத்தைக் குறிக்க வரைபடத்தை இழுக்கவும் அல்லது ஸ்லைடர்களை நகர்த்தவும். இணைய இணைப்பு இல்லாமல் வரைபடம் செயல்பட டைல்களைப் ப்ரீ-கேச் செய்யவும்.",
      online: "ஆன்லைன் பயன்முறை",
      offline: "ஆஃப்லைன் பயன்முறை (சேமிக்கப்பட்டது)",
      preCacheBtn: "தற்போதைய வார்டு பகுதியை ப்ரீ-கேச் செய்",
      clearCacheBtn: "வரைபட தற்காலிக சேமிப்பை அழி",
      cachingStatus: "வரைபட டைல்கள் சேமிக்கப்படுகின்றன...",
      cachedSuccess: "வார்டு வரைபடம் ஆஃப்லைனில் தயார்!",
      markerLabel: "புகார் இடம்",
      zoomIn: "பெரிதாக்கு",
      zoomOut: "சிறிதாக்கு",
      clampedWarning: "அதிகாரப்பூர்வ பாதுகாப்புக்காக இடம் கோயம்புத்தூர்/சென்னை மண்டலத்திற்கு மாற்றப்பட்டது."
    },
    te: {
      mapTitle: "ఇంటరాక్టివ్ ఆఫ్లైన్ వార్డ్ మ్యాప్",
      desc: "ఖచ్చితమైన స్థానాన్ని గుర్తించడానికి మ్యాప్‌ను లాగండి లేదా స్లయిడర్‌లను తరలించండి. ఇంటర్నెట్ లేకుండా మ్యాప్ పని చేయడానికి టైల్స్‌ను ప్రీ-క్యాష్ చేయండి.",
      online: "ఆన్‌లైన్ మోడ్",
      offline: "ఆఫ్‌లైన్ మోడ్ (క్యాష్ చేయబడింది)",
      preCacheBtn: "ప్రస్తుత వార్డ్ ప్రాంతాన్ని ప్రీ-క్యాష్ చేయండి",
      clearCacheBtn: "మ్యాప్ క్యాష్‌ను క్లియర్ చేయండి",
      cachingStatus: "మ్యాప్ టైల్స్ క్యాష్ చేయబడుతున్నాయి...",
      cachedSuccess: "వార్డ్ మ్యాప్ ఆఫ్లైన్ లో సిద్ధంగా ఉంది!",
      markerLabel: "నివేదిక స్థానం",
      zoomIn: "జూమ్ ఇన్",
      zoomOut: "జూమ్ అవుట్",
      clampedWarning: "అధికారిక కవరేజీ కోసం స్థానం కోయంబత్తూరు/చెన్నై జోన్‌కు మార్చబడింది."
    }
  }[language] || {
    mapTitle: "Interactive Offline Ward Map",
    desc: "Drag the map or move sliders to pinpoint the exact location. Pre-cache tiles to ensure map works without internet connection.",
    online: "Online Mode",
    offline: "Offline Mode (Cached)",
    preCacheBtn: "Pre-Cache Current Ward Area",
    clearCacheBtn: "Clear Map Cache",
    cachingStatus: "Caching map tiles...",
    cachedSuccess: "Ward map ready offline!",
    markerLabel: "Report Location",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    clampedWarning: "Location snapped to Coimbatore/Chennai zone for official coverage."
  };

  // Check online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update tile URLs when center, zoom, or connection changes
  useEffect(() => {
    let active = true;
    const cacheStorageKeys: string[] = [];

    const loadTiles = async () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth || 400;
      const height = containerRef.current.clientHeight || 250;

      // Calculate how many tiles we need to show
      const centerTile = latLngToTile(latitude, longitude, zoom);
      const tilesXNeeded = Math.ceil(width / 256) + 1;
      const tilesYNeeded = Math.ceil(height / 256) + 1;

      const minX = Math.floor(centerTile.x - tilesXNeeded / 2);
      const maxX = Math.ceil(centerTile.x + tilesXNeeded / 2);
      const minY = Math.floor(centerTile.y - tilesYNeeded / 2);
      const maxY = Math.ceil(centerTile.y + tilesYNeeded / 2);

      const newTileUrls: Record<string, string> = { ...tileUrls };
      const cache = await caches.open(CACHE_NAME);

      for (let tx = minX; tx <= maxX; tx++) {
        for (let ty = minY; ty <= maxY; ty++) {
          const key = `${zoom}-${tx}-${ty}`;
          const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;

          const existingUrl = newTileUrls[key];
          if (existingUrl && typeof existingUrl === "string" && existingUrl.startsWith("blob:")) {
            continue; // Already has object URL
          }

          try {
            // Check cache first
            const cachedRes = await cache.match(tileUrl);
            if (cachedRes) {
              const blob = await cachedRes.blob();
              const objectUrl = URL.createObjectURL(blob);
              if (active) {
                newTileUrls[key] = objectUrl;
              }
            } else if (navigator.onLine) {
              // Online: fetch and cache
              const response = await fetch(tileUrl, { referrerPolicy: "no-referrer" });
              if (response.ok) {
                await cache.put(tileUrl, response.clone());
                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);
                if (active) {
                  newTileUrls[key] = objectUrl;
                }
              } else {
                newTileUrls[key] = tileUrl; // Fallback to direct URL if fetch failed but not throw
              }
            } else {
              // Offline and not cached
              newTileUrls[key] = "offline-fallback";
            }
          } catch (err) {
            console.error("Failed to load map tile", err);
            newTileUrls[key] = "offline-fallback";
          }
        }
      }

      if (active) {
        setTileUrls({ ...newTileUrls });
      }
    };

    loadTiles();
    updateCacheStats();

    return () => {
      active = false;
      // Note: We don't revoke all blob URLs immediately to avoid flickering, 
      // but they are cleaned up on final unmount or naturally by the browser.
    };
  }, [latitude, longitude, zoom, isOnline]);

  // Read current cache statistics
  const updateCacheStats = async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      setCacheSize(keys.length);

      // Check which wards are cached
      const wardsCachedStatus: Record<string, boolean> = {};
      for (const loc of wardLocations) {
        const centerTile = latLngToTile(loc.lat, loc.lng, 15);
        const testUrl = `https://tile.openstreetmap.org/15/${Math.floor(centerTile.x)}/${Math.floor(centerTile.y)}.png`;
        const match = await cache.match(testUrl);
        wardsCachedStatus[loc.ward] = !!match;
      }
      setCachedWards(wardsCachedStatus);
    } catch (e) {
      console.error(e);
    }
  };

  // Clear Map cache
  const clearMapCache = async () => {
    try {
      await caches.delete(CACHE_NAME);
      // Revoke old blob URLs
      Object.values(tileUrls).forEach(url => {
        if (url && typeof url === "string" && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
      setTileUrls({});
      setCacheSize(0);
      setCachedWards({});
    } catch (e) {
      console.error(e);
    }
  };

  // Pre-cache tiles for the current coordinate area
  const preCacheCurrentWard = async () => {
    if (!navigator.onLine) return;
    setCachingProgress({ active: true, current: 0, total: 1 });

    try {
      const cache = await caches.open(CACHE_NAME);
      const zooms = [14, 15, 16];
      const urlsToDownload: string[] = [];

      // Compile urls
      for (const z of zooms) {
        const centerTile = latLngToTile(latitude, longitude, z);
        const radius = 2; // 5x5 grid around the center
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            const tx = Math.floor(centerTile.x) + dx;
            const ty = Math.floor(centerTile.y) + dy;
            urlsToDownload.push(`https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`);
          }
        }
      }

      setCachingProgress({ active: true, current: 0, total: urlsToDownload.length });

      // Fetch in chunks to avoid slamming network
      const chunkSize = 5;
      for (let i = 0; i < urlsToDownload.length; i += chunkSize) {
        const chunk = urlsToDownload.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (url) => {
            try {
              const alreadyCached = await cache.match(url);
              if (!alreadyCached) {
                const response = await fetch(url, { referrerPolicy: "no-referrer" });
                if (response.ok) {
                  await cache.put(url, response);
                }
              }
            } catch (err) {
              console.warn("Failed caching individual tile", url, err);
            }
          })
        );
        setCachingProgress(prev => prev ? { ...prev, current: Math.min(prev.total, i + chunk.length) } : null);
      }

      updateCacheStats();
      setTimeout(() => {
        setCachingProgress(null);
      }, 3000);

    } catch (e) {
      console.error("Pre-caching error", e);
      setCachingProgress(null);
    }
  };

  // Drag-to-Pan Handlers
  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartPos.current = { x: clientX, y: clientY };
    mapCenterStart.current = { lat: latitude, lng: longitude };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging || !containerRef.current) return;

    const dx = clientX - dragStartPos.current.x;
    const dy = clientY - dragStartPos.current.y;

    const currentZoomMultiplier = Math.pow(2, zoom);
    // Determine the tile center coordinate of the current lat,lng
    const tileCenter = latLngToTile(mapCenterStart.current.lat, mapCenterStart.current.lng, zoom);

    // Convert pixel offset into fractional tile changes
    const tileDx = dx / 256;
    const tileDy = dy / 256;

    // Subtract tile displacement (inverse coordinate direction)
    const newTileX = tileCenter.x - tileDx;
    const newTileY = tileCenter.y - tileDy;

    // Convert back to Lat/Lng
    const newLatLng = tileToLatLng(newTileX, newTileY, zoom);

    // Guard coordinates within absolute boundaries to keep consistent and responsive
    const clampedLat = Math.max(-85, Math.min(85, newLatLng.lat));
    const clampedLng = Math.max(-180, Math.min(180, newLatLng.lng));

    onChange(clampedLat, clampedLng);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Mouse drag events
  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e: MouseEvent) => {
    handleDragMove(e.clientX, e.clientY);
  };

  // Touch drag events for mobile/tablet responsive touch support
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Calculate rendering elements of map tiles inside viewport
  const renderTiles = () => {
    if (!containerRef.current) return null;
    const width = containerRef.current.clientWidth || 400;
    const height = containerRef.current.clientHeight || 250;

    // Current coordinates mapping to tile grid
    const centerTile = latLngToTile(latitude, longitude, zoom);
    
    const tilesXNeeded = Math.ceil(width / 256) + 1;
    const tilesYNeeded = Math.ceil(height / 256) + 1;

    const minX = Math.floor(centerTile.x - tilesXNeeded / 2);
    const maxX = Math.ceil(centerTile.x + tilesXNeeded / 2);
    const minY = Math.floor(centerTile.y - tilesYNeeded / 2);
    const maxY = Math.ceil(centerTile.y + tilesYNeeded / 2);

    const tiles: import("react").ReactNode[] = [];

    for (let tx = minX; tx <= maxX; tx++) {
      for (let ty = minY; ty <= maxY; ty++) {
        const key = `${zoom}-${tx}-${ty}`;
        const sourceUrl = tileUrls[key];

        // Position of top-left corner of this tile relative to map container center
        const tileLeft = width / 2 + (tx - centerTile.x) * 256;
        const tileTop = height / 2 + (ty - centerTile.y) * 256;

        const isFallback = sourceUrl === "offline-fallback";

        tiles.push(
          <div
            key={key}
            className="absolute select-none pointer-events-none"
            style={{
              width: "256px",
              height: "256px",
              left: `${tileLeft}px`,
              top: `${tileTop}px`,
            }}
          >
            {isFallback ? (
              <div className="w-full h-full border border-slate-100 bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                <Compass className="w-6 h-6 text-slate-300 animate-pulse mb-1" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-tight">
                  Offline Mode
                </span>
                <span className="text-[8px] font-semibold text-slate-400/80 leading-none mt-0.5">
                  Tile not pre-cached
                </span>
              </div>
            ) : sourceUrl ? (
              <img
                src={sourceUrl}
                alt=""
                className="w-full h-full object-cover transition-opacity duration-200"
                loading="eager"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-slate-50 border border-slate-100 animate-pulse" />
            )}
          </div>
        );
      }
    }

    return tiles;
  };

  return (
    <div id="offline-ward-map-widget" className="bg-slate-50 rounded-3xl p-5 border border-slate-200/80 space-y-4">
      {/* Map Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
        <div className="space-y-0.5">
          <h4 className="font-extrabold text-sm text-slate-800 tracking-tight flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-blue-600 animate-spin-slow" />
            {t.mapTitle}
          </h4>
          <p className="text-[10px] text-slate-500 font-medium max-w-sm leading-relaxed">
            {t.desc}
          </p>
        </div>

        {/* Network Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
            isOnline 
              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3 animate-pulse" />}
            {isOnline ? t.online : t.offline}
          </span>
          
          <span className="text-[10px] bg-slate-100 border border-slate-200/80 text-slate-600 font-extrabold px-2.5 py-1 rounded-full">
            📁 {cacheSize} Tiles Saved
          </span>
        </div>
      </div>

      {/* Main Interactive Map Canvas */}
      <div 
        ref={containerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={handleDragEnd}
        className={`relative h-64 w-full bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden shadow-inner cursor-grab select-none ${
          isDragging ? "cursor-grabbing" : ""
        }`}
      >
        {/* Render cached or fetched tile grid */}
        {renderTiles()}

        {/* Grid Overlay for Visual Alignment */}
        <div className="absolute inset-0 pointer-events-none border border-black/5 mix-blend-overlay bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />

        {/* Floating Controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(18, z + 1))}
            title={t.zoomIn}
            className="p-2 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 shadow-md rounded-xl text-slate-700 transition cursor-pointer flex items-center justify-center"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(12, z - 1))}
            title={t.zoomOut}
            className="p-2 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 shadow-md rounded-xl text-slate-700 transition cursor-pointer flex items-center justify-center"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

        {/* Floating Zoom Indicator */}
        <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-lg z-10 border border-white/10">
          Zoom {zoom}x
        </div>

        {/* Static Bouncing Center Pin representing exactly selected coordinates */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[28px] pointer-events-none z-20 flex flex-col items-center">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="relative flex flex-col items-center"
          >
            {/* Pulsing beacon behind pin */}
            <span className="absolute -inset-2.5 bg-rose-500/30 rounded-full animate-ping pointer-events-none" />
            
            <MapPin className="w-8 h-8 text-rose-600 drop-shadow-md fill-rose-100" />
            
            {/* Small label above Pin */}
            <div className="absolute -top-6 bg-rose-600 text-white font-extrabold text-[8px] uppercase tracking-wider py-0.5 px-2 rounded-md shadow-md whitespace-nowrap">
              {t.markerLabel}
            </div>
          </motion.div>
          {/* Ground contact shadow */}
          <span className="w-2.5 h-1 bg-black/25 blur-[1px] rounded-full mt-1 animate-pulse" />
        </div>
      </div>

      {/* Caching & Synchronization Control Center */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Active Caching Overlay and Status */}
        <AnimatePresence mode="wait">
          {cachingProgress && cachingProgress.active ? (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center gap-3 bg-blue-50 border border-blue-100 px-4 py-2.5 rounded-2xl w-full sm:w-auto flex-1"
            >
              <div className="relative w-8 h-8 flex items-center justify-center">
                <span className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin block" />
                <span className="absolute text-[8px] font-black text-blue-600">
                  {Math.round((cachingProgress.current / cachingProgress.total) * 100)}%
                </span>
              </div>
              <div className="text-xs space-y-0.5 flex-1">
                <p className="font-black text-blue-900 text-[11px] leading-tight uppercase">
                  {t.cachingStatus}
                </p>
                <p className="text-[10px] text-blue-600 font-bold leading-none">
                  Saved {cachingProgress.current} of {cachingProgress.total} base map tiles
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Pre-Cache Button */}
              <button
                type="button"
                disabled={!isOnline}
                onClick={preCacheCurrentWard}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold shadow-xs transition active:scale-95 cursor-pointer ${
                  isOnline 
                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300/40"
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                {t.preCacheBtn}
              </button>

              {/* Cache size clear trigger */}
              {cacheSize > 0 && (
                <button
                  type="button"
                  onClick={clearMapCache}
                  title={t.clearCacheBtn}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 border border-slate-200 rounded-xl transition cursor-pointer flex items-center justify-center bg-white"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </AnimatePresence>

        {/* Selected Coordinates Status text */}
        <div className="text-right flex flex-col justify-center">
          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">
            Map Center Focal Geotag
          </span>
          <span className="font-mono text-[11px] font-extrabold text-slate-800 mt-0.5 bg-white border border-slate-200/80 px-2.5 py-1 rounded-lg inline-block self-end">
            {latitude.toFixed(5)}° N, {longitude.toFixed(5)}° E
          </span>
        </div>
      </div>
    </div>
  );
}
