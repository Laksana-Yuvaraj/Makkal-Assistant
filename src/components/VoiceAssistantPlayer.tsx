import { useState, useEffect } from "react";
import { Volume2, VolumeX, Square, RotateCcw, Sparkles } from "lucide-react";
import { subscribeTTSState, stopSpeech, speakText, SupportedLanguage } from "../utils/textToSpeech";
import { TRANSLATIONS } from "../types";

interface VoiceAssistantPlayerProps {
  language: SupportedLanguage;
  autoSpeakEnabled: boolean;
  onToggleAutoSpeak: (enabled: boolean) => void;
}

export default function VoiceAssistantPlayer({
  language,
  autoSpeakEnabled,
  onToggleAutoSpeak
}: VoiceAssistantPlayerProps) {
  const t = TRANSLATIONS[language];
  const [ttsState, setTtsState] = useState<{
    isSpeaking: boolean;
    currentText: string;
    language: SupportedLanguage;
  }>({
    isSpeaking: false,
    currentText: "",
    language
  });

  const [lastSpokenText, setLastSpokenText] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeTTSState((state) => {
      setTtsState(state);
      if (state.currentText) {
        setLastSpokenText(state.currentText);
      }
    });
    return unsubscribe;
  }, []);

  const handleStop = () => {
    stopSpeech();
  };

  const handleReplay = () => {
    if (lastSpokenText) {
      speakText(lastSpokenText, language);
    }
  };

  if (!ttsState.isSpeaking && !lastSpokenText) {
    return null;
  }

  // If not currently speaking, show a compact unobtrusive replay pill if there was recent speech
  if (!ttsState.isSpeaking) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-lg rounded-full px-3 py-1.5 transition-all duration-300 hover:shadow-xl text-xs">
        <button
          type="button"
          onClick={handleReplay}
          className="flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-bold cursor-pointer"
          title="Replay last assistant message"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{language === "ta" ? "மீண்டும் கேள்" : language === "hi" ? "फिर से सुनें" : language === "te" ? "మళ్లీ వినండి" : "Replay Audio"}</span>
        </button>

        <span className="text-slate-300">|</span>

        <button
          type="button"
          onClick={() => onToggleAutoSpeak(!autoSpeakEnabled)}
          className={`flex items-center gap-1 font-semibold cursor-pointer ${
            autoSpeakEnabled ? "text-emerald-700" : "text-slate-500"
          }`}
          title={autoSpeakEnabled ? "Auto-speak enabled" : "Auto-speak muted"}
        >
          {autoSpeakEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
          <span>{autoSpeakEnabled ? "Voice ON" : "Voice Muted"}</span>
        </button>
      </div>
    );
  }

  // Active speaking banner with animated waveform & caption
  return (
    <div
      id="voice-assistant-active-player"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 bg-slate-900 text-white shadow-2xl rounded-3xl p-4 border border-blue-500/40 backdrop-blur-xl animate-fade-in"
    >
      <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400">
            <Volume2 className="w-4 h-4 animate-bounce" />
            <span className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping"></span>
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-blue-400 uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              {language === "ta" ? "குரல் உதவியாளர் பேசுகிறது" : 
               language === "hi" ? "वॉयस असिस्टेंट बोल रहा है" : 
               language === "te" ? "వాయిస్ అసిస్టెంట్ మాట్లాడుతోంది" : 
               "Civic Voice Assistant Speaking"}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {language.toUpperCase()} • {autoSpeakEnabled ? "Auto Readback" : "Manual"}
            </span>
          </div>
        </div>

        {/* Audio Equalizer Animated Bars */}
        <div className="flex items-end gap-0.5 h-4 px-2">
          <span className="w-1 bg-blue-400 rounded-full animate-pulse h-3"></span>
          <span className="w-1 bg-indigo-400 rounded-full animate-pulse h-4" style={{ animationDelay: "150ms" }}></span>
          <span className="w-1 bg-sky-400 rounded-full animate-pulse h-2" style={{ animationDelay: "300ms" }}></span>
          <span className="w-1 bg-blue-300 rounded-full animate-pulse h-4" style={{ animationDelay: "200ms" }}></span>
          <span className="w-1 bg-teal-400 rounded-full animate-pulse h-2.5" style={{ animationDelay: "100ms" }}></span>
        </div>

        {/* Stop button */}
        <button
          type="button"
          onClick={handleStop}
          className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
          title="Stop reading aloud"
        >
          <Square className="w-3 h-3 fill-current" />
          <span>{language === "ta" ? "நிறுத்து" : language === "hi" ? "रोकें" : language === "te" ? "ఆపు" : "Stop"}</span>
        </button>
      </div>

      {/* Live caption/subtitle */}
      <p className="text-xs text-slate-200 leading-relaxed font-medium bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/50">
        "{ttsState.currentText}"
      </p>
    </div>
  );
}
