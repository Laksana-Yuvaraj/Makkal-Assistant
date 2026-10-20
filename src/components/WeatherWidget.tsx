import { useState, useEffect, FormEvent } from "react";
import { motion } from "motion/react";
import { 
  Cloud, 
  Sun, 
  CloudRain, 
  CloudLightning, 
  Thermometer, 
  Wind, 
  Droplets, 
  Search, 
  RefreshCw, 
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Info
} from "lucide-react";

interface WeatherSource {
  title: string;
  url: string;
}

interface WeatherData {
  city: string;
  temperature: string;
  condition: string;
  humidity: string;
  wind: string;
  summary: string;
  civicImpactAlert: string;
  severity: "Normal" | "Caution" | "Severe" | string;
  sources?: WeatherSource[];
}

interface WeatherWidgetProps {
  language: "en" | "hi" | "ta" | "te";
}

export default function WeatherWidget({ language }: WeatherWidgetProps) {
  const [city, setCity] = useState("Chennai");
  const [searchVal, setSearchVal] = useState("Chennai");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Translations for weather widget elements
  const weatherT = {
    en: {
      title: "Local Weather & Civic Impact",
      searchPlaceholder: "Search city...",
      humidity: "Humidity",
      wind: "Wind",
      civicAlert: "Civic Impact Advisory",
      sources: "Sources via Google Search:",
      loadingText: "Grounding live weather search...",
      errorText: "Failed to retrieve grounded weather data.",
      caution: "Caution Advisory",
      normal: "Conditions Normal",
      severe: "Severe Weather Warning"
    },
    hi: {
      title: "स्थानीय मौसम और नागरिक प्रभाव",
      searchPlaceholder: "शहर खोजें...",
      humidity: "आर्द्रता",
      wind: "हवा की गति",
      civicAlert: "नागरिक प्रभाव सलाह",
      sources: "गूगल खोज द्वारा स्रोत:",
      loadingText: "लाइव मौसम खोज चल रही है...",
      errorText: "मौसम डेटा प्राप्त करने में विफल।",
      caution: "सावधानी सलाह",
      normal: "सामान्य स्थिति",
      severe: "गंभीर मौसम की चेतावनी"
    },
    ta: {
      title: "உள்ளூர் வானிலை & குடிமை தாக்கம்",
      searchPlaceholder: "நகரத்தைத் தேடு...",
      humidity: "ஈரப்பதம்",
      wind: "காற்றின் வேகம்",
      civicAlert: "குடிமை தாக்க ஆலோசனை",
      sources: "கூகிள் தேடல் வழி மூலங்கள்:",
      loadingText: "நேரடி வானிலையைத் தேடுகிறது...",
      errorText: "வானிலை தரவைப் பெற முடியவில்லை.",
      caution: "எச்சரிக்கை ஆலோசனை",
      normal: "இயல்பு நிலை",
      severe: "கடுமையான வானிலை எச்சரிக்கை"
    },
    te: {
      title: "స్థానిక వాతావరణం & పౌర ప్రభావం",
      searchPlaceholder: "నగరాన్ని శోధించండి...",
      humidity: "తేమ",
      wind: "గాలి వేగం",
      civicAlert: "పౌర ప్రభావ సలహా",
      sources: "గూగుల్ శోధన ద్వారా మూలాలు:",
      loadingText: "లైవ్ వాతావరణ శోధన జరుగుతోంది...",
      errorText: "వాతావరణ డేటాను పొందడం విఫలమైంది.",
      caution: "హెచ్చరిక సలహా",
      normal: "సాధారణ పరిస్థితులు",
      severe: "తీవ్రమైన వాతావరణ హెచ్చరిక"
    }
  }[language] || {
    title: "Local Weather & Civic Impact",
    searchPlaceholder: "Search city...",
    humidity: "Humidity",
    wind: "Wind",
    civicAlert: "Civic Impact Advisory",
    sources: "Sources via Google Search:",
    loadingText: "Grounding live weather search...",
    errorText: "Failed to retrieve grounded weather data.",
    caution: "Caution Advisory",
    normal: "Conditions Normal",
    severe: "Severe Weather Warning"
  };

  const fetchWeather = async (targetCity: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/gemini/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: targetCity })
      });
      if (!response.ok) {
        throw new Error("Failed to fetch");
      }
      const data = await response.json();
      setWeather(data);
      setCity(data.city || targetCity);
    } catch (err) {
      console.error(err);
      setError(weatherT.errorText);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather(city);
  }, []);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      fetchWeather(searchVal.trim());
    }
  };

  // Weather icon mapper
  const getWeatherIcon = (condition: string) => {
    const cond = (condition || "").toLowerCase();
    if (cond.includes("rain") || cond.includes("shower") || cond.includes("drizzle")) {
      return <CloudRain className="w-10 h-10 text-blue-500" />;
    }
    if (cond.includes("thunder") || cond.includes("storm") || cond.includes("lightning")) {
      return <CloudLightning className="w-10 h-10 text-purple-600" />;
    }
    if (cond.includes("cloud") || cond.includes("overcast") || cond.includes("haze") || cond.includes("mist")) {
      return <Cloud className="w-10 h-10 text-slate-400" />;
    }
    if (cond.includes("sunny") || cond.includes("clear")) {
      return <Sun className="w-10 h-10 text-amber-500 animate-spin-slow" />;
    }
    return <Thermometer className="w-10 h-10 text-rose-500" />;
  };

  // Severity color mapping
  const severityStyles = (severity: string) => {
    const s = (severity || "").toLowerCase();
    if (s.includes("severe")) {
      return {
        bg: "bg-red-50 border-red-200 text-red-900",
        alertBg: "bg-red-600 text-white",
        badge: "bg-red-100 text-red-700 border-red-300",
        icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
        label: weatherT.severe
      };
    }
    if (s.includes("caution") || s.includes("warning")) {
      return {
        bg: "bg-amber-50 border-amber-200 text-amber-900",
        alertBg: "bg-amber-500 text-white",
        badge: "bg-amber-100 text-amber-800 border-amber-300",
        icon: <AlertTriangle className="w-4 h-4 text-amber-700" />,
        label: weatherT.caution
      };
    }
    return {
      bg: "bg-blue-50/50 border-blue-100/80 text-blue-900",
      alertBg: "bg-blue-600 text-white",
      badge: "bg-green-50 text-green-700 border-green-200",
      icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
      label: weatherT.normal
    };
  };

  const style = weather ? severityStyles(weather.severity) : severityStyles("Normal");

  return (
    <div id="weather-widget-container" className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 tracking-tight uppercase">
              {weatherT.title}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Live Google Search Grounding
            </p>
          </div>
        </div>

        {/* Small City Search Form */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded-xl max-w-xs w-full sm:w-auto">
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder={weatherT.searchPlaceholder}
            className="bg-transparent border-none text-xs font-semibold px-2 py-1 outline-none w-full sm:w-28 text-slate-700 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition active:scale-95 flex items-center justify-center cursor-pointer"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>

      {loading && (
        <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs font-bold animate-pulse">{weatherT.loadingText}</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 p-4 rounded-2xl text-xs font-semibold flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => fetchWeather(city)}
            className="text-blue-600 hover:text-blue-800 font-bold underline"
          >
            Retry
          </button>
        </div>
      )}

      {weather && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Main Weather Metric Column */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-slate-50 rounded-2xl border border-slate-100">
                {getWeatherIcon(weather.condition)}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                  {weather.city}
                </span>
                <span className="text-3xl font-black text-slate-900 tracking-tighter">
                  {weather.temperature}
                </span>
                <span className="text-sm font-bold text-slate-600 block">
                  {weather.condition}
                </span>
              </div>
            </div>

            {/* Quick stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-center gap-2">
                <Droplets className="w-4 h-4 text-blue-500" />
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block leading-none">
                    {weatherT.humidity}
                  </span>
                  <span className="text-xs font-black text-slate-700 mt-0.5 block leading-none">
                    {weather.humidity}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-center gap-2">
                <Wind className="w-4 h-4 text-slate-500" />
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block leading-none">
                    {weatherT.wind}
                  </span>
                  <span className="text-xs font-black text-slate-700 mt-0.5 block leading-none">
                    {weather.wind}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Civic Advisory & Alerts Column */}
          <div className="md:col-span-7 space-y-4">
            {/* Status badge */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                {weatherT.civicAlert}
              </span>
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border flex items-center gap-1 ${style.badge}`}>
                {style.icon}
                {style.label}
              </span>
            </div>

            {/* Impact Advisory text block */}
            <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-2 font-semibold ${style.bg}`}>
              <p className="font-extrabold text-sm flex items-center gap-1.5">
                {style.icon}
                {weather.summary}
              </p>
              <p className="opacity-90 leading-relaxed pt-1 border-t border-slate-200/50">
                {weather.civicImpactAlert}
              </p>
            </div>

            {/* Citations and Grounding metadata links */}
            {weather.sources && weather.sources.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  {weatherT.sources}
                </span>
                <div className="flex flex-wrap gap-2">
                  {weather.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-lg text-[10px] text-blue-600 font-bold transition shadow-sm"
                    >
                      <span>{src.title.length > 20 ? `${src.title.substring(0, 18)}...` : src.title}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
