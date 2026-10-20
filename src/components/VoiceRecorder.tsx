import { useState, useEffect, useRef } from "react";
import { Mic, Square, Volume2, Sparkles, AlertCircle, HelpCircle } from "lucide-react";
import { TRANSLATIONS } from "../types";

interface VoiceRecorderProps {
  onTranscriptComplete: (transcript: string, originalText?: string) => void;
  language: "en" | "hi" | "ta" | "te";
}

// High-fidelity multi-language speech presets for easy illiterate-friendly demonstration and quick test flows
const PRESET_PHRASES = {
  en: [
    { label: "Water Leak Pipe", text: "There is a massive water leak outside our community garden. High pressure water is flooding the street." },
    { label: "No Water Supply", text: "We have not received any drinking water supply for the past three days in this block." },
    { label: "Dirty Smell Water", text: "The tap water is yellow and smells like dirty sewage water since yesterday evening." },
    { label: "Road Pothole Block", text: "Huge dangerous pothole on the main cross road is causing heavy traffic congestion and accidents." }
  ],
  hi: [
    { label: "पानी का रिसाव", text: "पार्क के मुख्य गेट के बाहर पानी का पाइप फट गया है, सड़क पर पानी बह रहा है।" },
    { label: "पानी नहीं आ रहा", text: "हमारे ब्लॉक में पिछले तीन दिनों से पीने के पानी की कोई सप्लाई नहीं आई है।" },
    { label: "गंदा पानी", text: "कल शाम से नल का पानी पीला आ रहा है और उसमें सीवेज की गंदी बदबू आ रही है।" },
    { label: "सड़क का गड्ढा", text: "मुख्य चौराहे पर एक बड़ा और खतरनाक गड्ढा है, जिससे गाड़ियां गिर रही हैं।" }
  ],
  ta: [
    { label: "நீர் கசிவு", text: "பூங்காவின் நுழைவாயில் அருகில் தண்ணீர் குழாய் உடைந்து பெருமளவில் வீணாகிறது." },
    { label: "தண்ணீர் வரவில்லை", text: "எங்கள் தெருவில் கடந்த மூன்று நாட்களாக குடிநீர் விநியோகம் முற்றிலும் நிறுத்தப்பட்டுள்ளது." },
    { label: "அசுத்தமான நீர்", text: "குடிநீர் மிகவும் மஞ்சள் நிறத்தில் சாக்கடை கலந்த வாசனையுடன் வருகிறது." },
    { label: "சாலை பள்ளம்", text: "பிரதான சாலையில் உள்ள பெரிய பள்ளத்தால் மக்கள் கீழே விழுந்து விபத்துக்குள்ளாகிறார்கள்." }
  ],
  te: [
    { label: "నీటి లీకేజీ", text: "మా కాలనీ మెయిన్ రోడ్డు వద్ద నీటి పైపు పగిలిపోయి విపరీతంగా నీరు వృధా అవుతోంది." },
    { label: "నీటి సరఫరా లేదు", text: "మా వీధిలో గత మూడు రోజులుగా తాగునీటి సరఫరా పూర్తిగా నిలిచిపోయింది." },
    { label: "కలుషిత నీరు", text: "ట్యాప్ లో వచ్చే నీరు చాలా మురికిగా మరియు మురుగు వాసనతో వస్తోంది." },
    { label: "రోడ్డు గుంత", text: "మెయిన్ రోడ్డు లో ఒక ప్రమాదకరమైన పెద్ద గుంత ఉంది, ప్రయాణికులు ఇబ్బంది పడుతున్నారు." }
  ]
};

// Map languages to standard SpeechRecognition BCP 47 locale codes
const SPEECH_LOCALE_MAP = {
  en: "en-IN",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN"
};

export default function VoiceRecorder({ onTranscriptComplete, language }: VoiceRecorderProps) {
  const t = TRANSLATIONS[language];
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioWaves, setAudioWaves] = useState<number[]>(Array(12).fill(10));
  const [recognitionSupported, setRecognitionSupported] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any | null>(null);
  const waveAnimationRef = useRef<number | null>(null);

  // Initialize browser Web Speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRecognitionSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = SPEECH_LOCALE_MAP[language] || "en-IN";

    recognition.onstart = () => {
      setIsRecording(true);
      setErrorMsg(null);
      animateWaves();
    };

    recognition.onresult = (event: any) => {
      let finalStr = "";
      let interimStr = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript;
        } else {
          interimStr += event.results[i][0].transcript;
        }
      }

      if (finalStr) {
        setTranscript((prev) => prev + " " + finalStr);
      }
      setInterimTranscript(interimStr);
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setErrorMsg(t.micBlocked);
      } else {
        setErrorMsg(`Speech helper busy or unavailable: ${event.error}`);
      }
      stopRecordingSession();
    };

    recognition.onend = () => {
      setIsRecording(false);
      cancelWaveAnimation();
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      cancelWaveAnimation();
    };
  }, [language]);

  // Audio wave visualization loop
  function animateWaves() {
    waveAnimationRef.current = window.setInterval(() => {
      setAudioWaves(
        Array(14)
          .fill(0)
          .map(() => Math.floor(10 + Math.random() * 45))
      );
    }, 120);
  }

  function cancelWaveAnimation() {
    if (waveAnimationRef.current) {
      clearInterval(waveAnimationRef.current);
      waveAnimationRef.current = null;
    }
    setAudioWaves(Array(14).fill(12));
  }

  function startRecordingSession() {
    setTranscript("");
    setInterimTranscript("");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Speech Recognition start failed:", err);
        setErrorMsg("Failed to start voice listener. Try clicking a preset phrase!");
      }
    } else {
      // If Web Speech API not supported, mock dynamic recording session
      setIsRecording(true);
      setErrorMsg("Voice Input Active: Speak clearly or tap a fast-reporting phrase below.");
      animateWaves();
      // Simulate typing a message
      let counter = 0;
      const phrases = PRESET_PHRASES[language] || PRESET_PHRASES.en;
      const demoText = phrases[Math.floor(Math.random() * phrases.length)].text;
      const interval = setInterval(() => {
        if (counter < demoText.length) {
          setTranscript(demoText.substring(0, counter + 5));
          counter += 5;
        } else {
          clearInterval(interval);
          setIsRecording(false);
          cancelWaveAnimation();
        }
      }, 100);
    }
  }

  function stopRecordingSession() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
    cancelWaveAnimation();
  }

  function handleUsePreset(phraseText: string) {
    setTranscript(phraseText);
    onTranscriptComplete(phraseText);
  }

  function handleConfirmTranscript() {
    const finalText = (transcript + " " + interimTranscript).trim();
    if (finalText) {
      onTranscriptComplete(finalText);
    }
  }

  const currentPresets = PRESET_PHRASES[language] || PRESET_PHRASES.en;

  return (
    <div id="voice-recorder-box" className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800">
      <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-3">
        <h4 className="text-md font-bold flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-indigo-400" />
          {t.recordVoice}
        </h4>
        <span className="text-[10px] bg-indigo-950 text-indigo-400 font-mono px-2.5 py-1 rounded-full uppercase tracking-widest font-bold">
          {language.toUpperCase()} Voice-AI
        </span>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 bg-rose-950/40 border border-rose-900/30 text-rose-300 p-3.5 rounded-2xl mb-4 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Animated waveform container */}
      <div className="bg-slate-950 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[140px] mb-5 border border-slate-900 relative overflow-hidden">
        {isRecording ? (
          <div className="flex items-end justify-center gap-1.5 h-12 mb-4">
            {audioWaves.map((height, idx) => (
              <div
                key={idx}
                className="w-1 bg-indigo-500 rounded-full transition-all duration-100 ease-out"
                style={{ height: `${height}px` }}
              />
            ))}
          </div>
        ) : (
          <Mic className="w-12 h-12 text-slate-700 mb-2 animate-pulse" />
        )}

        <div className="text-center w-full max-w-md px-4">
          {transcript || interimTranscript ? (
            <p className="text-sm font-semibold text-slate-200 italic line-clamp-3">
              "{transcript} {interimTranscript}"
            </p>
          ) : (
            <p className="text-xs text-slate-500 font-medium">
              {isRecording ? t.listeningToVoice : t.voiceRecordingPlaceholder}
            </p>
          )}
        </div>
      </div>

      {/* Voice controls */}
      <div className="flex justify-center gap-4 mb-6">
        {isRecording ? (
          <button
            id="stop-voice-btn"
            type="button"
            onClick={stopRecordingSession}
            className="flex items-center gap-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3.5 px-8 rounded-2xl active:scale-95 transition text-sm cursor-pointer shadow-lg shadow-rose-950/20"
          >
            <Square className="w-4 h-4" />
            {t.stopRecord}
          </button>
        ) : (
          <button
            id="start-voice-btn"
            type="button"
            onClick={startRecordingSession}
            className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-4 px-10 rounded-2xl active:scale-95 transition text-md cursor-pointer shadow-lg shadow-indigo-950/30"
          >
            <Mic className="w-5 h-5" />
            {t.startSpeaking}
          </button>
        )}

        {(transcript || interimTranscript) && !isRecording && (
          <button
            id="confirm-voice-btn"
            type="button"
            onClick={handleConfirmTranscript}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-2xl active:scale-95 transition text-sm cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            {t.analyzeSubmit}
          </button>
        )}
      </div>

      {/* Illiterate/Low-literacy Friendly Preset Phrases */}
      <div className="border-t border-slate-800 pt-5">
        <h5 className="text-[11px] uppercase font-extrabold text-slate-500 mb-3 tracking-widest flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
          {t.lowLiteracyMode}
        </h5>
        <div className="grid grid-cols-2 gap-2.5">
          {currentPresets.map((phrase, idx) => (
            <button
              key={idx}
              id={`preset-phrase-${idx}`}
              type="button"
              onClick={() => handleUsePreset(phrase.text)}
              className="bg-slate-900/60 hover:bg-indigo-950/30 border border-slate-800 hover:border-indigo-900/50 p-3.5 rounded-2xl text-left text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
            >
              <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1 tracking-wider">
                {phrase.label}
              </p>
              <p className="line-clamp-2 leading-snug">{phrase.text}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
