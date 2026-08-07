"use client";

import { useState } from "react";
import { Building2, MapPin, DollarSign, GraduationCap, Hotel, Award, CheckCircle, XCircle, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";

interface ComparisonItem {
  name: string;
  type?: string;
  location?: string;
  hasGrant?: boolean;
  hasAccommodation?: boolean;
  tuition?: string;
  directionCount?: number | string;
  studentsCount?: number | string;
  isOpenForAdmission?: boolean;
  website?: string;
}

interface ComparisonTableProps {
  data: ComparisonItem[];
}

const ROW_CONFIG = [
  { key: "type", label: "Turi", icon: GraduationCap, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50" },
  { key: "location", label: "Manzil", icon: MapPin, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50" },
  { key: "tuition", label: "To'lov", icon: DollarSign, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-50" },
  { key: "hasGrant", label: "Grant", icon: Award, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50", isBool: true },
  { key: "hasAccommodation", label: "Yotoqxona", icon: Hotel, color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-50", isBool: true },
  { key: "directionCount", label: "Yo'nalishlar", icon: GraduationCap, color: "text-indigo-600 dark:text-indigo-400", bgColor: "bg-indigo-50" },
  { key: "studentsCount", label: "Talabalar", icon: TrendingUp, color: "text-rose-600 dark:text-rose-400", bgColor: "bg-rose-50" },
  { key: "isOpenForAdmission", label: "Qabul", icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-50", isBool: true },
];

export function ComparisonTable({ data }: ComparisonTableProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? ROW_CONFIG : ROW_CONFIG.slice(0, 4);

  if (!data || data.length === 0) return null;

  return (
    <div className="my-3 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm bg-white dark:bg-gray-800">
      {/* Table Header */}
      <div className="bg-gradient-to-r from-primary-500 to-secondary-500 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-white font-semibold text-sm">Universitetlarni taqqoslash</h3>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="text-left px-4 py-3 text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider w-32">
                Ko'rsatkich
              </th>
              {data.map((item, idx) => (
                <th
                  key={idx}
                  className={`px-4 py-3 text-center font-semibold ${
                    idx === 0
                      ? "text-primary-600 dark:text-primary-400 bg-primary-50/30 dark:bg-primary-950/30"
                      : "text-gray-700 dark:text-gray-200"
                  }`}
                >
                  <span className="text-xs leading-tight block max-w-[120px] mx-auto">
                    {item.name?.length > 30
                      ? item.name?.substring(0, 27) + "..."
                      : item.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visibleRows.map((row) => {
              const Icon = row.icon;
              return (
                <tr
                  key={row.key}
                  className="hover:bg-gray-50/50 transition-colors duration-150"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg ${row.bgColor} dark:bg-gray-700/60 flex items-center justify-center`}>
                        <Icon className={`w-3 h-3 ${row.color}`} />
                      </div>
                      <span className="text-gray-500 dark:text-gray-400 font-medium">
                        {row.label}
                      </span>
                    </div>
                  </td>
                  {data.map((item, idx) => {
                    const value = (item as any)[row.key];
                    const isFirst = idx === 0;
                    return (
                      <td
                        key={idx}
                        className={`px-4 py-2.5 text-center ${
                          isFirst ? "bg-primary-50/20 dark:bg-primary-950/20" : ""
                        }`}
                      >
                        {row.isBool ? (
                          <span className="inline-flex items-center justify-center">
                            {value ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-300" />
                            )}
                          </span>
                        ) : (
                          <span
                            className={`font-medium ${
                              isFirst ? "text-primary-700 dark:text-primary-300" : "text-gray-600 dark:text-gray-300"
                            }`}
                          >
                            {value || "—"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Best Value Highlight */}
            {data.length >= 2 && (
              <tr className="bg-gradient-to-r from-amber-50/50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/20">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                      <Award className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-amber-700 dark:text-amber-400 font-medium text-xs">
                      Eng yaxshi
                    </span>
                  </div>
                </td>
                {data.map((_, idx) => (
                  <td
                    key={idx}
                    className={`px-4 py-2.5 text-center ${
                      idx === 0 ? "bg-amber-50/30 dark:bg-amber-950/20" : ""
                    }`}
                  >
                    {idx === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 text-[10px] font-semibold">
                        <Award className="w-2.5 h-2.5" /> Top
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-[10px]">—</span>
                    )}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Expand/Collapse */}
      {ROW_CONFIG.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2.5 border-t border-gray-50 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-all duration-200"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Qisqartirish</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Yana {ROW_CONFIG.length - 4} ta ko'rsatkich</span>
            </>
          )}
        </button>
      )}

      {/* Links */}
      {data.some((d) => d.website) && (
        <div className="flex flex-wrap gap-2 px-4 py-2.5 border-t border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          {data.map((item, idx) =>
            item.website ? (
              <a
                key={idx}
                href={item.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
              >
                <Building2 className="w-2.5 h-2.5" />
                {item.name?.substring(0, 15)}...
              </a>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
