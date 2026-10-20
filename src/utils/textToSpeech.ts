import { Complaint, ComplaintStatus, Official } from "../types";

export type SupportedLanguage = "en" | "hi" | "ta" | "te";

// BCP 47 locale codes for speech synthesis
export const LOCALE_MAP: Record<SupportedLanguage, string[]> = {
  en: ["en-IN", "en-GB", "en-US", "en"],
  hi: ["hi-IN", "hi"],
  ta: ["ta-IN", "ta-LK", "ta"],
  te: ["te-IN", "te"]
};

// Play a gentle audio cue tone before assistant speaks to alert user
function playChimeTone() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Pleasant dual chime sequence
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // AudioContext might be restricted until user interaction
  }
}

// Global active utterance reference to prevent Chrome garbage-collection bug
let activeUtterance: SpeechSynthesisUtterance | null = null;
let keepAliveTimer: any = null;

// Event listeners for voice state
type TTSStateListener = (state: { isSpeaking: boolean; currentText: string; language: SupportedLanguage }) => void;
const stateListeners = new Set<TTSStateListener>();

let currentState: { isSpeaking: boolean; currentText: string; language: SupportedLanguage } = {
  isSpeaking: false,
  currentText: "",
  language: "en"
};

function notifyListeners() {
  stateListeners.forEach((listener) => {
    try {
      listener({ ...currentState });
    } catch (e) {
      console.warn("TTS listener error:", e);
    }
  });
}

export function subscribeTTSState(listener: TTSStateListener): () => void {
  stateListeners.add(listener);
  // Send current state immediately
  listener({ ...currentState });
  return () => {
    stateListeners.delete(listener);
  };
}

// Get loaded voices from browser
let availableVoices: SpeechSynthesisVoice[] = [];
function updateVoices() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    availableVoices = window.speechSynthesis.getVoices();
  }
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  updateVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    updateVoices();
  };
}

// Best matching voice picker for a language
export function pickVoiceForLanguage(lang: SupportedLanguage): SpeechSynthesisVoice | null {
  if (availableVoices.length === 0) {
    updateVoices();
  }
  const locales = LOCALE_MAP[lang] || ["en-IN", "en-US"];

  // 1. Try exact match on language code
  for (const locale of locales) {
    const match = availableVoices.find(
      (v) => v.lang.toLowerCase() === locale.toLowerCase() || v.lang.toLowerCase().replace("_", "-") === locale.toLowerCase()
    );
    if (match) return match;
  }

  // 2. Try prefix match (e.g. "ta", "hi", "te", "en")
  for (const locale of locales) {
    const prefix = locale.split("-")[0];
    const match = availableVoices.find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (match) return match;
  }

  // 3. Fallback to default or Indian English voice
  const indianEn = availableVoices.find((v) => v.lang.toLowerCase().includes("en-in"));
  if (indianEn) return indianEn;

  return availableVoices[0] || null;
}

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  playChime?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

/**
 * Main TTS speak function: speaks text in the target language
 */
export function speakText(text: string, language: SupportedLanguage, options?: SpeakOptions): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    console.warn("Web SpeechSynthesis API not supported in this environment.");
    return false;
  }

  // Stop any ongoing speech
  stopSpeech();

  if (!text || text.trim() === "") return false;

  const cleanText = text.trim();

  // Play chime if requested
  if (options?.playChime !== false) {
    playChimeTone();
  }

  try {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    activeUtterance = utterance;

    // Set language and voice
    const voice = pickVoiceForLanguage(language);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = LOCALE_MAP[language][0] || "en-IN";
    }

    // Rate: gentle pace (0.92) for high intelligibility across local accents
    utterance.rate = options?.rate ?? (language === "en" ? 0.95 : 0.9);
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.volume = options?.volume ?? 1.0;

    utterance.onstart = () => {
      currentState = {
        isSpeaking: true,
        currentText: cleanText,
        language
      };
      notifyListeners();
      if (options?.onStart) options.onStart();

      // Chrome speech timeout workaround: periodically resume if synthesis pauses
      clearInterval(keepAliveTimer);
      keepAliveTimer = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          clearInterval(keepAliveTimer);
        }
      }, 10000);
    };

    utterance.onend = () => {
      clearInterval(keepAliveTimer);
      activeUtterance = null;
      currentState = {
        isSpeaking: false,
        currentText: "",
        language
      };
      notifyListeners();
      if (options?.onEnd) options.onEnd();
    };

    utterance.onerror = (e) => {
      // Don't treat user-interrupted cancellations as fatal errors
      if (e.error !== "canceled" && e.error !== "interrupted") {
        console.warn("Speech synthesis utterance error:", e);
      }
      clearInterval(keepAliveTimer);
      activeUtterance = null;
      currentState = {
        isSpeaking: false,
        currentText: "",
        language
      };
      notifyListeners();
      if (options?.onError) options.onError(e);
    };

    // Speak!
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.error("Failed to start speech synthesis:", err);
    currentState = {
      isSpeaking: false,
      currentText: "",
      language
    };
    notifyListeners();
    return false;
  }
}

/**
 * Cancel/stop any ongoing speech synthesis immediately
 */
export function stopSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  clearInterval(keepAliveTimer);
  activeUtterance = null;
  if (currentState.isSpeaking) {
    currentState = {
      isSpeaking: false,
      currentText: "",
      language: currentState.language
    };
    notifyListeners();
  }
}

export function isCurrentlySpeaking(): boolean {
  return currentState.isSpeaking;
}

// -------------------------------------------------------------
// Localized Assistant Speech Generators for Confirmation & Status Updates
// -------------------------------------------------------------

/**
 * Generate assistant confirmation speech text when a complaint is created
 */
export function getComplaintSubmittedSpeech(
  complaint: { id: string; issueCategory: string; ward: string },
  language: SupportedLanguage,
  officerName?: string
): string {
  const shortId = complaint.id.split("-")[1] || complaint.id;
  const officer = officerName ? `Officer ${officerName}` : "your ward officer";

  switch (language) {
    case "hi":
      return `आपकी ${complaint.issueCategory} की शिकायत सफलतापूर्वक दर्ज हो गई है। टिकट नंबर है ${shortId}। इसे ${complaint.ward} के अधिकारी ${officerName || "वार्ड अधिकारी"} को सौंप दिया गया है। जैसे ही काम शुरू होगा, आपको सूचित कर दिया जाएगा।`;
    case "ta":
      return `உங்கள் ${complaint.issueCategory} புகார் வெற்றிகரமாக பதிவு செய்யப்பட்டது. உங்கள் புகார் எண் ${shortId}. இது ${complaint.ward} அதிகாரி ${officerName || "வார்டு அதிகாரி"} அவர்களிடம் ஒப்படைக்கப்பட்டுள்ளது. பணி தொடங்கும்போது உங்களுக்கு அறிவிக்கப்படும்.`;
    case "te":
      return `${complaint.issueCategory} కోసం మీ ఫిర్యాదు విజయవంతంగా నమోదు చేయబడింది. టికెట్ సంఖ్య ${shortId}. ఇది ${complaint.ward} అధికారి ${officerName || "వార్డు అధికారి"} గారికి కేటాయించబడింది. పని ప్రారంభం కాగానే మీకు సమాచారం అందుతుంది.`;
    case "en":
    default:
      return `Your complaint for ${complaint.issueCategory} has been successfully submitted! Ticket number is ${shortId}. Assigned to ${officer} for ${complaint.ward}. We will notify you with status updates.`;
  }
}

/**
 * Generate speech text for offline saved complaints
 */
export function getOfflineQueuedSpeech(language: SupportedLanguage): string {
  switch (language) {
    case "hi":
      return "इंटरनेट कनेक्शन उपलब्ध नहीं है। आपकी शिकायत फोन में सुरक्षित रूप से सहेज ली गई है और इंटरनेट आते ही स्वतः सबमिट हो जाएगी।";
    case "ta":
      return "இணைய இணைப்பு இல்லை. உங்கள் புகார் சாதனத்தில் பாதுகாப்பாக சேமிக்கப்பட்டுள்ளது, இணையம் கிடைத்ததும் தானாக சமர்ப்பிக்கப்படும்.";
    case "te":
      return "ఇంటర్నెట్ కనెక్షన్ లేదు. మీ ఫిర్యాదు పరికరంలో భద్రపరచబడింది మరియు ఇంటర్నెట్ రాగానే స్వయంచాలకంగా సమర్పించబడుతుంది.";
    case "en":
    default:
      return "No internet connection detected. Your report is saved safely on your device and will be auto-submitted as soon as internet returns.";
  }
}

/**
 * Generate speech text when a complaint status changes in real-time
 */
export function getStatusUpdateSpeech(
  complaint: Complaint,
  newStatus: ComplaintStatus,
  language: SupportedLanguage
): string {
  const shortId = complaint.id.split("-")[1] || complaint.id;

  switch (language) {
    case "hi": {
      let statusDetail = "";
      if (newStatus === ComplaintStatus.ASSIGNED) statusDetail = "अधिकारी को सौंप दिया गया है और निरीक्षण जल्द होगा।";
      else if (newStatus === ComplaintStatus.IN_PROGRESS) statusDetail = "मरम्मत का काम प्रगति पर है और फील्ड टीम मौके पर है।";
      else if (newStatus === ComplaintStatus.PROOF_UPLOADED || newStatus === ComplaintStatus.PENDING_VERIFICATION)
        statusDetail = "मरम्मत का प्रमाण फोटो अपलोड हो चुका है। कृपया ऐप खोलकर समाधान की पुष्टि करें।";
      else if (newStatus === ComplaintStatus.CLOSED) statusDetail = "सत्यापित कर सफलतापूर्वक बंद कर दिया गया है।";
      else if (newStatus === ComplaintStatus.REOPENED) statusDetail = "पुनः निरीक्षण के लिए फिर से खोल दिया गया है।";
      else statusDetail = `स्थिति बदलकर ${newStatus} हो गई है।`;

      return `स्थिति अपडेट: ${complaint.issueCategory} के टिकट संख्या ${shortId} की ${statusDetail}`;
    }
    case "ta": {
      let statusDetail = "";
      if (newStatus === ComplaintStatus.ASSIGNED) statusDetail = "அதிகாரிக்கு ஒதுக்கப்பட்டுள்ளது, விரைவில் ஆய்வு செய்யப்படும்.";
      else if (newStatus === ComplaintStatus.IN_PROGRESS) statusDetail = "பழுதுபார்க்கும் பணி தீவிரமாக நடைபெற்று வருகிறது.";
      else if (newStatus === ComplaintStatus.PROOF_UPLOADED || newStatus === ComplaintStatus.PENDING_VERIFICATION)
        statusDetail = "அதிகாரி பழுதுபார்ப்பு சான்று புகைப்படத்தை பதிவேற்றியுள்ளார். தயவுசெய்து சரிபார்த்து உறுதிப்படுத்தவும்.";
      else if (newStatus === ComplaintStatus.CLOSED) statusDetail = "தீர்வு செய்யப்பட்டு வெற்றிகரமாக மூடப்பட்டது.";
      else if (newStatus === ComplaintStatus.REOPENED) statusDetail = "மறு ஆய்வுக்கு மீண்டும் திறக்கப்பட்டுள்ளது.";
      else statusDetail = `நிலை இப்போது ${newStatus} ஆக உள்ளது.`;

      return `நிலை புதுப்பிப்பு: ${complaint.issueCategory} தொடர்பான புகார் எண் ${shortId}. ${statusDetail}`;
    }
    case "te": {
      let statusDetail = "";
      if (newStatus === ComplaintStatus.ASSIGNED) statusDetail = "అధికారికి కేటాయించబడింది మరియు త్వరలో పరిశీలించబడుతుంది.";
      else if (newStatus === ComplaintStatus.IN_PROGRESS) statusDetail = "మరమ్మతు పని పురోగతిలో ఉంది మరియు సిబ్బంది స్థలంలో ఉన్నారు.";
      else if (newStatus === ComplaintStatus.PROOF_UPLOADED || newStatus === ComplaintStatus.PENDING_VERIFICATION)
        statusDetail = "అధికారి మరమ్మతు రుజువు ఫోటోను అప్‌లోడ్ చేశారు. దయచేసి పరిశీలించి ధృవీకరించండి.";
      else if (newStatus === ComplaintStatus.CLOSED) statusDetail = "పరిష్కరించబడి విజయవంతంగా మూసివేయబడింది.";
      else if (newStatus === ComplaintStatus.REOPENED) statusDetail = "తిరిగి పరిశీలన కోసం మళ్లీ తెరవబడింది.";
      else statusDetail = `స్థితి ఇప్పుడు ${newStatus} కు మారింది.`;

      return `స్థితి నవీకరణ: ${complaint.issueCategory} కి సంబంధించిన టికెట్ సంఖ్య ${shortId}. ${statusDetail}`;
    }
    case "en":
    default: {
      let statusDetail = "";
      if (newStatus === ComplaintStatus.ASSIGNED) statusDetail = "has been assigned to your ward officer for on-site inspection.";
      else if (newStatus === ComplaintStatus.IN_PROGRESS) statusDetail = "is now in progress. The municipal repair crew is working at the location.";
      else if (newStatus === ComplaintStatus.PROOF_UPLOADED || newStatus === ComplaintStatus.PENDING_VERIFICATION)
        statusDetail = "repair proof has been uploaded by the officer! Please review the photo to confirm resolution.";
      else if (newStatus === ComplaintStatus.CLOSED) statusDetail = "has been verified and officially closed. Thank you!";
      else if (newStatus === ComplaintStatus.REOPENED) statusDetail = "has been reopened and escalated for urgent re-inspection.";
      else statusDetail = `is now ${newStatus}.`;

      return `Status update for Ticket #${shortId}, ${complaint.issueCategory}: It ${statusDetail}`;
    }
  }
}

/**
 * Generate full speech readout of a complaint (for "Listen to Status" button)
 */
export function getComplaintFullReadout(
  complaint: Complaint,
  language: SupportedLanguage,
  officer?: Official | null
): string {
  const shortId = complaint.id.split("-")[1] || complaint.id;
  const officerName = officer?.name || complaint.ward;

  switch (language) {
    case "hi":
      return `टिकट संख्या ${shortId}। समस्या: ${complaint.issueCategory}। वर्तमान स्थिति: ${complaint.status}। वार्ड: ${complaint.ward}। नियुक्त अधिकारी: ${officerName}। विवरण: ${complaint.description}`;
    case "ta":
      return `புகார் எண் ${shortId}. பிரச்சனை: ${complaint.issueCategory}. தற்போதைய நிலை: ${complaint.status}. வார்டு: ${complaint.ward}. பொறுப்பு அதிகாரி: ${officerName}. புகார் விவரம்: ${complaint.description}`;
    case "te":
      return `టికెట్ సంఖ్య ${shortId}. సమస్య: ${complaint.issueCategory}. ప్రస్తుత స్థితి: ${complaint.status}. వార్డు: ${complaint.ward}. కేటాయించిన అధికారి: ${officerName}. వివరాలు: ${complaint.description}`;
    case "en":
    default:
      return `Ticket number ${shortId}. Category: ${complaint.issueCategory}. Current status: ${complaint.status}. Ward: ${complaint.ward}. Responsible officer: ${officerName}. Description: ${complaint.description}`;
  }
}

/**
 * Generate speech text for resolution approval / reopening feedback
 */
export function getCitizenResolutionSpeech(
  approved: boolean,
  ticketId: string,
  language: SupportedLanguage
): string {
  const shortId = ticketId.split("-")[1] || ticketId;
  if (approved) {
    switch (language) {
      case "hi":
        return `पुष्टि करने के लिए धन्यवाद! टिकट संख्या ${shortId} का समाधान सत्यापित हो गया है और इसे बंद कर दिया गया है।`;
      case "ta":
        return `உறுதிப்படுத்தியதற்கு நன்றி! புகார் எண் ${shortId} வெற்றிகரமாக சரிபார்க்கப்பட்டு மூடப்பட்டது.`;
      case "te":
        return `ధృవీకరించినందుకు ధన్యవాదాలు! టికెట్ సంఖ్య ${shortId} ధృవీకరించబడి విజయవంతంగా మూసివేయబడింది.`;
      case "en":
      default:
        return `Thank you for confirming! Ticket number ${shortId} has been verified and successfully closed.`;
    }
  } else {
    switch (language) {
      case "hi":
        return `टिकट संख्या ${shortId} आपकी प्रतिक्रिया के साथ फिर से खोल दिया गया है। संबंधित अधिकारी को पुनः निरीक्षण के लिए सूचित कर दिया गया है।`;
      case "ta":
        return `புகார் எண் ${shortId} உங்கள் கருத்துக்களுடன் மீண்டும் திறக்கப்பட்டுள்ளது. விரைவான மறு ஆய்வுக்கு அதிகாரிக்கு தகவல் அனுப்பப்பட்டுள்ளது.`;
      case "te":
        return `మీ ఫీడ్‌బ్యాక్‌తో టికెట్ సంఖ్య ${shortId} తిరిగి తెరవబడింది. పునఃపరిశీలన కోసం అధికారికి సమాచారం పంపబడింది.`;
      case "en":
      default:
        return `Ticket number ${shortId} has been reopened with your feedback. The assigned officer has been notified for urgent re-inspection.`;
    }
  }
}
