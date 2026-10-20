import { IssueCategory } from "../types";
import { motion } from "motion/react";
import { 
  Droplet, 
  Droplets, 
  AlertTriangle, 
  Gauge, 
  Truck, 
  Construction, 
  Waves, 
  Lightbulb, 
  Trash2, 
  HelpCircle 
} from "lucide-react";

interface IssueSelectorProps {
  selectedCategory: IssueCategory | null;
  onSelectCategory: (category: IssueCategory) => void;
  language: "en" | "hi" | "ta" | "te";
}

export default function IssueSelector({ selectedCategory, onSelectCategory, language }: IssueSelectorProps) {
  // Mapping categories to high-contrast icons and color palettes
  const categoryConfig = [
    {
      category: IssueCategory.WATER_LEAK,
      icon: Droplet,
      bgColor: "bg-blue-50 border-blue-200/60 hover:bg-blue-100 hover:border-blue-400",
      activeBg: "bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-600 shadow-md",
      iconColor: "text-blue-600",
      activeIconColor: "text-white",
      labels: { en: "Water Leak", hi: "पानी का रिसाव", ta: "நீர் கసిவு", te: "నీటి లీకేజీ" }
    },
    {
      category: IssueCategory.NO_SUPPLY,
      icon: Droplets,
      bgColor: "bg-sky-50 border-sky-200/60 hover:bg-sky-100 hover:border-sky-400",
      activeBg: "bg-gradient-to-br from-sky-500 to-sky-600 text-white border-sky-600 shadow-md",
      iconColor: "text-sky-600",
      activeIconColor: "text-white",
      labels: { en: "No Water Supply", hi: "पानी की आपूर्ति नहीं", ta: "நீர் விநியோகம் இல்லை", te: "నీటి సరఫరా లేదు" }
    },
    {
      category: IssueCategory.DIRTY_WATER,
      icon: AlertTriangle,
      bgColor: "bg-amber-50 border-amber-200/60 hover:bg-amber-100 hover:border-amber-400",
      activeBg: "bg-gradient-to-br from-amber-500 to-amber-600 text-white border-amber-600 shadow-md",
      iconColor: "text-amber-600",
      activeIconColor: "text-white",
      labels: { en: "Dirty Water", hi: "गंदा पानी", ta: "அசுத்தமான நீர்", te: "కలుషిత నీరు" }
    },
    {
      category: IssueCategory.LOW_PRESSURE,
      icon: Gauge,
      bgColor: "bg-cyan-50 border-cyan-200/60 hover:bg-cyan-100 hover:border-cyan-400",
      activeBg: "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white border-cyan-600 shadow-md",
      iconColor: "text-cyan-600",
      activeIconColor: "text-white",
      labels: { en: "Low Pressure", hi: "कम दबाव", ta: "குறைந்த அழுத்தம்", te: "తక్కువ పీడనం" }
    },
    {
      category: IssueCategory.TANKER_DELAY,
      icon: Truck,
      bgColor: "bg-indigo-50 border-indigo-200/60 hover:bg-indigo-100 hover:border-indigo-400",
      activeBg: "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-indigo-600 shadow-md",
      iconColor: "text-indigo-600",
      activeIconColor: "text-white",
      labels: { en: "Tanker Delay", hi: "टैंकर की देरी", ta: "தண்ணீர் லாரி தாமதம்", te: "ట్యాంకర్ ఆలస్యం" }
    },
    {
      category: IssueCategory.ROAD_POTHOLE,
      icon: Construction,
      bgColor: "bg-rose-50 border-rose-200/60 hover:bg-rose-100 hover:border-rose-400",
      activeBg: "bg-gradient-to-br from-rose-500 to-rose-600 text-white border-rose-600 shadow-md",
      iconColor: "text-rose-600",
      activeIconColor: "text-white",
      labels: { en: "Road Pothole", hi: "सड़क का गड्ढा", ta: "சாலை பள்ளம்", te: "రోడ్డు గుంత" }
    },
    {
      category: IssueCategory.DRAINAGE_BLOCKAGE,
      icon: Waves,
      bgColor: "bg-emerald-50 border-emerald-200/60 hover:bg-emerald-100 hover:border-emerald-400",
      activeBg: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-emerald-600 shadow-md",
      iconColor: "text-emerald-600",
      activeIconColor: "text-white",
      labels: { en: "Drainage Block", hi: "नाली बंद", ta: "சாக்கடை அடைப்பு", te: "డ్రైనేజీ అవరోధం" }
    },
    {
      category: IssueCategory.STREETLIGHT_ISSUE,
      icon: Lightbulb,
      bgColor: "bg-yellow-50 border-yellow-200/60 hover:bg-yellow-100 hover:border-yellow-400",
      activeBg: "bg-gradient-to-br from-yellow-500 to-yellow-600 text-white border-yellow-600 shadow-md",
      iconColor: "text-yellow-600",
      activeIconColor: "text-white",
      labels: { en: "Streetlight Issue", hi: "स्ट्रीटलाइट समस्या", ta: "தெருவிளக்கு பிரச்சனை", te: "వీధి దీపాల సమస్య" }
    },
    {
      category: IssueCategory.GARBAGE_ISSUE,
      icon: Trash2,
      bgColor: "bg-teal-50 border-teal-200/60 hover:bg-teal-100 hover:border-teal-400",
      activeBg: "bg-gradient-to-br from-teal-500 to-teal-600 text-white border-teal-600 shadow-md",
      iconColor: "text-teal-600",
      activeIconColor: "text-white",
      labels: { en: "Garbage Issue", hi: "कचरे की समस्या", ta: "குப்பை பிரச்சனை", te: "చెత్త సమస్య" }
    },
    {
      category: IssueCategory.OTHER,
      icon: HelpCircle,
      bgColor: "bg-slate-50 border-slate-200/60 hover:bg-slate-100 hover:border-slate-400",
      activeBg: "bg-gradient-to-br from-slate-600 to-slate-700 text-white border-slate-700 shadow-md",
      iconColor: "text-slate-600",
      activeIconColor: "text-white",
      labels: { en: "Other Issue", hi: "अन्य समस्या", ta: "இதर समस्या", te: "ఇతర సమస్య" }
    }
  ];

  return (
    <div id="issue-selector-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
      {categoryConfig.map((item, index) => {
        const IconComponent = item.icon;
        const isSelected = selectedCategory === item.category;
        const textLabel = item.labels[language] || item.labels.en;

        return (
          <motion.button
            key={item.category}
            id={`category-btn-${item.category.replace(/\s+/g, "-").toLowerCase()}`}
            type="button"
            onClick={() => onSelectCategory(item.category)}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.03 }}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 text-center cursor-pointer min-h-[110px] ${
              isSelected 
                ? "border-blue-600 bg-blue-50/95 text-blue-950 font-extrabold shadow-md scale-[1.02]" 
                : `${item.bgColor} text-slate-700`
            }`}
          >
            <motion.div 
              className={`p-2.5 rounded-xl mb-2 transition-all ${
                isSelected 
                  ? "bg-blue-600 text-white" 
                  : "bg-white text-slate-600 shadow-sm"
              }`}
              animate={isSelected ? { scale: [1, 1.15, 1], rotate: [0, -8, 8, -4, 4, 0] } : {}}
              transition={{ duration: 0.5 }}
            >
              <IconComponent 
                className={`w-6 h-6 transition-transform duration-300 ${
                  isSelected ? "scale-110" : item.iconColor
                }`} 
              />
            </motion.div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider leading-tight">
              {textLabel}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
