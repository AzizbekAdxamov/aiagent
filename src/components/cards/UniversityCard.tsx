"use client";

import { Building2, MapPin, Phone, Globe, GraduationCap, DollarSign, Hotel, Award, ExternalLink } from "lucide-react";

interface UniversityCardProps {
  university: {
    fullNameUz?: string;
    fullNameEn?: string;
    abbrNameUz?: string;
    descriptionUz?: string;
    institutionCategory?: string;
    location?: string;
    phone?: string;
    email?: string;
    website?: string;
    tuition?: string;
    hasGrant?: boolean;
    hasAccommodation?: boolean;
    isOpenForAdmission?: boolean;
    foundedYear?: number;
    studentsCount?: number;
    logo?: string;
  };
}

export function UniversityCard({ university }: UniversityCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden card-hover hover:shadow-md transition-all duration-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3">
        <div className="flex items-center gap-3">
          {university.logo ? (
            <img
              src={university.logo}
              alt={university.abbrNameUz || university.fullNameUz || ""}
              className="w-10 h-10 rounded-lg bg-white/20 object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-sm truncate">
              {university.fullNameUz || university.fullNameEn}
            </h3>
            {university.abbrNameUz && (
              <p className="text-white/70 text-xs">{university.abbrNameUz}</p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2.5">
        {/* Type & Location */}
        <div className="flex flex-wrap gap-2">
          {university.institutionCategory && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              <GraduationCap className="w-3 h-3" />
              {university.institutionCategory}
            </span>
          )}
          {university.location && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 text-xs">
              <MapPin className="w-3 h-3" />
              {university.location}
            </span>
          )}
        </div>

        {/* Description */}
        {university.descriptionUz && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
            {university.descriptionUz}
          </p>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {university.tuition && university.tuition !== "N/A" && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <DollarSign className="w-3.5 h-3.5 text-green-500" />
              <span>{university.tuition}</span>
            </div>
          )}
          {university.foundedYear && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>{university.foundedYear}</span>
            </div>
          )}
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {university.hasGrant && (
            <span className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-xs font-medium">
              ✅ Grant mavjud
            </span>
          )}
          {university.hasAccommodation && (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
              🏠 Yotoqxona
            </span>
          )}
          {university.isOpenForAdmission && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">
              📋 Qabul ochiq
            </span>
          )}
        </div>

        {/* Contact */}
        {(university.phone || university.email || university.website) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-gray-50">
            {university.phone && (
              <a href={`tel:${university.phone}`} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700">
                <Phone className="w-3 h-3" />
                {university.phone}
              </a>
            )}
            {university.website && (
              <a href={university.website} target="_blank" className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700">
                <Globe className="w-3 h-3" />
                <span>Website</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
