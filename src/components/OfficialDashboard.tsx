import { useState } from "react";
import { Complaint, Official, TRANSLATIONS, ComplaintStatus } from "../types";
import { 
  CheckCircle, 
  MapPin, 
  Phone, 
  User, 
  Clock, 
  ShieldAlert, 
  Sparkles, 
  Camera, 
  FileText, 
  RefreshCw,
  Sliders,
  Settings,
  HelpCircle,
  AlertOctagon,
  Edit,
  Save,
  Check,
  Volume2
} from "lucide-react";
import CameraCapture from "./CameraCapture";
import { speakText, getComplaintFullReadout } from "../utils/textToSpeech";

interface OfficialDashboardProps {
  currentOfficial: Official;
  complaints: Complaint[];
  onUpdateComplaint: (id: string, updates: Partial<Complaint>) => void;
  onUpdateOfficial: (id: string, updates: Partial<Official>) => void;
  language: "en" | "hi" | "ta" | "te";
  onLogout: () => void;
}

export default function OfficialDashboard({
  currentOfficial,
  complaints,
  onUpdateComplaint,
  onUpdateOfficial,
  language,
  onLogout
}: OfficialDashboardProps) {
  const t = TRANSLATIONS[language];
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "resolved" | "all">("active");
  const [showCamera, setShowCamera] = useState(false);
  
  // Settings edit mode states
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settingsHours, setSettingsHours] = useState(currentOfficial.officeHours);
  const [settingsPhone, setSettingsPhone] = useState(currentOfficial.mobileNumber);
  const [settingsEscalation, setSettingsEscalation] = useState(currentOfficial.escalationOfficer);
  const [settingsEmail, setSettingsEmail] = useState(currentOfficial.email);

  // Filter complaints based on the official's assigned ID and current status tab
  const assignedComplaints = complaints.filter(c => c.assignedOfficialId === currentOfficial.id);
  
  const filteredComplaints = assignedComplaints.filter(c => {
    if (activeTab === "active") {
      return c.status !== ComplaintStatus.CLOSED && c.status !== ComplaintStatus.PROOF_UPLOADED;
    } else if (activeTab === "resolved") {
      return c.status === ComplaintStatus.CLOSED || c.status === ComplaintStatus.PROOF_UPLOADED;
    }
    return true; // "all"
  });

  // Handle the repair camera upload
  function handleRepairProofCaptured(photoBase64: string, lat: number, lng: number) {
    if (selectedComplaint) {
      // Trigger update on backend via parent callback
      onUpdateComplaint(selectedComplaint.id, {
        repairPhoto: photoBase64,
        officerLatitude: lat,
        officerLongitude: lng,
        status: ComplaintStatus.PROOF_UPLOADED
      });
      setShowCamera(false);
      
      // Update local state copy to show fresh values in detail pane
      setSelectedComplaint((prev) => {
        if (!prev) return null;
        // Simple client-side preview calculations for instant responsive UI
        const R = 6371e3;
        const phi1 = (prev.latitude * Math.PI) / 180;
        const phi2 = (lat * Math.PI) / 180;
        const dPhi = ((lat - prev.latitude) * Math.PI) / 180;
        const dLam = ((lng - prev.longitude) * Math.PI) / 180;
        const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam/2) * Math.sin(dLam/2);
        const cVal = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const dist = Math.round(R * cVal);

        return {
          ...prev,
          status: ComplaintStatus.PROOF_UPLOADED,
          repairPhoto: photoBase64,
          geoConsistencyDistance: dist,
          geoConsistencyVerified: dist <= 120,
          citizenVerificationStatus: "pending"
        };
      });
    }
  }

  function handleSaveSettings() {
    onUpdateOfficial(currentOfficial.id, {
      officeHours: settingsHours,
      mobileNumber: settingsPhone,
      escalationOfficer: settingsEscalation,
      email: settingsEmail
    });
    setIsEditingSettings(false);
  }

  return (
    <div id="official-dashboard-view" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT COLUMN: Sidebar list and profile stats */}
      <div className="lg:col-span-5 space-y-6">
        {/* Profile Card */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md relative overflow-hidden border border-slate-850">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-blue-600 text-white p-3.5 rounded-xl shadow-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                {currentOfficial.ward}
              </p>
              <h3 className="text-base font-bold tracking-tight">{currentOfficial.name}</h3>
              <p className="text-[10px] text-slate-400 font-medium font-mono">
                {currentOfficial.email}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-slate-800 pt-4 text-center">
            <div className="bg-slate-850/50 p-2 rounded-xl border border-slate-800/50">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{t.assignedStats}</p>
              <p className="text-base font-extrabold text-blue-400 mt-0.5">{assignedComplaints.length}</p>
            </div>
            <div className="bg-slate-850/50 p-2 rounded-xl border border-slate-800/50">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{t.activeStats}</p>
              <p className="text-base font-extrabold text-rose-400 mt-0.5">
                {assignedComplaints.filter(c => c.status !== ComplaintStatus.CLOSED && c.status !== ComplaintStatus.PROOF_UPLOADED).length}
              </p>
            </div>
            <div className="bg-slate-850/50 p-2 rounded-xl border border-slate-800/50">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{t.closedStats}</p>
              <p className="text-base font-extrabold text-emerald-400 mt-0.5">
                {assignedComplaints.filter(c => c.status === ComplaintStatus.CLOSED).length}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/50">
            <button
              id="toggle-settings-btn"
              type="button"
              onClick={() => setIsEditingSettings(!isEditingSettings)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-white transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              {t.updateOfficeHours}
            </button>
            <button
              id="staff-logout-btn"
              type="button"
              onClick={onLogout}
              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 transition cursor-pointer"
            >
              {t.logoutExit}
            </button>
          </div>
        </div>

        {/* Update Settings Form Panel (Inline Admin Mode) */}
        {isEditingSettings && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-blue-500" />
              {t.officialSettings}
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{t.officeHours}</label>
                <input
                  type="text"
                  value={settingsHours}
                  onChange={(e) => setSettingsHours(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{t.mobileNumber}</label>
                <input
                  type="text"
                  value={settingsPhone}
                  onChange={(e) => setSettingsPhone(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{t.escalationOfficer}</label>
                <input
                  type="text"
                  value={settingsEscalation}
                  onChange={(e) => setSettingsEscalation(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{t.officialEmailAlerts}</label>
                <input
                  type="email"
                  value={settingsEmail}
                  onChange={(e) => setSettingsEmail(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingSettings(false)}
                  className="text-xs font-bold px-3 py-2 text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  id="save-settings-btn"
                  type="button"
                  onClick={handleSaveSettings}
                  className="flex items-center gap-1 text-xs font-bold px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  {t.saveChanges}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complaints List with Tabs */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-blue-600" />
              {t.historyTitle}
            </h4>
            
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-[10px]">
              <button
                type="button"
                onClick={() => setActiveTab("active")}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  activeTab === "active" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.activeStats}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("resolved")}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  activeTab === "resolved" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {language === "ta" ? "தீர்க்கப்பட்டவை" : language === "te" ? "పరిష్కరించబడినవి" : language === "hi" ? "हल की गई" : "Resolved"}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  activeTab === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {language === "ta" ? "அனைத்தும்" : language === "te" ? "అన్నీ" : language === "hi" ? "सभी" : "All"}
              </button>
            </div>
          </div>

          <div id="assigned-tickets" className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {filteredComplaints.length === 0 ? (
              <div className="text-center py-10">
                <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-400">
                  {language === "ta" ? "இந்த பிரிவில் புகார்கள் ஏதும் இல்லை." : language === "te" ? "ఈ విభాగంలో ఎటువంటి ఫిర్యాదులు లేవు." : language === "hi" ? "इस श्रेणी में कोई शिकायत नहीं मिली।" : "No complaints found in this category."}
                </p>
              </div>
            ) : (
              filteredComplaints.map((c) => {
                const isSelected = selectedComplaint?.id === c.id;
                return (
                  <button
                    key={c.id}
                    id={`staff-ticket-${c.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedComplaint(c);
                      setShowCamera(false);
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between cursor-pointer ${
                      isSelected 
                        ? "bg-blue-50 border-blue-200 shadow-sm" 
                        : "bg-white border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono font-bold text-slate-400 tracking-wider">
                          #{c.id.split("-")[1] || c.id}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase border ${
                          c.status === ComplaintStatus.SUBMITTED || c.status === ComplaintStatus.REOPENED
                            ? "bg-rose-50 border-rose-100 text-rose-700"
                            : c.status === ComplaintStatus.PROOF_UPLOADED
                            ? "bg-indigo-50 border-indigo-100 text-indigo-700 font-bold"
                            : "bg-emerald-50 border-emerald-100 text-emerald-700"
                        }`}>
                          {c.status}
                        </span>
                        {c.urgencyScore === "High" && (
                          <span className="bg-red-50 text-red-700 border border-red-150 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md">
                            HIGH
                          </span>
                        )}
                      </div>
                      <h5 className="text-sm font-bold text-slate-900">{c.issueCategory}</h5>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{c.description}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Complaint details panel, Geotag matching controls, Repair upload */}
      <div className="lg:col-span-7">
        {selectedComplaint ? (
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 space-y-6 relative animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                  {t.ticketNo} {selectedComplaint.id.split("-")[1] || selectedComplaint.id}
                </span>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
                  {selectedComplaint.issueCategory}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const readout = getComplaintFullReadout(selectedComplaint, language, currentOfficial);
                    speakText(readout, language);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1.5 border border-blue-200 transition cursor-pointer"
                  title={t.readStatus}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{t.readStatus}</span>
                </button>

                <div className="text-right">
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">
                    {language === "ta" ? "தற்போதைய நிலை" : language === "te" ? "ప్రస్తుత స్థితి" : language === "hi" ? "वर्तमान स्थिति" : "Current Status"}
                  </span>
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 border border-blue-150 text-blue-700 uppercase tracking-wider mt-1">
                    {selectedComplaint.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Geotag and address card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  {language === "ta" ? "சம்பவ இடம்" : language === "te" ? "సంఘటన స్థలం" : language === "hi" ? "घटना स्थल" : "Incident Location"}
                </span>
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  {selectedComplaint.ward}
                </p>
                <p className="text-[10px] text-slate-500 font-bold font-mono">
                  {selectedComplaint.latitude.toFixed(5)}° N, {selectedComplaint.longitude.toFixed(5)}° E
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  {language === "ta" ? "புகார்தாரர்" : language === "te" ? "ఫిర్యాదుదారుడు" : language === "hi" ? "शिकायतकर्ता नागरिक" : "Citizen Reporter"}
                </span>
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  {selectedComplaint.userName}
                </p>
                <a 
                  href={`tel:${selectedComplaint.phoneNumber}`}
                  className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {selectedComplaint.phoneNumber}
                </a>
              </div>
            </div>

            {/* Photos: Before vs After side-by-side */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {language === "ta" ? "முன் / பின் காட்சி சரிபார்ப்பு" : language === "te" ? "ముందు / తరువాత దృశ్య ధృవీకరణ" : language === "hi" ? "पहले / बाद का दृश्य सत्यापन" : "Before / After Visual Verification"}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[9px] bg-rose-50 border border-rose-100 text-rose-700 font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider inline-block">
                    {language === "ta" ? "முன்னர்: தாக்கல் செய்யப்பட்ட புகார்" : language === "te" ? "ముందు: దాఖలైన ఫిర్యాదు" : language === "hi" ? "पहले: दर्ज की गई शिकायत" : "Before: Filed Complaint"}
                  </span>
                  <div className="aspect-video bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center">
                    {selectedComplaint.complaintPhoto ? (
                      <img
                        src={selectedComplaint.complaintPhoto}
                        alt="Before repair"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <FileText className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider inline-block">
                    {language === "ta" ? "பின்னர்: முடிவடைந்த பழுதுபார்ப்பு" : language === "te" ? "తరువాత: పూర్తయిన మరమ్మత్తు" : language === "hi" ? "बाद में: पूरी की गई मरम्मत" : "After: Completed Repair"}
                  </span>
                  <div className="aspect-video bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center relative">
                    {selectedComplaint.repairPhoto ? (
                      <img
                        src={selectedComplaint.repairPhoto}
                        alt="After repair proof"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <Camera className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                        <p className="text-[10px] text-slate-450 uppercase tracking-wider font-bold">
                          {language === "ta" ? "சான்று ஏதும் இல்லை" : language === "te" ? "రుజువు అప్ లోడ్ చేయలేదు" : language === "hi" ? "कोई प्रमाण अपलोड नहीं" : "No proof uploaded"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Location consistency check banner (If proof uploaded) */}
            {selectedComplaint.repairPhoto && (
              <div className={`border p-4 rounded-2xl flex items-start gap-3 ${
                selectedComplaint.geoConsistencyVerified 
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-800"
                  : "bg-amber-50/70 border-amber-200 text-amber-800"
              }`}>
                {selectedComplaint.geoConsistencyVerified ? (
                  <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 bg-emerald-100 p-1 rounded-full" />
                ) : (
                  <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 bg-amber-100 p-1 rounded-full" />
                )}
                <div>
                  <h5 className="font-bold text-xs uppercase tracking-wider">
                    {selectedComplaint.geoConsistencyVerified ? "Geo-Location Verified" : "Location Warning"}
                  </h5>
                  <p className="text-xs mt-0.5 leading-relaxed font-semibold opacity-90">
                    The repair proof was uploaded <span className="font-bold underline">{selectedComplaint.geoConsistencyDistance} meters</span> away from the original reported site. 
                    {selectedComplaint.geoConsistencyVerified 
                      ? " This is within the permissible 120-meter tolerance threshold." 
                      : " Warning! Repair photo must come from the same site location as the initial complaint to verify genuine repair work."}
                  </p>
                </div>
              </div>
            )}

            {/* Description and transcription */}
            <div className="space-y-4 border-t border-slate-100 pt-5">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  {language === "ta" ? "எழுதப்பட்ட விவரம்" : language === "te" ? "లిఖితపూర్వక వివరణ" : language === "hi" ? "लिखित विवरण" : "Written Description"}
                </span>
                <p className="text-xs font-semibold text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-200 leading-relaxed">
                  {selectedComplaint.description}
                </p>
              </div>

              {selectedComplaint.voiceTranscription && (
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{t.voiceTranscript}</span>
                  <p className="text-xs font-semibold font-mono text-indigo-750 bg-indigo-50/50 p-3.5 border border-indigo-150 rounded-2xl italic flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                    "{selectedComplaint.voiceTranscription}"
                  </p>
                </div>
              )}
            </div>

            {/* Actions panel */}
            <div className="border-t border-slate-100 pt-5 flex flex-col sm:flex-row justify-end gap-3">
              {selectedComplaint.status !== ComplaintStatus.CLOSED && selectedComplaint.status !== ComplaintStatus.PROOF_UPLOADED && (
                <>
                  {showCamera ? (
                    <div className="w-full">
                      <CameraCapture
                        onCapture={handleRepairProofCaptured}
                        language={language}
                        isRepairProof={true}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCamera(false)}
                        className="w-full text-center text-xs font-bold text-slate-400 mt-3 hover:text-slate-600 underline cursor-pointer"
                      >
                        {language === "ta" ? "கேமரா பதிவேற்றத்தை ரத்துசெய்" : language === "te" ? "కెమెరా అప్‌లోడ్‌ను రద్దు చేయి" : language === "hi" ? "कैमरा अपलोड रद्द करें" : "Cancel Camera Upload"}
                      </button>
                    </div>
                  ) : (
                    <button
                      id="staff-upload-proof-btn"
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl active:scale-95 transition-all text-xs cursor-pointer tracking-wider uppercase shadow-sm border border-blue-700"
                    >
                      <Camera className="w-4 h-4" />
                      {t.markAsRepaired}
                    </button>
                  )}
                </>
              )}

              {selectedComplaint.status === ComplaintStatus.PROOF_UPLOADED && (
                <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 text-center text-xs text-slate-500 font-bold uppercase tracking-wider">
                  ⌛ {t.statusPending}
                </div>
              )}

              {selectedComplaint.status === ComplaintStatus.CLOSED && (
                <div className="w-full bg-emerald-50 text-emerald-850 p-4 rounded-xl border border-emerald-200 text-center text-xs font-bold flex items-center justify-center gap-2 uppercase tracking-wider">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  {t.statusClosed}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-12 text-center h-[500px] flex flex-col items-center justify-center space-y-4">
            <FileText className="w-12 h-12 text-slate-300" />
            <div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight">
                {language === "ta" ? "ஒதுக்கப்பட்ட புகாரைத் தேர்ந்தெடுக்கவும்" : language === "te" ? "కేటాయించిన ఫిర్యాదును ఎంచుకోండి" : language === "hi" ? "सौंपे गए टिकट का चयन करें" : "Select an Assigned Ticket"}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed font-semibold">
                {language === "ta" ? "முன்/பின் புகைப்படங்களை மதிப்பாய்வு செய்ய, குடிமகனின் இருப்பிடத்தைக் கண்டறிய மற்றும் பழுதுபார்ப்புச் சான்றைப் பதிவேற்ற உங்கள் வார்டில் இருந்து ஒரு புகாரைத் தேர்ந்தெடுக்கவும்." : language === "te" ? "ముందు/తరువాత ఫోటోలను సమీక్షించడానికి, పౌరుడి స్థానాన్ని కనుగొనడానికి మరియు మరమ్మత్తు రుజువును అప్‌లోడ్ చేయడానికి మీ వార్డు నుండి ఒక ఫిర్యాదును ఎంచుకోండి." : language === "hi" ? "पहले/बाद के फ़ोटो की समीक्षा करने, नागरिक निर्देशांक देखने और मरम्मत प्रमाण अपलोड करने के लिए अपने वार्ड से शिकायत चुनें।" : "Choose a complaint from your ward in the sidebar to review before/after snapshots, view citizen coordinates, and upload repair proof."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
