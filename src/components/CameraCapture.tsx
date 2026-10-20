import { useState, useRef, useEffect } from "react";
import { Camera, RefreshCw, Check, MapPin, Calendar, HelpCircle, Loader2 } from "lucide-react";
import { TRANSLATIONS } from "../types";

interface CameraCaptureProps {
  onCapture: (photoBase64: string, lat: number, lng: number) => void;
  language: "en" | "hi" | "ta" | "te";
  isRepairProof?: boolean; // If used by official
}

// Preset mock locations & civic scenes if user allows geolocation but doesn't have a webcam or for stable sandbox testing
const SAMPLE_MOCK_SCENES = [
  {
    title: "Leaking Pipe near Anna Nagar",
    url: "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&auto=format&fit=crop&q=80",
    lat: 13.0850,
    lng: 80.2100
  },
  {
    title: "Sewage Overflow near Mylapore Car Street",
    url: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?w=600&auto=format&fit=crop&q=80",
    lat: 13.0400,
    lng: 80.2500
  },
  {
    title: "Clogged Drainage Line near Adyar ECR",
    url: "https://images.unsplash.com/photo-1538300342682-859dbf995a9a?w=600&auto=format&fit=crop&q=80",
    lat: 12.9830,
    lng: 80.2590
  }
];

export default function CameraCapture({ onCapture, language, isRepairProof = false }: CameraCaptureProps) {
  const t = TRANSLATIONS[language];
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Geo states
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch Location
  useEffect(() => {
    if ("geolocation" in navigator) {
      setGeoLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setGeoLoading(false);
        },
        (error) => {
          console.warn("Geolocation permission error:", error);
          // Fallback to municipal default center (Chennai, Tamil Nadu layout for seeding)
          setLatitude(13.0827 + (Math.random() - 0.5) * 0.05);
          setLongitude(80.2707 + (Math.random() - 0.5) * 0.05);
          setGeoError("Using approximate neighborhood location");
          setGeoLoading(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setLatitude(13.0827);
      setLongitude(80.2707);
      setGeoError("Geolocation not supported. Defaulting coordinates");
      setGeoLoading(false);
    }
  }, []);

  // Initialize Camera
  async function startCamera() {
    setLoading(true);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);
      setCaptured(false);
      setPhotoData(null);
    } catch (err) {
      console.warn("Webcam not available or permission denied:", err);
      setCameraActive(false);
    } finally {
      setLoading(false);
    }
  }

  // Stop Camera
  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  }

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Handle Capture with Watermark/Overlay imprinting!
  function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && cameraActive) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Match canvas size to video aspect ratio
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        // Draw current video frame onto canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Imprint dynamic metadata watermarking! (Extremely professional civic tech)
        const latVal = latitude !== null ? latitude.toFixed(6) : "Fetching...";
        const lngVal = longitude !== null ? longitude.toFixed(6) : "Fetching...";
        const timestampStr = new Date().toLocaleString();
        const watermarkId = `CIVIC-${Math.floor(1000 + Math.random() * 9000)}`;

        // Draw transparent dark banner at the bottom for readability
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
        ctx.fillRect(0, canvas.height - 75, canvas.width, 75);

        // Set watermark text style
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px monospace";
        ctx.fillText(`GPS: ${latVal}° N, ${lngVal}° E`, 20, canvas.height - 48);
        ctx.fillText(`TIME: ${timestampStr}`, 20, canvas.height - 24);

        ctx.fillStyle = "#facc15"; // yellow text
        ctx.font = "bold 15px monospace";
        ctx.fillText(`ID: ${watermarkId} (${isRepairProof ? "REPAIR" : "COMPLAINT"})`, canvas.width - 240, canvas.height - 35);

        const dataUrl = canvas.toDataURL("image/jpeg");
        setPhotoData(dataUrl);
        setCaptured(true);
        stopCamera();
      }
    } else {
      // Fallback selection if camera permission is denied: let user pick a mock scenario
      handleSelectMock(SAMPLE_MOCK_SCENES[0]);
    }
  }

  // Handle using a demo image fallback (with overlaid metadata too!)
  function handleSelectMock(scene: typeof SAMPLE_MOCK_SCENES[0]) {
    setLoading(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = scene.url;
    img.onload = () => {
      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, 640, 480);

        // Imprint dynamic metadata watermarking!
        const latVal = (latitude !== null ? latitude : scene.lat).toFixed(6);
        const lngVal = (longitude !== null ? longitude : scene.lng).toFixed(6);
        const timestampStr = new Date().toLocaleString();
        const watermarkId = `CIVIC-${Math.floor(1000 + Math.random() * 9000)}`;

        ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
        ctx.fillRect(0, 480 - 75, 640, 75);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px monospace";
        ctx.fillText(`GPS: ${latVal}° N, ${lngVal}° E`, 20, 480 - 48);
        ctx.fillText(`TIME: ${timestampStr}`, 20, 480 - 24);

        ctx.fillStyle = "#facc15"; // yellow
        ctx.font = "bold 15px monospace";
        ctx.fillText(`ID: ${watermarkId} (GEO-SIMULATION)`, 640 - 250, 480 - 35);

        const dataUrl = canvas.toDataURL("image/jpeg");
        setPhotoData(dataUrl);
        setCaptured(true);
        setLoading(false);
      }
    };
    img.onerror = () => {
      // If unsplash fails to load, draw a solid colored grid with geotag
      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = isRepairProof ? "#10b981" : "#3b82f6";
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText(isRepairProof ? "REPAIR SITE SNAPSHOT" : "CIVIC ISSUE SITE SNAPSHOT", 100, 200);

        const latVal = (latitude !== null ? latitude : scene.lat).toFixed(6);
        const lngVal = (longitude !== null ? longitude : scene.lng).toFixed(6);

        ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
        ctx.fillRect(0, 480 - 75, 640, 75);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px monospace";
        ctx.fillText(`GPS: ${latVal}° N, ${lngVal}° E`, 20, 480 - 48);
        ctx.fillText(`TIME: ${new Date().toLocaleString()}`, 20, 480 - 24);

        const dataUrl = canvas.toDataURL("image/jpeg");
        setPhotoData(dataUrl);
        setCaptured(true);
        setLoading(false);
      }
    };
  }

  function handleReset() {
    setCaptured(false);
    setPhotoData(null);
    startCamera();
  }

  function handleConfirm() {
    if (photoData && latitude !== null && longitude !== null) {
      onCapture(photoData, latitude, longitude);
    }
  }

  return (
    <div id="camera-capture-container" className="bg-slate-900 text-white rounded-3xl overflow-hidden p-4 md:p-6 shadow-xl relative max-w-xl mx-auto border border-slate-800">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <h4 className="text-md font-bold flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-500" />
          {isRepairProof ? (language === "ta" ? "பழுதுபார்ப்பு சரிபார்ப்பு கேமரா" : language === "te" ? "మరమ్మత్తు ధృవీకరణ కెమెరా" : language === "hi" ? "मरम्मत सत्यापन कैमरा" : "Repair Verification Camera") : t.capturePhoto}
        </h4>
        <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-2.5 py-1 rounded-full uppercase tracking-widest">
          {t.geotagActive}
        </span>
      </div>

      {/* Geotag display ribbon */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 mb-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-950 text-blue-400 p-2 rounded-xl">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.geotagCoordinates}</p>
            {geoLoading ? (
              <span className="text-xs text-blue-400 animate-pulse flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> {t.detectingGps}
              </span>
            ) : (
              <span className="text-xs font-mono font-bold text-slate-200">
                {latitude?.toFixed(6)}° N, {longitude?.toFixed(6)}° E
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-950 text-indigo-400 p-2 rounded-xl">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.timestamp}</p>
            <span className="text-xs font-mono font-bold text-slate-200">
              {new Date().toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {geoError && (
        <p className="text-[11px] text-yellow-400 mb-3 bg-yellow-950/30 border border-yellow-900/30 px-3 py-1.5 rounded-xl font-medium text-center">
          💡 {geoError}
        </p>
      )}

      {/* Main visual camera/view panel */}
      <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-inner border border-slate-800">
        <canvas ref={canvasRef} className="hidden" />

        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-2" />
            <p className="text-sm text-slate-400 font-medium">Powering camera sensor...</p>
          </div>
        ) : captured && photoData ? (
          <img
            src={photoData}
            alt="Captured and geotagged snapshot"
            className="w-full h-full object-cover"
          />
        ) : cameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
            <HelpCircle className="w-12 h-12 text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-300 mb-4">
              {t.cameraBlocked}
            </p>
            <div className="w-full max-w-sm">
              <p className="text-[11px] text-slate-500 uppercase font-bold mb-2.5 tracking-wider">
                {t.selectPrevalidatedPhoto}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {SAMPLE_MOCK_SCENES.map((scene, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectMock(scene)}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 p-2 rounded-xl text-[10px] font-bold text-blue-400 hover:text-white transition cursor-pointer"
                  >
                    {scene.title.split(" ")[0]} {scene.title.split(" ")[1] || ""}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Camera triggers */}
      <div className="flex items-center justify-center gap-4 mt-6">
        {captured ? (
          <>
            <button
              id="camera-retake-btn"
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3.5 px-6 rounded-2xl active:scale-95 transition text-sm cursor-pointer border border-slate-700"
            >
              <RefreshCw className="w-4 h-4" />
              {t.retake}
            </button>
            <button
              id="camera-confirm-btn"
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-8 rounded-2xl active:scale-95 transition text-sm shadow-md shadow-emerald-950/30 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {t.useGeotaggedPhoto}
            </button>
          </>
        ) : (
          <button
            id="camera-capture-btn"
            type="button"
            onClick={handleCapture}
            className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-4 px-10 rounded-2xl shadow-lg shadow-blue-950/40 active:scale-95 transition text-md cursor-pointer"
          >
            <Camera className="w-5 h-5" />
            {cameraActive ? t.takePhotoGeotag : t.loadSimulatedSnapshot}
          </button>
        )}
      </div>
    </div>
  );
}
