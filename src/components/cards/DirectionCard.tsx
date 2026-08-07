"use client";

import { BookOpen, GraduationCap, Globe, Banknote, CheckCircle, XCircle, FileText } from "lucide-react";

interface DirectionCardProps {
  direction: {
    nameUz?: string;
    nameEn?: string;
    universityName?: string;
    degreeNames?: string[];
    hasStipend?: boolean;
    isOpenForAdmission?: boolean;
    isStudyTransferable?: boolean;
    requirementUz?: string;
    firstSubject?: string;
    secondSubject?: string;
    educationTypeLanguages?: Array<{
      educationType: string;
      educationLanguage: string;
      localTuitionFee?: number | null;
      internationalTuitionFee?: number | null;
      academicYear?: number | null;
    }>;
  };
}

export function DirectionCard({ direction }: DirectionCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden card-hover hover:shadow-md">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-white/90" />
          <div>
            <h3 className="text-white font-semibold text-sm">
              {direction.nameUz || direction.nameEn}
            </h3>
            {direction.universityName && (
              <p className="text-white/70 text-xs">{direction.universityName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Degrees */}
        {direction.degreeNames && direction.degreeNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {direction.degreeNames.map((degree, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                <GraduationCap className="w-3 h-3" />
                {degree}
              </span>
            ))}
          </div>
        )}

        {/* Status badges */}
        <div className="flex flex-wrap gap-1.5">
          {direction.hasStipend && (
            <span className="px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 text-xs font-medium">
              💰 Stipendiya bor
            </span>
          )}
          {direction.isOpenForAdmission && (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-medium">
              ✅ Qabul ochiq
            </span>
          )}
          {direction.isStudyTransferable && (
            <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-medium">
              🔄 Ko'chirish mumkin
            </span>
          )}
        </div>

        {/* Tuition Info */}
        {direction.educationTypeLanguages && direction.educationTypeLanguages.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">To'lov ma'lumotlari:</p>
            <div className="space-y-1.5">
              {direction.educationTypeLanguages.map((etl, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {etl.educationType} / {etl.educationLanguage}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-100">
                    {etl.localTuitionFee
                      ? `${(etl.localTuitionFee / 1000000).toFixed(0)} mln`
                      : "N/A"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Requirements */}
        {direction.requirementUz && (
          <div className="flex items-start gap-1.5 pt-1 border-t border-gray-50 dark:border-gray-800">
            <FileText className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
            <p className="text-xs text-gray-500 dark:text-gray-400">{direction.requirementUz}</p>
          </div>
        )}

        {/* Required Subjects */}
        {(direction.firstSubject || direction.secondSubject) && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-50 dark:border-gray-800">
            <BookOpen className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <span>Fanlar: {[direction.firstSubject, direction.secondSubject].filter(Boolean).join(", ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
