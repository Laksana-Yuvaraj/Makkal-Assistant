import { Complaint, TRANSLATIONS, ComplaintStatus } from "../types";
import { Clock, CheckCircle, AlertTriangle, ChevronRight, MapPin, Sparkles, Volume2 } from "lucide-react";
import { speakText, getComplaintFullReadout } from "../utils/textToSpeech";

interface ComplaintHistoryProps {
  complaints: Complaint[];
  onSelectComplaint: (complaint: Complaint) => void;
  language: "en" | "hi" | "ta" | "te";
}

export default function ComplaintHistory({ complaints, onSelectComplaint, language }: ComplaintHistoryProps) {
  const t = TRANSLATIONS[language];

  // Map status values to user-friendly colors and labels
  const getStatusConfig = (status: ComplaintStatus) => {
    switch (status) {
      case ComplaintStatus.SUBMITTED:
        return {
          label: t.statusSubmitted,
          badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
          dotColor: "bg-blue-500"
        };
      case ComplaintStatus.ASSIGNED:
        return {
          label: t.statusAssigned,
          badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
          dotColor: "bg-purple-500"
        };
      case ComplaintStatus.IN_PROGRESS:
        return {
          label: t.statusInProgress,
          badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
          dotColor: "bg-amber-500 animate-pulse"
        };
      case ComplaintStatus.PROOF_UPLOADED:
        return {
          label: t.statusProof,
          badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200 font-bold",
          dotColor: "bg-indigo-600"
        };
      case ComplaintStatus.PENDING_VERIFICATION:
        return {
          label: t.statusPending,
          badgeColor: "bg-rose-50 text-rose-700 border-rose-200 font-bold",
          dotColor: "bg-rose-500 animate-pulse"
        };
      case ComplaintStatus.CLOSED:
        return {
          label: t.statusClosed,
          badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
          dotColor: "bg-emerald-600"
        };
      case ComplaintStatus.REOPENED:
        return {
          label: t.statusReopened,
          badgeColor: "bg-red-50 text-red-700 border-red-200",
          dotColor: "bg-red-500"
        };
      default:
        return {
          label: status,
          badgeColor: "bg-slate-50 text-slate-700 border-slate-200",
          dotColor: "bg-slate-500"
        };
    }
  };

  if (complaints.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center">
        <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          {t.noComplaints}
        </p>
      </div>
    );
  }

  return (
    <div id="complaints-list" className="space-y-4">
      {complaints.map((complaint) => {
        const { label, badgeColor, dotColor } = getStatusConfig(complaint.status);
        const dateString = new Date(complaint.createdTime).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric"
        });

        return (
          <div
            key={complaint.id}
            id={`complaint-item-${complaint.id}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelectComplaint(complaint)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                onSelectComplaint(complaint);
              }
            }}
            className="w-full text-left bg-white border border-slate-200 shadow-sm rounded-3xl p-5 hover:shadow-md transition-all duration-300 flex items-center justify-between gap-4 cursor-pointer hover:border-blue-400"
          >
            <div className="flex items-start gap-4">
              {/* Thumbnail snapshot or fallback category symbol */}
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 shrink-0 flex items-center justify-center">
                {complaint.complaintPhoto ? (
                  <img
                    src={complaint.complaintPhoto}
                    alt={complaint.issueCategory}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-slate-400" />
                )}
                <span className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full ${dotColor}`}></span>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    {t.ticketNo}{complaint.id.split("-")[1] || complaint.id}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${badgeColor}`}>
                    {label}
                  </span>
                  {complaint.urgencyScore === "High" && (
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                      {t.highPriority}
                    </span>
                  )}
                </div>

                <h4 className="text-base font-bold text-slate-900 line-clamp-1">
                  {complaint.issueCategory}
                </h4>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="line-clamp-1">{complaint.ward}</span>
                </div>

                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {t.createdOn}: <span className="font-semibold text-slate-600 normal-case">{dateString}</span>
                </p>

                {complaint.status === ComplaintStatus.PROOF_UPLOADED && (
                  <div className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg text-[9px] font-bold text-indigo-700 mt-1 uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                    {t.verifyRepairNow}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const readout = getComplaintFullReadout(complaint, language);
                  speakText(readout, language);
                }}
                className="p-2.5 rounded-2xl bg-blue-50/80 hover:bg-blue-100 text-blue-700 hover:text-blue-900 border border-blue-200/60 shadow-xs cursor-pointer transition-all duration-200 flex items-center gap-1 group"
                title={t.readStatus}
              >
                <Volume2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold hidden sm:inline">{t.readStatus}</span>
              </button>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
