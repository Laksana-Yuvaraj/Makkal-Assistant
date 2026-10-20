import { Official, TRANSLATIONS } from "../types";
import { Phone, Mail, Clock, ShieldAlert, CheckCircle } from "lucide-react";

interface OfficialContactCardProps {
  official: Official;
  language: "en" | "hi" | "ta" | "te";
}

export default function OfficialContactCard({ official, language }: OfficialContactCardProps) {
  const t = TRANSLATIONS[language];

  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(official.name)}`;

  return (
    <div id={`official-card-${official.id}`} className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 transition-all duration-300 hover:shadow-md">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden shrink-0">
            <img src={avatarUrl} alt={official.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse animate-duration-1000"></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                {official.ward}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 leading-snug">
              {official.name}
            </h3>
            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mt-0.5">
              {official.department}
            </p>
          </div>
        </div>
        <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          {t.onDuty}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 text-slate-600 p-2.5 rounded-xl border border-slate-100 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              {t.officeHours}
            </p>
            <p className="text-xs font-bold text-slate-700 mt-0.5">
              {official.officeHours}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-50 text-slate-600 p-2.5 rounded-xl border border-slate-100 shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              {t.escalation}
            </p>
            <p className="text-[11px] font-bold text-slate-700 line-clamp-1 mt-0.5">
              {official.escalationOfficer.split(" ")[0]} {official.escalationOfficer.split(" ")[1] || ""}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <a
          id={`call-btn-${official.id}`}
          href={`tel:${official.mobileNumber.replace(/\s+/g, "")}`}
          className="flex items-center justify-center gap-2 bg-blue-50 text-blue-600 font-bold py-3 px-4 rounded-xl border border-blue-200 hover:bg-blue-100 active:scale-95 transition-all text-xs text-center cursor-pointer tracking-wider uppercase"
        >
          <Phone className="w-3.5 h-3.5" />
          {t.actionCall}
        </a>
        <a
          id={`email-btn-${official.id}`}
          href={`mailto:${official.email}?subject=Civic%20Complaint%20Report`}
          className="flex items-center justify-center gap-2 bg-slate-50 text-slate-600 font-bold py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all text-xs text-center cursor-pointer tracking-wider uppercase"
        >
          <Mail className="w-3.5 h-3.5" />
          {t.actionEmail}
        </a>
      </div>
    </div>
  );
}
