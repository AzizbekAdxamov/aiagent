"use client";

import { Award, Building2, MapPin, Calendar, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface GrantCardProps {
  grant: {
    grantTitleUz?: string;
    grantTitleEn?: string;
    grantDescUz?: string;
    grantDescEn?: string;
    grantImage?: string;
    universityNameUz?: string;
    universityNameEn?: string;
    universitySlugName?: string;
    regionNameUz?: string;
    createdAt?: string;
  };
}

export function GrantCard({ grant }: GrantCardProps) {
  const [expanded, setExpanded] = useState(false);
  const description = grant.grantDescUz || grant.grantDescEn || "";
  const isLong = description.length > 150;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden card-hover hover:shadow-md">
      {/* Image */}
      {grant.grantImage && (
        <div className="relative h-32 overflow-hidden">
          <img
            src={grant.grantImage}
            alt={grant.grantTitleUz || "Grant"}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title & University */}
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">
            {grant.grantTitleUz || grant.grantTitleEn}
          </h3>
          {grant.universityNameUz && (
            <div className="flex items-center gap-1 mt-1">
              <Building2 className="w-3 h-3 text-gray-400 dark:text-gray-500" />
              <p className="text-xs text-gray-500 dark:text-gray-400">{grant.universityNameUz}</p>
            </div>
          )}
        </div>

        {/* Info Badges */}
        <div className="flex flex-wrap gap-1.5">
          {grant.regionNameUz && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs">
              <MapPin className="w-3 h-3" />
              {grant.regionNameUz}
            </span>
          )}
          {grant.createdAt && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
              <Calendar className="w-3 h-3" />
              {new Date(grant.createdAt).toLocaleDateString("uz-UZ")}
            </span>
          )}
        </div>

        {/* Description */}
        {description && (
          <div>
            <p className={`text-xs text-gray-500 dark:text-gray-400 leading-relaxed ${!expanded && isLong ? "line-clamp-3" : ""}`}>
              {description}
            </p>
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 mt-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
              >
                {expanded ? (
                  <>Qisqartirish <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>To'liq o'qish <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
