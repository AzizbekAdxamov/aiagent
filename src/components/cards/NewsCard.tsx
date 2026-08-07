"use client";

import { Newspaper, Calendar, Eye, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface NewsCardProps {
  news: {
    titleUz?: string;
    titleEn?: string;
    descriptionUz?: string;
    descriptionEn?: string;
    headerImage?: string;
    createdAt?: string;
    viewsCount?: number;
  };
}

export function NewsCard({ news }: NewsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const description = news.descriptionUz || news.descriptionEn || "";
  const isLong = description.length > 200;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden card-hover hover:shadow-md">
      {/* Image */}
      {news.headerImage && (
        <div className="relative h-36 overflow-hidden">
          <img
            src={news.headerImage}
            alt={news.titleUz || "News"}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-2.5">
        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight line-clamp-2">
          {news.titleUz || news.titleEn}
        </h3>

        {/* Meta */}
        <div className="flex items-center gap-3">
          {news.createdAt && (
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Calendar className="w-3 h-3" />
              {new Date(news.createdAt).toLocaleDateString("uz-UZ", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
          {news.viewsCount !== undefined && (
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Eye className="w-3 h-3" />
              {news.viewsCount}
            </span>
          )}
        </div>

        {/* Description */}
        {description && (
          <div>
            <p className={`text-xs text-gray-500 dark:text-gray-400 leading-relaxed ${!expanded && isLong ? "line-clamp-2" : ""}`}>
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
