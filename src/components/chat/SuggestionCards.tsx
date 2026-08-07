"use client";

import { Lightbulb, Search, GraduationCap, DollarSign, Newspaper, ChevronRight } from "lucide-react";

interface SuggestionCardsProps {
  onSelect: (suggestion: string) => void;
}

const suggestions = [
  {
    icon: Search,
    title: "Universitetlar",
    description: "Barcha universitetlar ro'yxati",
    prompt: "Universitetlar haqida ma'lumot ber",
    gradient: "from-blue-500 to-blue-600",
    bgLight: "bg-blue-50",
    darkBg: "dark:bg-blue-950/40",
    textColor: "text-blue-600",
    hoverBg: "group-hover:bg-blue-100",
    shadowColor: "shadow-blue-100",
  },
  {
    icon: GraduationCap,
    title: "Yo'nalishlar",
    description: "IT, tibbiyot, iqtisod va boshqalar",
    prompt: "IT yo'nalishlari haqida ma'lumot ber",
    gradient: "from-emerald-500 to-emerald-600",
    bgLight: "bg-emerald-50",
    darkBg: "dark:bg-emerald-950/40",
    textColor: "text-emerald-600",
    hoverBg: "group-hover:bg-emerald-100",
    shadowColor: "shadow-emerald-100",
  },
  {
    icon: DollarSign,
    title: "Grantlar",
    description: "100% grant va stipendiyalar",
    prompt: "Grantlar haqida ma'lumot ber",
    gradient: "from-amber-500 to-amber-600",
    bgLight: "bg-amber-50",
    darkBg: "dark:bg-amber-950/40",
    textColor: "text-amber-600",
    hoverBg: "group-hover:bg-amber-100",
    shadowColor: "shadow-amber-100",
  },
  {
    icon: Newspaper,
    title: "Yangiliklar",
    description: "So'nggi ta'lim yangiliklari",
    prompt: "So'nggi yangiliklarni ko'rsat",
    gradient: "from-rose-500 to-rose-600",
    bgLight: "bg-rose-50",
    darkBg: "dark:bg-rose-950/40",
    textColor: "text-rose-600",
    hoverBg: "group-hover:bg-rose-100",
    shadowColor: "shadow-rose-100",
  },
];

export function SuggestionCards({ onSelect }: SuggestionCardsProps) {
  return (
    <div className="px-4 py-4 sm:py-6">
      <div className="max-w-2xl mx-auto">
        {/* Section Header */}
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
            <Lightbulb className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Nimani bilishni xohlaysiz?
          </h3>
          <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800 ml-2" />
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {suggestions.map((suggestion, index) => {
            const Icon = suggestion.icon;
            return (
              <button
                key={index}
                onClick={() => onSelect(suggestion.prompt)}
                className="group relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-300 hover:shadow-lg text-left press-effect"
                style={{
                  animation: `slideIn 0.4s ease-out ${index * 0.1}s both`,
                }}
              >
                {/* Hover gradient overlay */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${suggestion.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`}
                />

                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-xl ${suggestion.bgLight} ${suggestion.darkBg} flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110 group-hover:${suggestion.hoverBg}`}
                >
                  <Icon className={`w-5 h-5 ${suggestion.textColor} transition-transform duration-300 group-hover:rotate-[-8deg]`} />
                </div>

                {/* Text */}
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-0.5 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  {suggestion.title}
                </h4>
                <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors">
                  {suggestion.description}
                </p>

                {/* Arrow indicator */}
                <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full ${suggestion.bgLight} ${suggestion.darkBg} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0`}>
                  <ChevronRight className={`w-3 h-3 ${suggestion.textColor}`} />
                </div>

                {/* Bottom gradient accent */}
                <div
                  className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${suggestion.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
