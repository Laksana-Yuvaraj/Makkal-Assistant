import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { 
  Droplet, 
  MapPin, 
  MessageSquare, 
  Camera, 
  ArrowLeft, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Sparkles,
  Loader2,
  RefreshCw,
  Phone,
  Settings,
  X,
  Globe,
  Plus,
  Volume2,
  VolumeX
} from "lucide-react";
import { 
  IssueCategory, 
  ComplaintStatus, 
  Complaint, 
  Official, 
  UserSession, 
  TRANSLATIONS 
} from "./types";
import {
  speakText,
  stopSpeech,
  getComplaintSubmittedSpeech,
  getOfflineQueuedSpeech,
  getStatusUpdateSpeech,
  getComplaintFullReadout,
  getCitizenResolutionSpeech
} from "./utils/textToSpeech";
import VoiceAssistantPlayer from "./components/VoiceAssistantPlayer";
import IssueSelector from "./components/IssueSelector";
import OfficialContactCard from "./components/OfficialContactCard";
import CameraCapture from "./components/CameraCapture";
import VoiceRecorder from "./components/VoiceRecorder";
import ComplaintHistory from "./components/ComplaintHistory";
import OfficialDashboard from "./components/OfficialDashboard";
import WardAnalytics from "./components/WardAnalytics";
import TravelAlertHub from "./components/TravelAlertHub";
import WeatherWidget from "./components/WeatherWidget";
import OfflineWardMap from "./components/OfflineWardMap";
import { matchWardByCoordinates, wardLocations } from "./data/mockOfficials";

export default function App() {
  // Navigation / Routing State
  const [screen, setScreen] = useState<
    "splash" | "language" | "login" | "citizen_home" | "report_complaint" | "complaint_detail" | "official_dashboard"
  >("splash");

  // Language state
  const [language, setLanguage] = useState<"en" | "hi" | "ta" | "te">("en");
  const t = TRANSLATIONS[language];

  // User session state
  const [session, setSession] = useState<UserSession | null>(null);
  const [loginRole, setLoginRole] = useState<"citizen" | "official">("citizen");
  const [mobileNumber, setMobileNumber] = useState("");
  const [officialEmail, setOfficialEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Location tracking state
  const [currentLat, setCurrentLat] = useState<number>(13.0827); // Default Chennai, Tamil Nadu
  const [currentLng, setCurrentLng] = useState<number>(80.2707);
  const [locationDetected, setLocationDetected] = useState(false);
  const [locationMode, setLocationMode] = useState<"gps" | "manual">("gps");

  // Complaints and officials store states
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [officials, setOfficials] = useState<Official[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [matchedOfficial, setMatchedOfficial] = useState<Official | null>(null);

  // Offline support states
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineComplaints, setOfflineComplaints] = useState<Complaint[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");

  // Issue creation states
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory | null>(null);
  const [description, setDescription] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [complaintPhoto, setComplaintPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeInputMode, setActiveInputMode] = useState<"none" | "voice" | "camera">("none");

  // Feedback states for reopening
  const [reopenFeedback, setReopenFeedback] = useState("");
  const [showReopenBox, setShowReopenBox] = useState(false);

  // Text-To-Speech Voice Assistant preferences (persisted locally)
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("civic_auto_speak");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  // Virtual on-screen notifications for Sandbox environment OTPs and status alerts
  const [activeVirtualNotification, setActiveVirtualNotification] = useState<{
    type: "sms" | "email";
    title: string;
    message: string;
    code?: string;
    speechText?: string;
  } | null>(null);

  // Store previous statuses of complaints to detect changes
  const prevStatusesRef = useRef<Record<string, ComplaintStatus>>({});

  // Fetch location coordinates on mount
  useEffect(() => {
    let active = true;

    const fetchIPLocation = async () => {
      // Try ipinfo.io first as it is extremely stable and has reliable HTTPS endpoints
      try {
        const response = await fetch("https://ipinfo.io/json");
        if (response.ok && active) {
          const data = await response.json();
          if (data && data.loc) {
            const [latStr, lngStr] = data.loc.split(",");
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            if (!isNaN(lat) && !isNaN(lng)) {
              setCurrentLat(lat);
              setCurrentLng(lng);
              setLocationDetected(true);
              console.log("[Location] ipinfo.io Geolocation successful:", lat, lng);
              return true;
            }
          }
        }
      } catch (err) {
        console.warn("[Location] ipinfo.io Geolocation failed, trying ipapi.co fallback...", err);
      }

      // Try ipapi.co as secondary fallback
      try {
        const response = await fetch("https://ipapi.co/json/");
        if (response.ok && active) {
          const data = await response.json();
          if (data && typeof data.latitude === "number" && typeof data.longitude === "number") {
            setCurrentLat(data.latitude);
            setCurrentLng(data.longitude);
            setLocationDetected(true);
            console.log("[Location] ipapi.co Geolocation successful:", data.latitude, data.longitude);
            return true;
          }
        }
      } catch (err) {
        console.warn("[Location] ipapi.co Geolocation failed:", err);
      }
      return false;
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (active) {
            setCurrentLat(position.coords.latitude);
            setCurrentLng(position.coords.longitude);
            setLocationDetected(true);
            console.log("[Location] Browser GPS Geolocation successful:", position.coords.latitude, position.coords.longitude);
          }
        },
        async (err) => {
          console.warn("[Location] Browser GPS failed, trying IP fallback...", err);
          const success = await fetchIPLocation();
          if (!success && active) {
            // Keep default but log
            setLocationDetected(true);
          }
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      fetchIPLocation().then((success) => {
        if (!success && active) {
          setLocationDetected(true);
        }
      });
    }

    return () => {
      active = false;
    };
  }, []);

  // Listen to network changes for offline handling
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      triggerAutoSync();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check and load from local storage
    const cachedOffline = localStorage.getItem("civic_offline_complaints");
    if (cachedOffline) {
      setOfflineComplaints(JSON.parse(cachedOffline));
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch complaints and officials from the backend server with automatic real-time polling
  useEffect(() => {
    fetchOfficials();
    fetchComplaints();

    const intervalId = setInterval(() => {
      fetchComplaints();
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  // Sync closest ward officer as location updates
  useEffect(() => {
    if (officials.length > 0) {
      const match = matchWardByCoordinates(currentLat, currentLng);
      let officer: any = officials.find(o => o.id === match.officialId);
      
      if (!officer && match.officialId === "off-dynamic-local") {
        officer = {
          id: "off-dynamic-local",
          name: "District Civic Commissioner",
          email: "district-officer@civic-desk.gov.in",
          mobileNumber: "+91 99999 00000",
          officeHours: "09:30 AM - 05:30 PM",
          ward: match.ward,
          department: "Municipal Corporation & Sanitation/Water Resource Department",
          escalationOfficer: "District Collector / Municipal Secretariat",
          activeStatus: true
        };
      }
      
      if (!officer) {
        officer = officials[0];
      }
      
      setMatchedOfficial(officer);
    }
  }, [currentLat, currentLng, officials]);

  // Monitor complaint status updates to push beautiful toast notifications to the user
  useEffect(() => {
    if (complaints.length === 0) return;

    complaints.forEach((c) => {
      const prevStatus = prevStatusesRef.current[c.id];
      if (prevStatus && prevStatus !== c.status) {
        // Only trigger toast for citizens or if they are tracking their submitted ticket
        const isOwner = !session || (
          c.userId === session.userId || 
          (session.phoneNumber && c.phoneNumber === session.phoneNumber) || 
          (session.email && c.email?.toLowerCase().trim() === session.email.toLowerCase().trim())
        );

        if (isOwner || session.role === "citizen") {
          const getNiceStatusLabel = (status: string) => {
            switch (status) {
              case "submitted": return "Submitted 📝";
              case "assigned": return "Assigned to Ward Officer 👤";
              case "in_progress": return "In Progress ⚙️";
              case "proof_uploaded": return "Repair Proof Uploaded 📸";
              case "pending_verification": return "Pending Citizen Approval 🔍";
              case "closed": return "Closed & Resolved ✅";
              case "reopened": return "Reopened 🔴";
              default: return status;
            }
          };

          const statusSpeech = getStatusUpdateSpeech(c, c.status, language);
          if (autoSpeakEnabled) {
            speakText(statusSpeech, language);
          }

          setActiveVirtualNotification({
            type: "sms",
            title: language === "ta" ? "📢 நிலை புதுப்பிக்கப்பட்டது" : language === "hi" ? "📢 स्थिति अपडेट" : language === "te" ? "📢 స్థితి నవీకరణ" : "📢 Ticket Status Updated",
            message: `Your report for "${c.issueCategory}" (Ticket #${c.id.split("-")[1] || c.id}) has been updated from "${getNiceStatusLabel(prevStatus)}" to "${getNiceStatusLabel(c.status)}"!`,
            speechText: statusSpeech
          });
        }
      }
      
      // Keep track of current status
      prevStatusesRef.current[c.id] = c.status;
    });

    // Populate ref for any new complaints initially loaded
    complaints.forEach((c) => {
      if (!prevStatusesRef.current[c.id]) {
        prevStatusesRef.current[c.id] = c.status;
      }
    });
  }, [complaints, session]);

  async function fetchOfficials() {
    try {
      const res = await fetch("/api/officials");
      if (res.ok) {
        const data = await res.json();
        setOfficials(data);
      }
    } catch (err) {
      console.error("Error loading officials:", err);
    }
  }

  async function fetchComplaints() {
    try {
      const res = await fetch("/api/complaints");
      if (res.ok) {
        const data = await res.json();
        setComplaints(data);
      }
    } catch (err) {
      console.error("Error loading complaints:", err);
    }
  }

  // Auto sync offline complaints when online
  async function triggerAutoSync() {
    const cachedOffline = localStorage.getItem("civic_offline_complaints");
    if (!cachedOffline) return;

    const items: Complaint[] = JSON.parse(cachedOffline);
    if (items.length === 0) return;

    setSyncing(true);
    setSyncNotice(t.syncingText);

    try {
      const res = await fetch("/api/complaints/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaints: items })
      });

      if (res.ok) {
        setOfflineComplaints([]);
        localStorage.removeItem("civic_offline_complaints");
        setSyncNotice(t.syncedText);
        setTimeout(() => setSyncNotice(""), 3000);
        fetchComplaints(); // reload database
      }
    } catch (err) {
      console.error("Failed to sync offline complaints:", err);
      setSyncNotice("Sync failed. Will retry when connection stabilizes.");
    } finally {
      setSyncing(false);
    }
  }

  // CITIZEN: Submit a Complaint
  async function handleSubmitComplaint() {
    if (!selectedCategory) {
      alert("Please select an issue category.");
      return;
    }
    if (!complaintPhoto) {
      alert("Please capture a geotagged photo first.");
      return;
    }

    const payload = {
      userId: session?.userId || "user-temp-123",
      userName: session?.name || "Citizen Reporter",
      phoneNumber: session?.phoneNumber || "+91 99999 88888",
      email: session?.email || "",
      selectedLanguage: language,
      issueCategory: selectedCategory,
      description: description || voiceTranscript || "No written description provided.",
      voiceTranscription: voiceTranscript || "",
      complaintPhoto,
      latitude: currentLat,
      longitude: currentLng,
      urgencyScore: selectedCategory === IssueCategory.WATER_LEAK || selectedCategory === IssueCategory.DIRTY_WATER ? "High" : "Medium"
    };

    // If offline, save locally
    if (isOffline) {
      const offlineId = `offline-${Math.floor(100000 + Math.random() * 900000)}`;
      const match = matchWardByCoordinates(currentLat, currentLng);
      const officer = officials.find(o => o.id === match.officialId) || officials[0];

      const localComplaint: Complaint = {
        id: offlineId,
        userId: payload.userId,
        userName: payload.userName,
        phoneNumber: payload.phoneNumber,
        email: payload.email,
        selectedLanguage: payload.selectedLanguage,
        issueCategory: payload.issueCategory,
        description: payload.description,
        voiceTranscription: payload.voiceTranscription,
        complaintPhoto: payload.complaintPhoto,
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: `${match.ward}, Municipal Area`,
        ward: match.ward,
        assignedOfficialId: officer.id,
        assignedDepartment: officer.department,
        urgencyScore: payload.urgencyScore as "Low" | "Medium" | "High",
        status: ComplaintStatus.SUBMITTED,
        createdTime: new Date().toISOString(),
        updatedTime: new Date().toISOString(),
        citizenVerificationStatus: "pending",
        officerVerificationStatus: "pending"
      };

      const updatedOffline = [localComplaint, ...offlineComplaints];
      setOfflineComplaints(updatedOffline);
      localStorage.setItem("civic_offline_complaints", JSON.stringify(updatedOffline));
      
      // Clear reporting states
      resetReportingStates();
      const offlineMsg = getOfflineQueuedSpeech(language);
      if (autoSpeakEnabled) {
        speakText(offlineMsg, language);
      }
      setActiveVirtualNotification({
        type: "sms",
        title: language === "ta" ? "ஆஃப்லைனில் சேமிக்கப்பட்டது" : language === "hi" ? "ऑफ़लाइन सहेजा गया" : language === "te" ? "ఆఫ్‌లైన్‌లో సేవ్ చేయబడింది" : "Saved Offline",
        message: offlineMsg,
        speechText: offlineMsg
      });
      setScreen("citizen_home");
      return;
    }

    // Online submission
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const newTicket = await res.json();
        setComplaints((prev) => [newTicket, ...prev]);
        resetReportingStates();
        setScreen("citizen_home");

        // Assistant voice readback confirmation in user's selected language
        const speechMsg = getComplaintSubmittedSpeech(newTicket, language, matchedOfficial?.name);
        if (autoSpeakEnabled) {
          speakText(speechMsg, language);
        }

        setActiveVirtualNotification({
          type: "sms",
          title: language === "ta" ? "புகார் பதிவு செய்யப்பட்டது" : language === "hi" ? "शिकायत दर्ज हो गई" : language === "te" ? "ఫిర్యాదు నమోదైంది" : "Complaint Registered",
          message: speechMsg,
          speechText: speechMsg
        });
      } else {
        alert("Server returned error when filing complaint. Please try again.");
      }
    } catch (err) {
      console.error("Submission error:", err);
      alert("Failed to submit complaint. Saved offline.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // CITIZEN: Approve or Reject a Repair Proof
  async function handleCitizenVerify(approved: boolean) {
    if (!selectedComplaint) return;

    const payload = {
      citizenVerificationStatus: approved ? "approved" : "rejected",
      feedback: approved ? "Work approved by citizen" : reopenFeedback
    };

    try {
      const res = await fetch(`/api/complaints/${selectedComplaint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        // Sync local list
        setComplaints((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setSelectedComplaint(updated);
        setShowReopenBox(false);
        setReopenFeedback("");

        // Assistant voice readback for resolution confirmation
        const resolutionSpeech = getCitizenResolutionSpeech(approved, selectedComplaint.id, language);
        if (autoSpeakEnabled) {
          speakText(resolutionSpeech, language);
        }

        setActiveVirtualNotification({
          type: "sms",
          title: approved 
            ? (language === "ta" ? "தீர்வு உறுதி செய்யப்பட்டது" : language === "hi" ? "समाधान की पुष्टि हुई" : language === "te" ? "పరిష్కారం ధృవీకరించబడింది" : "Resolution Confirmed")
            : (language === "ta" ? "புகார் மீண்டும் திறக்கப்பட்டது" : language === "hi" ? "शिकायत पुनः खोली गई" : language === "te" ? "ఫిర్యాదు తిరిగి తెరవబడింది" : "Ticket Reopened"),
          message: resolutionSpeech,
          speechText: resolutionSpeech
        });
      }
    } catch (err) {
      console.error("Error confirming resolution:", err);
    }
  }

  // OFFICIAL: Update a complaint status or upload proof
  async function handleOfficialUpdate(id: string, updates: Partial<Complaint>) {
    try {
      const res = await fetch(`/api/complaints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        const updated = await res.json();
        setComplaints((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        if (selectedComplaint?.id === id) {
          setSelectedComplaint(updated);
        }
      }
    } catch (err) {
      console.error("Official update error:", err);
    }
  }

  // OFFICIAL: Update official profile settings
  async function handleOfficialSettingsUpdate(id: string, updates: Partial<Official>) {
    try {
      const res = await fetch(`/api/officials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        const updated = await res.json();
        setOfficials((prev) => prev.map((o) => (o.id === id ? updated : o)));
        if (session?.officialId === id) {
          setSession((prev) => prev ? { ...prev, name: updated.name, phoneNumber: updated.mobileNumber } : null);
        }
      }
    } catch (err) {
      console.error("Error saving official details:", err);
    }
  }

  // Trigger voice transcription analyzer with Gemini
  async function handleVoiceTranscriptComplete(text: string) {
    setVoiceTranscript(text);
    setActiveInputMode("none");

    // Call server API which integrates Gemini AI for analysis
    try {
      const res = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, localLanguage: language })
      });

      if (res.ok) {
        const analysis = await res.json();
        setSelectedCategory(analysis.category as IssueCategory);
        setDescription(analysis.polishedDescription);
        
        // Open reporting screen automatically!
        setScreen("report_complaint");
      }
    } catch (err) {
      console.error("Error calling Gemini speech analysis endpoint:", err);
      // fallback
      setDescription(text);
      setScreen("report_complaint");
    }
  }

  function handlePhotoCaptured(photoBase64: string, lat: number, lng: number) {
    setComplaintPhoto(photoBase64);
    setCurrentLat(lat);
    setCurrentLng(lng);
    setActiveInputMode("none");
    setScreen("report_complaint");
  }

  function resetReportingStates() {
    setSelectedCategory(null);
    setDescription("");
    setVoiceTranscript("");
    setComplaintPhoto(null);
    setActiveInputMode("none");
    setLocationMode("gps");
  }

  // SECURE ASYNC OTP LOGIN HANDLER (Connects to live server OTP endpoints)
  async function handleLogin() {
    setLoginError("");

    if (loginRole === "citizen") {
      if (!mobileNumber || mobileNumber.length < 10) {
        setLoginError("Please enter a valid 10-digit mobile number.");
        return;
      }

      if (!otpSent) {
        try {
          const res = await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumber: mobileNumber, role: "citizen" })
          });
          const data = await res.json();
          if (res.ok) {
            setOtpSent(true);
            if (data.otp) {
              setActiveVirtualNotification({
                type: "sms",
                title: "💬 SMS Received",
                message: `Govt. of India / Municipal Water Desk: Your security verification code is:`,
                code: data.otp
              });
            }
          } else {
            setLoginError(data.error || "Failed to generate OTP.");
          }
        } catch (err) {
          setLoginError("Communication failure. Falling back to offline sandbox mode.");
          setOtpSent(true);
        }
        return;
      }

      if (!otpCode) {
        setLoginError("Please enter the 4-digit verification code.");
        return;
      }

      try {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: mobileNumber, code: otpCode })
        });
        const data = await res.json();
        if (res.ok) {
          setSession({
            userId: `citizen-${Math.floor(1000 + Math.random() * 9000)}`,
            role: "citizen",
            phoneNumber: mobileNumber,
            name: "Citizen User",
            language
          });
          setScreen("citizen_home");
          setOtpSent(false);
          setOtpCode("");
          setActiveVirtualNotification(null); // Close simulated SMS alert
        } else {
          setLoginError(data.error || "Invalid verification code.");
        }
      } catch (err) {
        // Fallback for offline access
        if (otpCode === "1234" || otpCode.length === 4) {
          setSession({
            userId: `citizen-offline-${Math.floor(1000 + Math.random() * 9000)}`,
            role: "citizen",
            phoneNumber: mobileNumber,
            name: "Citizen User (Offline Mode)",
            language
          });
          setScreen("citizen_home");
          setOtpSent(false);
          setOtpCode("");
          setActiveVirtualNotification(null);
        } else {
          setLoginError("Invalid verification code (Sandbox master key is 1234).");
        }
      }
    } else {
      // Official login verification
      if (!officialEmail) {
        setLoginError("Please enter your official government email address.");
        return;
      }

      if (!otpSent) {
        try {
          const res = await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: officialEmail, role: "official" })
          });
          const data = await res.json();
          if (res.ok) {
            setOtpSent(true);
            if (data.otp) {
              setActiveVirtualNotification({
                type: "email",
                title: "📧 Official OTP Dispatch",
                message: `Govt. Official Portal: Security verification code sent to ${officialEmail.toLowerCase().trim()}:`,
                code: data.otp
              });
            }
          } else {
            setLoginError(data.error || "Failed to generate OTP.");
          }
        } catch (err) {
          setLoginError("Communication failure. Falling back to offline sandbox mode.");
          setOtpSent(true);
        }
        return;
      }

      if (!otpCode) {
        setLoginError("Please enter the 4-digit verification code.");
        return;
      }

      try {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: officialEmail, code: otpCode })
        });
        const data = await res.json();
        if (res.ok) {
          // Re-fetch updated list of officials to pull any auto-registered dynamic records
          const listRes = await fetch("/api/officials");
          let currentOfficialsList = officials;
          if (listRes.ok) {
            currentOfficialsList = await listRes.json();
            setOfficials(currentOfficialsList);
          }

          const foundOfficial = currentOfficialsList.find(o => o.email.toLowerCase() === officialEmail.trim().toLowerCase()) || {
            id: `staff-dynamic`,
            name: "Official Staff",
            mobileNumber: "+91 99999 99999",
            ward: "Ward 12 - Lakeview Sector"
          };

          setSession({
            userId: `staff-${foundOfficial.id}`,
            role: "official",
            phoneNumber: foundOfficial.mobileNumber,
            name: foundOfficial.name,
            officialId: foundOfficial.id,
            ward: foundOfficial.ward,
            language
          });
          setScreen("official_dashboard");
          setOtpSent(false);
          setOtpCode("");
          setActiveVirtualNotification(null); // Clear simulated banner
        } else {
          setLoginError(data.error || "Invalid verification code.");
        }
      } catch (err) {
        const foundOfficial = officials.find(o => o.email.toLowerCase() === officialEmail.trim().toLowerCase()) || {
          id: `staff-dynamic`,
          name: "Official Staff (Offline)",
          mobileNumber: "+91 99999 99999",
          ward: "Ward 12 - Lakeview Sector"
        };

        if (otpCode === "1234") {
          setSession({
            userId: `staff-${foundOfficial.id}`,
            role: "official",
            phoneNumber: foundOfficial.mobileNumber,
            name: foundOfficial.name,
            officialId: foundOfficial.id,
            ward: foundOfficial.ward,
            language
          });
          setScreen("official_dashboard");
          setOtpSent(false);
          setOtpCode("");
          setActiveVirtualNotification(null);
        } else {
          setLoginError("Invalid verification code (Sandbox master key is 1234).");
        }
      }
    }
  }

  function handleLogout() {
    setSession(null);
    setScreen("splash");
    resetReportingStates();
    setMobileNumber("");
    setOfficialEmail("");
  }

  return (
    <div id="civic-app-root" className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* SIMULATED VIRTUAL PHONE/SMS/EMAIL NOTIFICATION POPUP */}
      {activeVirtualNotification && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full bg-slate-900 text-white shadow-2xl rounded-2xl p-4 border border-slate-700/50 flex flex-col gap-2 animate-bounce-subtle">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-600 rounded-lg text-white">
                {activeVirtualNotification.type === "sms" ? (
                  <MessageSquare className="w-4 h-4 text-white" />
                ) : (
                  <Globe className="w-4 h-4 text-white" />
                )}
              </span>
              <span className="text-xs font-extrabold tracking-wider uppercase text-blue-400">
                {activeVirtualNotification.title}
              </span>
            </div>
            <button 
              type="button"
              onClick={() => setActiveVirtualNotification(null)}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-300">
              {activeVirtualNotification.message}
            </p>
            {activeVirtualNotification.speechText && (
              <div className="pt-1.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    speakText(activeVirtualNotification.speechText || activeVirtualNotification.message, language);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 hover:text-blue-100 border border-blue-500/30 rounded-lg text-[11px] font-bold transition cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{t.readStatus}</span>
                </button>
                <span className="text-[10px] text-slate-400 font-mono">{language.toUpperCase()} Voice</span>
              </div>
            )}
            {activeVirtualNotification.code && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-center mt-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verification Code:</span>
                <span className="text-base font-mono font-black text-blue-400 tracking-widest">
                  {activeVirtualNotification.code}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* GLOBAL BANNER FOR STATUS, OFFLINE NOTICE, AND SYNC STATUS */}
      {isOffline && (
        <div className="bg-amber-600 text-white py-2 px-4 text-xs font-bold text-center flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {t.offlineModeMsg}
        </div>
      )}

      {syncNotice && (
        <div className="bg-indigo-600 text-white py-2 px-4 text-xs font-extrabold text-center flex items-center justify-center gap-2 shadow-inner animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          {syncNotice}
        </div>
      )}

      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 md:px-8 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button 
            type="button"
            onClick={() => {
              if (session) {
                setScreen(session.role === "official" ? "official_dashboard" : "citizen_home");
              } else {
                setScreen("splash");
              }
            }}
            className="flex items-center gap-3 text-left cursor-pointer group"
          >
            <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-sm group-hover:scale-105 transition-transform">
              <Droplet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg md:text-xl tracking-tight text-blue-900">
                {t.appName}
              </h1>
              <p className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                {t.tagline}
              </p>
            </div>
          </button>

          {/* Quick Actions (Language and Switch User Settings) */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs font-semibold text-blue-800">
                GPS Active: {currentLat.toFixed(4)}° N
              </span>
            </div>

            {/* Voice Assistant Auto-Readback Toggle */}
            <button
              id="header-tts-toggle-btn"
              type="button"
              onClick={() => {
                const nextVal = !autoSpeakEnabled;
                setAutoSpeakEnabled(nextVal);
                try {
                  localStorage.setItem("civic_auto_speak", String(nextVal));
                } catch {}
                if (nextVal) {
                  const greeting = language === "ta" 
                    ? "குரல் உதவியாளர் செயல்படுத்தப்பட்டது. உங்கள் புகார்களின் நிலையை வாசிப்பேன்."
                    : language === "hi"
                    ? "वॉयस असिस्टेंट सक्रिय है। मैं आपकी शिकायतों की स्थिति पढ़कर सुनाऊंगा।"
                    : language === "te"
                    ? "వాయిస్ అసిస్టెంట్ ఆన్ చేయబడింది. నేను మీ ఫిర్యాదుల స్థితిని చదివి వినిపిస్తాను."
                    : "Civic Voice Assistant active. Confirmation messages and status updates will be read aloud.";
                  speakText(greeting, language);
                } else {
                  stopSpeech();
                }
              }}
              className={`border p-2.5 rounded-xl transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-sm ${
                autoSpeakEnabled
                  ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
              }`}
              title={autoSpeakEnabled ? t.voiceReadbackOn : t.voiceReadbackOff}
            >
              {autoSpeakEnabled ? (
                <Volume2 className="w-4 h-4 text-blue-600 animate-pulse" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
              <span className="hidden sm:inline">
                {autoSpeakEnabled ? "Voice ON" : "Voice OFF"}
              </span>
            </button>

            <button
              id="lang-select-popover"
              type="button"
              onClick={() => setScreen("language")}
              className="bg-slate-100 border border-slate-200 p-2.5 rounded-xl hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-sm"
              title={t.languageSelect}
            >
              <Globe className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">
                {language === "en" ? "English" : language === "hi" ? "हिन्दी" : language === "ta" ? "தமிழ்" : "తెలుగు"}
              </span>
            </button>

            {session && (
              <button
                id="header-logout-btn"
                type="button"
                onClick={handleLogout}
                className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 transition cursor-pointer"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN SCREEN CANVAS CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        
        {/* SCREEN 1: SPLASH & INTRO SCREEN */}
        {screen === "splash" && (
          <div id="splash-view" className="max-w-2xl mx-auto bg-white border border-slate-200 shadow-sm rounded-3xl p-6 md:p-12 text-center space-y-8 mt-4 md:mt-10">
            <div className="space-y-4">
              <div className="inline-block bg-blue-50 text-blue-600 p-5 rounded-full border border-blue-100 shadow-sm">
                <Droplet className="w-14 h-14" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                {t.onboardingTitle}
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
                {t.onboardingDesc}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto pt-4">
              <button
                id="btn-login-citizen"
                type="button"
                onClick={() => {
                  setLoginRole("citizen");
                  setScreen("login");
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl active:scale-95 transition-all text-sm text-center cursor-pointer shadow-sm"
              >
                {t.loginAsCitizen}
              </button>
              <button
                id="btn-login-official"
                type="button"
                onClick={() => {
                  setLoginRole("official");
                  setScreen("login");
                }}
                className="bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-6 rounded-xl active:scale-95 transition-all text-sm text-center cursor-pointer shadow-sm"
              >
                {t.loginAsOfficial}
              </button>
            </div>

            {/* Language switch link */}
            <div className="pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setScreen("language")}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 mx-auto transition"
              >
                <Globe className="w-3.5 h-3.5" />
                Change Language / भाषा बदलें / மொழி மாற்று / భాషను మార్చు
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 2: LANGUAGE SELECTION SCREEN */}
        {screen === "language" && (
          <div id="language-selection-view" className="max-w-md mx-auto bg-white border border-slate-200 shadow-sm rounded-3xl p-8 space-y-6 text-center mt-10">
            <h2 className="text-xl font-bold text-slate-900">{t.languageSelect}</h2>
            
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                id="lang-en-btn"
                type="button"
                onClick={() => {
                  setLanguage("en");
                  if (autoSpeakEnabled) {
                    speakText("English selected. Ready to assist.", "en");
                  }
                  setScreen(session ? (session.role === "official" ? "official_dashboard" : "citizen_home") : "splash");
                }}
                className={`py-3.5 px-5 rounded-xl border-2 font-bold transition text-sm cursor-pointer ${
                  language === "en" ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-100 hover:border-slate-200 text-slate-700"
                }`}
              >
                English
              </button>
              <button
                id="lang-hi-btn"
                type="button"
                onClick={() => {
                  setLanguage("hi");
                  if (autoSpeakEnabled) {
                    speakText("हिन्दी भाषा चुनी गई। सहायता के लिए तैयार।", "hi");
                  }
                  setScreen(session ? (session.role === "official" ? "official_dashboard" : "citizen_home") : "splash");
                }}
                className={`py-3.5 px-5 rounded-xl border-2 font-bold transition text-sm cursor-pointer ${
                  language === "hi" ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-100 hover:border-slate-200 text-slate-700"
                }`}
              >
                {t.hindi}
              </button>
              <button
                id="lang-ta-btn"
                type="button"
                onClick={() => {
                  setLanguage("ta");
                  if (autoSpeakEnabled) {
                    speakText("தமிழ் மொழி தேர்ந்தெடுக்கப்பட்டது. உங்களுக்கு உதவ தயார்.", "ta");
                  }
                  setScreen(session ? (session.role === "official" ? "official_dashboard" : "citizen_home") : "splash");
                }}
                className={`py-3.5 px-5 rounded-xl border-2 font-bold transition text-sm cursor-pointer ${
                  language === "ta" ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-100 hover:border-slate-200 text-slate-700"
                }`}
              >
                {t.tamil}
              </button>
              <button
                id="lang-te-btn"
                type="button"
                onClick={() => {
                  setLanguage("te");
                  if (autoSpeakEnabled) {
                    speakText("తెలుగు భాష ఎంపిక చేయబడింది. మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను.", "te");
                  }
                  setScreen(session ? (session.role === "official" ? "official_dashboard" : "citizen_home") : "splash");
                }}
                className={`py-3.5 px-5 rounded-xl border-2 font-bold transition text-sm cursor-pointer ${
                  language === "te" ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-100 hover:border-slate-200 text-slate-700"
                }`}
              >
                {t.telugu}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setScreen(session ? (session.role === "official" ? "official_dashboard" : "citizen_home") : "splash")}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 underline mt-4 cursor-pointer"
            >
              {t.back}
            </button>
          </div>
        )}

        {/* SCREEN 3: SECURE LOGIN SCREEN (CITIZEN OR STAFF) */}
        {screen === "login" && (
          <div id="login-view" className="max-w-md mx-auto bg-white border border-slate-200 shadow-sm rounded-3xl p-8 space-y-6 mt-10">
            <div className="flex items-center gap-2 mb-2">
              <button 
                type="button"
                onClick={() => setScreen("splash")}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-slate-800">
                {loginRole === "citizen" ? t.loginAsCitizen : t.loginAsOfficial}
              </h3>
            </div>

            {loginError && (
              <p className="text-xs bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl font-semibold">
                ⚠️ {loginError}
              </p>
            )}

            <div className="space-y-4">
              {loginRole === "citizen" ? (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1.5">
                    {t.enterMobile}
                  </label>
                  <input
                    id="input-citizen-phone"
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={mobileNumber}
                    disabled={otpSent}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-800"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1.5">
                    Enter Government Email Address
                  </label>
                  <input
                    id="input-staff-email"
                    type="email"
                    placeholder="e.g. rajendra.ward1@civicwater.gov.in"
                    value={officialEmail}
                    disabled={otpSent}
                    onChange={(e) => setOfficialEmail(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-800"
                  />
                </div>
              )}

              {otpSent && (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">
                    {t.otpPrompt}
                  </label>
                  <input
                    id="input-login-otp"
                    type="text"
                    maxLength={4}
                    placeholder="• • • •"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full p-3 text-center tracking-widest text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 block text-center font-bold">
                    {t.mockOtpAlert}
                  </span>
                </div>
              )}

              <button
                id="btn-login-submit"
                type="button"
                onClick={handleLogin}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl active:scale-95 transition-all text-sm cursor-pointer shadow-sm"
              >
                {otpSent ? t.verifyOTP : t.sendOTP}
              </button>
            </div>


          </div>
        )}

        {/* SCREEN 4: CITIZEN HOME PAGE */}
        {screen === "citizen_home" && (
          <div id="citizen-home-view" className="space-y-8 animate-fade-in">
            {/* Quick Action Ribbon & Welcome */}
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
                    How can we help you today?
                  </h2>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">
                    {matchedOfficial?.ward || "Auto-Tracking GPS Ward..."} • GPS Autotag Active
                  </p>
                </div>
                
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 self-start md:self-auto">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-xs font-semibold text-blue-800">
                    GPS Active: {matchedOfficial ? matchedOfficial.ward : "Resolving Coordinates..."}
                  </span>
                </div>
              </div>

              {/* Weather & Civic Impact Advisory Widget */}
              <WeatherWidget language={language} />

              {/* Citizen Large Feature Buttons: Talk or Snap to report */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <button
                  id="action-speak-report"
                  type="button"
                  onClick={() => setActiveInputMode(activeInputMode === "voice" ? "none" : "voice")}
                  className="group bg-blue-600 hover:bg-blue-700 h-44 rounded-3xl p-6 text-white flex flex-col items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all border-b-4 border-blue-800 cursor-pointer"
                >
                  <div className="bg-blue-500 p-3.5 rounded-full group-hover:scale-110 transition-transform">
                    <MessageSquare className="w-10 h-10" />
                  </div>
                  <div className="text-center">
                    <span className="block text-lg font-black tracking-wider">TALK TO REPORT</span>
                    <span className="text-blue-100 text-xs font-medium">Voice-first simplified entry</span>
                  </div>
                </button>

                <button
                  id="action-camera-report"
                  type="button"
                  onClick={() => setActiveInputMode(activeInputMode === "camera" ? "none" : "camera")}
                  className="group bg-slate-900 hover:bg-black h-44 rounded-3xl p-6 text-white flex flex-col items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all border-b-4 border-slate-700 cursor-pointer"
                >
                  <div className="bg-slate-800 p-3.5 rounded-full group-hover:scale-110 transition-transform">
                    <Camera className="w-10 h-10" />
                  </div>
                  <div className="text-center">
                    <span className="block text-lg font-black tracking-wider">SNAP TO REPORT</span>
                    <span className="text-slate-400 text-xs font-medium">Auto-geotag enabled camera</span>
                  </div>
                </button>
              </div>
            </div>

            {/* If active helper selected: displays inline recorder or camera */}
            {activeInputMode === "voice" && (
              <div className="animate-fade-in">
                <VoiceRecorder
                  onTranscriptComplete={handleVoiceTranscriptComplete}
                  language={language}
                />
              </div>
            )}

            {activeInputMode === "camera" && (
              <div className="animate-fade-in">
                <CameraCapture
                  onCapture={handlePhotoCaptured}
                  language={language}
                />
              </div>
            )}

            {/* Quick report category selector list */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                {t.quickAction}
              </h4>
              <IssueSelector
                selectedCategory={selectedCategory}
                onSelectCategory={(category) => {
                  setSelectedCategory(category);
                  setScreen("report_complaint");
                }}
                language={language}
              />
            </div>

            {/* Nearby matched Ward official contact card details */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                {t.nearbyOfficer}
              </h4>
              {matchedOfficial ? (
                <OfficialContactCard
                  official={matchedOfficial}
                  language={language}
                />
              ) : (
                <div className="bg-slate-100 p-4 rounded-3xl animate-pulse text-xs text-slate-400">
                  {t.wardLabel}
                </div>
              )}
            </div>

            {/* Ward Analytics and Community Performance Dashboard */}
            <WardAnalytics
              complaints={complaints}
              offlineComplaints={offlineComplaints}
              currentWard={matchedOfficial?.ward || "Ward 12 - Lakeview Sector"}
              language={language}
            />

            {/* Live Commuter Safety & Route Alert System */}
            <TravelAlertHub
              complaints={complaints}
              currentWard={matchedOfficial?.ward || "Ward 12 - Lakeview Sector"}
              language={language}
              onSendAlertNotification={(alert) => {
                setActiveVirtualNotification({
                  type: alert.type,
                  title: alert.title,
                  message: alert.message,
                  code: alert.code || "1234"
                });
              }}
            />

            {/* Complaint submission list */}
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                <span>{t.historyTitle}</span>
                <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                  {complaints.length + offlineComplaints.length} Total
                </span>
              </h4>
              
              <ComplaintHistory
                complaints={[...offlineComplaints, ...complaints]}
                onSelectComplaint={(c) => {
                  setSelectedComplaint(c);
                  setScreen("complaint_detail");
                }}
                language={language}
              />
            </div>
          </div>
        )}

        {/* SCREEN 5: REPORT A COMPLAINT FORM SCREEN */}
        {screen === "report_complaint" && (
          <div id="report-complaint-view" className="max-w-2xl mx-auto bg-white border border-slate-100 shadow-sm rounded-3xl p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <button
                type="button"
                onClick={() => {
                  resetReportingStates();
                  setScreen("citizen_home");
                }}
                className="p-1.5 rounded-xl hover:bg-slate-50 text-slate-500 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <span className="text-[9px] bg-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Report File
                </span>
                <h3 className="text-xl font-extrabold text-slate-800 mt-1">
                  New {selectedCategory || "Civic Complaint"} Report
                </h3>
              </div>
            </div>

            {/* Geotagging & Location Customization Panel */}
            <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-3xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                  📍 Map & Site Location Tagging
                </span>
                
                {/* Selector Tab Option */}
                <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setLocationMode("gps");
                      // Re-fetch current location if available
                      if ("geolocation" in navigator) {
                        navigator.geolocation.getCurrentPosition((pos) => {
                          setCurrentLat(pos.coords.latitude);
                          setCurrentLng(pos.coords.longitude);
                        });
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      locationMode === "gps" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    ⚡ Auto GPS
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationMode("manual")}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      locationMode === "manual" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    🎯 Manual Precision
                  </button>
                </div>
              </div>

              {/* Offline Interactive Map Component */}
              <OfflineWardMap
                latitude={currentLat}
                longitude={currentLng}
                onChange={(lat, lng) => {
                  setCurrentLat(lat);
                  setCurrentLng(lng);
                }}
                language={language}
              />

              {locationMode === "gps" ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse inline-block"></span>
                    Live GPS Geotag Active
                  </span>
                  <motion.span
                    key={`${currentLat.toFixed(5)}-${currentLng.toFixed(5)}-gps`}
                    initial={{ scale: 1.05, textShadow: "0 0 8px rgba(59, 130, 246, 0.4)", color: "#2563eb", borderColor: "#3b82f6" }}
                    animate={{ scale: 1, textShadow: "none", color: "#1e293b", borderColor: "#f1f5f9" }}
                    transition={{ duration: 0.4 }}
                    className="font-mono text-slate-800 font-extrabold flex items-center gap-1 bg-white border border-slate-100 px-3 py-1.5 rounded-xl shadow-xs"
                  >
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    {currentLat.toFixed(5)}° N, {currentLng.toFixed(5)}° E
                  </motion.span>
                </div>
              ) : (
                <div className="space-y-3.5 animate-fade-in">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                      Choose Ward Area / Municipality Zone
                    </label>
                    <select
                      id="manual-ward-select"
                      value={matchWardByCoordinates(currentLat, currentLng).ward}
                      onChange={(e) => {
                        const selectedWardName = e.target.value;
                        const matchLoc = wardLocations.find(w => w.ward === selectedWardName);
                        if (matchLoc) {
                          setCurrentLat(matchLoc.lat);
                          setCurrentLng(matchLoc.lng);
                        }
                      }}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {wardLocations.map((loc) => (
                        <option key={loc.ward} value={loc.ward}>
                          {loc.ward}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Manual coordinates adjustments for absolute location accuracy */}
                  <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-2xl border border-slate-100">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[9px] font-extrabold text-slate-500">
                        <span>LATITUDE</span>
                        <motion.span
                          key={`${currentLat.toFixed(5)}-lat`}
                          initial={{ scale: 1.1, color: "#2563eb", fontWeight: "900" }}
                          animate={{ scale: 1, color: "#2563eb", fontWeight: "800" }}
                          transition={{ duration: 0.3 }}
                          className="font-mono text-blue-600"
                        >
                          {currentLat.toFixed(5)}° N
                        </motion.span>
                      </div>
                      <input
                        type="range"
                        min={(currentLat - 0.05).toString()}
                        max={(currentLat + 0.05).toString()}
                        step="0.0001"
                        value={currentLat}
                        onChange={(e) => setCurrentLat(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[9px] font-extrabold text-slate-500">
                        <span>LONGITUDE</span>
                        <motion.span
                          key={`${currentLng.toFixed(5)}-lng`}
                          initial={{ scale: 1.1, color: "#2563eb", fontWeight: "900" }}
                          animate={{ scale: 1, color: "#2563eb", fontWeight: "800" }}
                          transition={{ duration: 0.3 }}
                          className="font-mono text-blue-600"
                        >
                          {currentLng.toFixed(5)}° E
                        </motion.span>
                      </div>
                      <input
                        type="range"
                        min={(currentLng - 0.05).toString()}
                        max={(currentLng + 0.05).toString()}
                        step="0.0001"
                        value={currentLng}
                        onChange={(e) => setCurrentLng(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Live Preview Box of Matched Official */}
              {matchedOfficial && (
                <div className="bg-blue-50/50 border border-blue-100/60 p-3.5 rounded-2xl flex items-start gap-2.5">
                  <div className="bg-blue-500/10 p-2 rounded-xl text-blue-600 mt-0.5">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 text-xs flex-1">
                    <p className="text-[10px] font-black text-blue-800 uppercase tracking-wider">
                      Designated Municipal Official Matched
                    </p>
                    <p className="font-extrabold text-slate-800 text-[13px]">{matchedOfficial.name}</p>
                    <p className="text-slate-500 font-semibold text-[11px]">{matchedOfficial.department}</p>
                    <div className="pt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400 font-semibold">
                      <span>🕒 {matchedOfficial.officeHours}</span>
                      <span>📞 {matchedOfficial.mobileNumber}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Photo preview segment with trigger to capture */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Complaint Site Photo (Mandatory)
              </label>

              {complaintPhoto ? (
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-inner group">
                  <img src={complaintPhoto} alt="Civic problem captured site photo" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setComplaintPhoto(null)}
                    className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-full cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  id="form-capture-photo-btn"
                  type="button"
                  onClick={() => setActiveInputMode("camera")}
                  className="w-full h-40 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-slate-50 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer text-slate-500"
                >
                  <Camera className="w-8 h-8 text-blue-500" />
                  <span className="text-xs font-bold">{t.capturePhoto}</span>
                  <span className="text-[10px] text-slate-400">Click to launch device camera helper</span>
                </button>
              )}
            </div>

            {/* Description textbox with quick voice transcript support */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Describe the Incident
              </label>
              <textarea
                id="form-complaint-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Give details about the leakage or blockage..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-800"
              />

              {voiceTranscript && (
                <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl">
                  <p className="text-[10px] text-indigo-400 font-extrabold uppercase mb-0.5">Voice Transcript</p>
                  <p className="text-xs font-mono italic font-semibold text-indigo-800">"{voiceTranscript}"</p>
                </div>
              )}
            </div>

            {/* If camera helper requested inside reporting form */}
            {activeInputMode === "camera" && (
              <div className="bg-slate-100 rounded-2xl p-4">
                <CameraCapture
                  onCapture={(photo, lat, lng) => {
                    setComplaintPhoto(photo);
                    setCurrentLat(lat);
                    setCurrentLng(lng);
                    setActiveInputMode("none");
                  }}
                  language={language}
                />
              </div>
            )}

            <button
              id="form-complaint-submit-btn"
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitComplaint}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl active:scale-95 transition text-md shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Filing Complaint...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  {t.submitComplaint}
                </>
              )}
            </button>
          </div>
        )}

        {/* SCREEN 6: COMPLAINT DETAILS & REPAIR VERIFICATION PROGRESS SCREEN */}
        {screen === "complaint_detail" && selectedComplaint && (
          <div id="complaint-detail-view" className="max-w-2xl mx-auto bg-white border border-slate-100 shadow-sm rounded-3xl p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopSpeech();
                    setSelectedComplaint(null);
                    setScreen("citizen_home");
                  }}
                  className="p-1.5 rounded-xl hover:bg-slate-50 text-slate-500 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <span className="text-[9px] font-mono font-bold text-slate-400">
                    TICKET {selectedComplaint.id}
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">
                    {selectedComplaint.issueCategory}
                  </h3>
                </div>
              </div>

              {/* Read Aloud Status Button */}
              <button
                type="button"
                onClick={() => {
                  const readout = getComplaintFullReadout(selectedComplaint, language, matchedOfficial);
                  speakText(readout, language);
                }}
                className="px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                title={t.readStatus}
              >
                <Volume2 className="w-4 h-4 animate-pulse" />
                <span>{t.readStatus}</span>
              </button>
            </div>

            {/* Progress Status Roadmap bar */}
            <div className="space-y-4 py-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                {t.resolutionRoadmap}
              </span>
              
              <div className="relative pt-2">
                {/* Background Connecting Line */}
                <div className="absolute top-6 left-0 right-0 h-1.5 bg-slate-100 rounded-full -translate-y-1/2" />
                
                {/* Animated Filled Progress Line */}
                <motion.div
                  layout
                  className="absolute top-6 left-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full -translate-y-1/2"
                  initial={{ width: "0%" }}
                  animate={{ width: `${
                    selectedComplaint.status === ComplaintStatus.SUBMITTED || selectedComplaint.status === ComplaintStatus.REOPENED ? "12%" :
                    selectedComplaint.status === ComplaintStatus.ASSIGNED ? "38%" :
                    selectedComplaint.status === ComplaintStatus.IN_PROGRESS ? "62%" :
                    selectedComplaint.status === ComplaintStatus.PROOF_UPLOADED || selectedComplaint.status === ComplaintStatus.PENDING_VERIFICATION ? "85%" : "100%"
                  }` }}
                  transition={{ type: "spring", stiffness: 60, damping: 15 }}
                />
                
                {/* Timeline Nodes */}
                <div className="relative flex justify-between items-start z-10">
                  {/* Step 1: Reported */}
                  <div className="flex flex-col items-center flex-1">
                    <motion.div
                      layout
                      className="w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-sm text-xs font-bold"
                      animate={{
                        backgroundColor: (selectedComplaint.status === ComplaintStatus.SUBMITTED || selectedComplaint.status === ComplaintStatus.REOPENED) ? "#3B82F6" : "#2563EB",
                        color: "#FFFFFF",
                        scale: (selectedComplaint.status === ComplaintStatus.SUBMITTED || selectedComplaint.status === ComplaintStatus.REOPENED) ? 1.15 : 1.0
                      }}
                      transition={{ type: "spring", stiffness: 100, damping: 12 }}
                    >
                      <span>1</span>
                    </motion.div>
                    <span className={`text-[10px] font-extrabold mt-2 text-center transition-colors duration-300 ${
                      (selectedComplaint.status === ComplaintStatus.SUBMITTED || selectedComplaint.status === ComplaintStatus.REOPENED) ? "text-blue-600" : "text-slate-500"
                    }`}>
                      {t.reported}
                    </span>
                  </div>

                  {/* Step 2: Assigned */}
                  <div className="flex flex-col items-center flex-1">
                    <motion.div
                      layout
                      className="w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-sm text-xs font-bold"
                      animate={{
                        backgroundColor: (selectedComplaint.status === ComplaintStatus.ASSIGNED) 
                          ? "#8B5CF6" 
                          : [ComplaintStatus.IN_PROGRESS, ComplaintStatus.PROOF_UPLOADED, ComplaintStatus.PENDING_VERIFICATION, ComplaintStatus.CLOSED].includes(selectedComplaint.status)
                            ? "#7C3AED"
                            : "#E2E8F0",
                        color: [ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS, ComplaintStatus.PROOF_UPLOADED, ComplaintStatus.PENDING_VERIFICATION, ComplaintStatus.CLOSED].includes(selectedComplaint.status) ? "#FFFFFF" : "#64748B",
                        scale: (selectedComplaint.status === ComplaintStatus.ASSIGNED) ? 1.15 : 1.0
                      }}
                      transition={{ type: "spring", stiffness: 100, damping: 12 }}
                    >
                      <span>2</span>
                    </motion.div>
                    <span className={`text-[10px] font-extrabold mt-2 text-center transition-colors duration-300 ${
                      selectedComplaint.status === ComplaintStatus.ASSIGNED ? "text-purple-600" : "text-slate-500"
                    }`}>
                      {t.assigned}
                    </span>
                  </div>

                  {/* Step 3: Fixed Proof / In Progress */}
                  <div className="flex flex-col items-center flex-1">
                    <motion.div
                      layout
                      className="w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-sm text-xs font-bold"
                      animate={{
                        backgroundColor: (selectedComplaint.status === ComplaintStatus.IN_PROGRESS || selectedComplaint.status === ComplaintStatus.PROOF_UPLOADED || selectedComplaint.status === ComplaintStatus.PENDING_VERIFICATION)
                          ? "#4F46E5"
                          : selectedComplaint.status === ComplaintStatus.CLOSED
                            ? "#4338CA"
                            : "#E2E8F0",
                        color: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.PROOF_UPLOADED, ComplaintStatus.PENDING_VERIFICATION, ComplaintStatus.CLOSED].includes(selectedComplaint.status) ? "#FFFFFF" : "#64748B",
                        scale: (selectedComplaint.status === ComplaintStatus.IN_PROGRESS || selectedComplaint.status === ComplaintStatus.PROOF_UPLOADED || selectedComplaint.status === ComplaintStatus.PENDING_VERIFICATION) ? 1.15 : 1.0
                      }}
                      transition={{ type: "spring", stiffness: 100, damping: 12 }}
                    >
                      <span>3</span>
                    </motion.div>
                    <span className={`text-[10px] font-extrabold mt-2 text-center transition-colors duration-300 ${
                      [ComplaintStatus.IN_PROGRESS, ComplaintStatus.PROOF_UPLOADED, ComplaintStatus.PENDING_VERIFICATION].includes(selectedComplaint.status) ? "text-indigo-600" : "text-slate-500"
                    }`}>
                      {selectedComplaint.status === ComplaintStatus.PROOF_UPLOADED || selectedComplaint.status === ComplaintStatus.PENDING_VERIFICATION ? t.fixedProof : t.inProgress}
                    </span>
                  </div>

                  {/* Step 4: Closed */}
                  <div className="flex flex-col items-center flex-1">
                    <motion.div
                      layout
                      className="w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-sm text-xs font-bold"
                      animate={{
                        backgroundColor: selectedComplaint.status === ComplaintStatus.CLOSED ? "#10B981" : "#E2E8F0",
                        color: selectedComplaint.status === ComplaintStatus.CLOSED ? "#FFFFFF" : "#64748B",
                        scale: selectedComplaint.status === ComplaintStatus.CLOSED ? 1.15 : 1.0
                      }}
                      transition={{ type: "spring", stiffness: 100, damping: 12 }}
                    >
                      <span>4</span>
                    </motion.div>
                    <span className={`text-[10px] font-extrabold mt-2 text-center transition-colors duration-300 ${
                      selectedComplaint.status === ComplaintStatus.CLOSED ? "text-emerald-600" : "text-slate-500"
                    }`}>
                      {t.closed}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Before vs After Snapshots */}
            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                {t.repairVerificationPhoto}
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-rose-600 font-bold">{t.yourReportedPhoto}</span>
                  <div className="aspect-video bg-slate-100 rounded-2xl overflow-hidden border border-slate-200/50">
                    <img src={selectedComplaint.complaintPhoto} alt="Your report" className="w-full h-full object-cover" />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-indigo-600 font-bold">{t.officerUploadedProof}</span>
                  <div className="aspect-video bg-slate-100 rounded-2xl overflow-hidden border border-slate-200/50 flex items-center justify-center text-slate-400">
                    {selectedComplaint.repairPhoto ? (
                      <img src={selectedComplaint.repairPhoto} alt="Repair proof" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold">{t.proofPendingUpload}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Geo consistency verification calculations box */}
            {selectedComplaint.repairPhoto && (
              <div className={`border p-4 rounded-2xl flex items-start gap-3 ${
                selectedComplaint.geoConsistencyVerified 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}>
                {selectedComplaint.geoConsistencyVerified ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <h5 className="font-extrabold text-sm">
                    {selectedComplaint.geoConsistencyVerified ? t.locationConsistencyVerified : t.locationDiscrepancyFlagged}
                  </h5>
                  <p className="text-xs mt-0.5 opacity-90 leading-relaxed font-semibold">
                    {t.geoVerifiedMsg} <span className="font-black underline">{selectedComplaint.geoConsistencyDistance} {t.metersAway}</span>
                    {selectedComplaint.geoConsistencyVerified ? t.validRangeVerified : t.mismatchWarning}
                  </p>
                </div>
              </div>
            )}

            {/* Description Text block */}
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">{t.reportDescription}</span>
              <p className="text-sm font-semibold text-slate-700 bg-slate-50 p-4 border border-slate-100/50 rounded-2xl leading-relaxed">
                {selectedComplaint.description}
              </p>
            </div>

            {/* CITIZEN CONFIRMATION CONTROL BAR */}
            {selectedComplaint.status === ComplaintStatus.PROOF_UPLOADED && (
              <div id="citizen-closure-controls" className="bg-blue-50 border border-blue-200 p-5 rounded-3xl space-y-4">
                <div className="text-center">
                  <h4 className="font-black text-blue-900 text-base">
                    {t.confirmClosure}
                  </h4>
                  <p className="text-xs text-blue-600 font-semibold mt-1">
                    {language === "ta" ? "அதிகாரியின் ஆதாரத்தை மேலே சரிபார்க்கவும். உங்கள் இடத்தில் பிரச்சினை தீர்க்கப்பட்டதா?" : 
                     language === "te" ? "దయచేసి పై అధికారి రుజువును పరిశీలించండి. మీ వద్ద సమస్య పరిష్కరించబడిందా?" : 
                     language === "hi" ? "कृपया ऊपर दिए गए अधिकारी के प्रमाण का निरीक्षण करें। क्या समस्या का समाधान हो गया है?" : 
                     "Please inspect the officer's proof above. Is the problem resolved at your site?"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    id="citizen-approve-btn"
                    type="button"
                    onClick={() => handleCitizenVerify(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-2xl active:scale-95 transition text-sm cursor-pointer shadow-sm text-center"
                  >
                    {t.approveResolution}
                  </button>
                  <button
                    id="citizen-reject-btn"
                    type="button"
                    onClick={() => setShowReopenBox(true)}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3.5 px-4 rounded-2xl active:scale-95 transition text-sm cursor-pointer shadow-sm text-center"
                  >
                    {t.rejectResolution}
                  </button>
                </div>

                {/* Reject/Reopen Description Area */}
                {showReopenBox && (
                  <div className="space-y-3 pt-3 border-t border-blue-200/50">
                    <label className="text-xs font-extrabold text-rose-800 block">
                      {t.feedbackLabel}
                    </label>
                    <textarea
                      id="reopen-feedback-textarea"
                      rows={2}
                      value={reopenFeedback}
                      onChange={(e) => setReopenFeedback(e.target.value)}
                      placeholder="Explain why the repair is incomplete..."
                      className="w-full text-xs font-semibold p-3 bg-white border border-rose-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowReopenBox(false);
                          setReopenFeedback("");
                        }}
                        className="text-xs font-bold px-3 py-1.5 text-slate-500 bg-white border border-slate-200 rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        id="submit-reopen-btn"
                        type="button"
                        onClick={() => handleCitizenVerify(false)}
                        className="text-xs font-bold px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer"
                      >
                        Submit & Reopen Ticket
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SCREEN 7: SECURE WARD GOVERNMENT OFFICIAL PORTAL */}
        {screen === "official_dashboard" && session && (
          <div className="animate-fade-in">
            {/* Find the logged-in official profile */}
            {(() => {
              const currentOff = officials.find(o => o.id === session.officialId) || officials[0];
              if (!currentOff) {
                return (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                  </div>
                );
              }
              return (
                <OfficialDashboard
                  currentOfficial={currentOff}
                  complaints={complaints}
                  onUpdateComplaint={handleOfficialUpdate}
                  onUpdateOfficial={handleOfficialSettingsUpdate}
                  language={language}
                  onLogout={handleLogout}
                />
              );
            })()}
          </div>
        )}

      </main>

      {/* FOOTER BAR */}
      <footer className="bg-white border-t border-slate-100 py-6 px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-400">
          <p>© 2026 Municipal Water Commission & Civic Assistant Corporation. All Rights Reserved.</p>
          <div className="flex items-center gap-4">
            <button 
              type="button" 
              onClick={() => {
                setLoginRole("official");
                setScreen("login");
              }}
              className="hover:text-blue-600 transition cursor-pointer"
            >
              {t.govStaffPortal}
            </button>
            <span>•</span>
            <span className="font-mono text-[10px] uppercase">{t.utcActive}</span>
          </div>
        </div>
      </footer>

      {/* FLOATING TEXT-TO-SPEECH ASSISTANT AUDIO CONTROLS & SUBTITLE DISPLAY */}
      <VoiceAssistantPlayer
        language={language}
        autoSpeakEnabled={autoSpeakEnabled}
        onToggleAutoSpeak={(val) => {
          setAutoSpeakEnabled(val);
          try {
            localStorage.setItem("civic_auto_speak", String(val));
          } catch {}
        }}
      />

    </div>
  );
}
