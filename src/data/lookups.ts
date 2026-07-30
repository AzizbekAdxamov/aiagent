import type {
  Region,
  EducationType,
  EducationLanguage,
  Degree,
  InstitutionCategory,
} from "@/types";

export const REGIONS: Region[] = [
  { id: 1, nameUz: "Qoraqalpog'iston Respublikasi", nameRu: "Республика Каракалпакстан", nameEn: "Republic of Karakalpakstan" },
  { id: 2, nameUz: "Andijon viloyati", nameRu: "Андижанская область", nameEn: "Andijan Region" },
  { id: 3, nameUz: "Buxoro viloyati", nameRu: "Бухарская область", nameEn: "Bukhara Region" },
  { id: 4, nameUz: "Jizzax viloyati", nameRu: "Джизакская область", nameEn: "Jizzakh Region" },
  { id: 5, nameUz: "Qashqadaryo viloyati", nameRu: "Кашкадарьинская область", nameEn: "Kashkadarya Region" },
  { id: 6, nameUz: "Navoiy viloyati", nameRu: "Навоийская область", nameEn: "Navoi Region" },
  { id: 7, nameUz: "Namangan viloyati", nameRu: "Наманганская область", nameEn: "Namangan Region" },
  { id: 8, nameUz: "Samarqand viloyati", nameRu: "Самаркандская область", nameEn: "Samarkand Region" },
  { id: 9, nameUz: "Surxondaryo viloyati", nameRu: "Сурхандарьинская область", nameEn: "Surkhandarya Region" },
  { id: 10, nameUz: "Sirdaryo viloyati", nameRu: "Сырдарьинская область", nameEn: "Syrdarya Region" },
  { id: 11, nameUz: "Toshkent viloyati", nameRu: "Ташкентская область", nameEn: "Tashkent Region" },
  { id: 12, nameUz: "Farg'ona viloyati", nameRu: "Ферганская область", nameEn: "Fergana Region" },
  { id: 13, nameUz: "Xorazm viloyati", nameRu: "Хорезмская область", nameEn: "Khorezm Region" },
  { id: 14, nameUz: "Toshkent shahri", nameRu: "Город Ташкент", nameEn: "Tashkent City" },
  { id: 15, nameUz: "Boshqa", nameRu: "Другой", nameEn: "Other" },
];

export const EDUCATION_TYPES: EducationType[] = [
  { id: 1, nameUz: "Kunduzgi", nameRu: "Очное", nameEn: "Full-time" },
  { id: 2, nameUz: "Sirtqi", nameRu: "Заочное", nameEn: "Part-time" },
  { id: 3, nameUz: "Kechki", nameRu: "Вечернее", nameEn: "Evening" },
  { id: 4, nameUz: "Masofaviy", nameRu: "Дистанционное", nameEn: "Distance Learning" },
];

export const EDUCATION_LANGUAGES: EducationLanguage[] = [
  { id: 1, nameUz: "O'zbek", nameRu: "Узбекский язык", nameEn: "Uzbek", code: "uz" },
  { id: 2, nameUz: "Ingliz", nameRu: "Английский язык", nameEn: "English", code: "en" },
  { id: 3, nameUz: "Rus", nameRu: "Русский язык", nameEn: "Russian", code: "ru" },
  { id: 4, nameUz: "Turkman tili", nameRu: "Туркменский язык", nameEn: "Turkman", code: "tk" },
  { id: 5, nameUz: "Qozoq tili", nameRu: "Казахский язык", nameEn: "Kazak", code: "kk" },
  { id: 6, nameUz: "Qoraqalpoq tili", nameRu: "Каракалпакский язык", nameEn: "Karakalpak", code: "kaa" },
  { id: 7, nameUz: "Qirg'iz tili", nameRu: "Кыргызский язык", nameEn: "Kyrgyz", code: "ky" },
  { id: 8, nameUz: "Tojik tili", nameRu: "Таджикский язык", nameEn: "Tadjik", code: "tg" },
  { id: 9, nameUz: "Arab tili", nameRu: "Арабский язык", nameEn: "Arabic", code: "ar" },
  { id: 10, nameUz: "Xitoy tili", nameRu: "Китайский язык", nameEn: "Chinese", code: "zh" },
  { id: 11, nameUz: "Nemis tili", nameRu: "Немецкий язык", nameEn: "German", code: "de" },
];

export const DEGREES: Degree[] = [
  { id: 1, nameUz: "Bakalavr", nameRu: "Бакалавр", nameEn: "Bachelor" },
  { id: 2, nameUz: "Magistr", nameRu: "Магистр", nameEn: "Master" },
  { id: 3, nameUz: "Doktorantura", nameRu: "Докторантура", nameEn: "PhD" },
  { id: 4, nameUz: "O'qishni ko'chirish", nameRu: "Перевод", nameEn: "Transfer" },
];

export const INSTITUTION_CATEGORIES: InstitutionCategory[] = [
  { id: 1, nameUz: "Maktab", nameRu: "Школа", nameEn: "School" },
  { id: 2, nameUz: "Litsey", nameRu: "Лицей", nameEn: "Lyceum" },
  { id: 3, nameUz: "Davlat universiteti", nameRu: "Государственный университет", nameEn: "State University" },
  { id: 4, nameUz: "Xususiy universitet", nameRu: "Частный университет", nameEn: "Private University" },
  { id: 5, nameUz: "Xalqaro universitet", nameRu: "Международный университет", nameEn: "International University" },
  { id: 6, nameUz: "Kasb-hunar maktabi", nameRu: "Профессиональная школа", nameEn: "Vocational School" },
  { id: 7, nameUz: "Boshqa", nameRu: "Другое", nameEn: "Other" },
  { id: 8, nameUz: "Prezident maktabi", nameRu: "Президентская школа", nameEn: "Presidential School" },
  { id: 9, nameUz: "Temurbeklar maktabi", nameRu: "Школа Темура", nameEn: "Temurbek School" },
];

// ============ Lookup Service ============

export class LookupManager {
  private regions: Region[] = REGIONS;
  private educationTypes: EducationType[] = EDUCATION_TYPES;
  private educationLanguages: EducationLanguage[] = EDUCATION_LANGUAGES;
  private degrees: Degree[] = DEGREES;
  private categories: InstitutionCategory[] = INSTITUTION_CATEGORIES;

  getRegionName(id: number, lang: "uz" | "ru" | "en" = "uz"): string {
    const region = this.regions.find((r) => r.id === id);
    if (!region) return `Region #${id}`;
    return lang === "uz" ? region.nameUz : lang === "ru" ? region.nameRu : region.nameEn;
  }

  getEducationTypeName(id: number, lang: "uz" | "ru" | "en" = "uz"): string {
    const et = this.educationTypes.find((e) => e.id === id);
    if (!et) return `Education Type #${id}`;
    return lang === "uz" ? et.nameUz : lang === "ru" ? et.nameRu : et.nameEn;
  }

  getEducationLanguageName(id: number, lang: "uz" | "ru" | "en" = "uz"): string {
    const el = this.educationLanguages.find((e) => e.id === id);
    if (!el) return `Language #${id}`;
    return lang === "uz" ? el.nameUz : lang === "ru" ? el.nameRu : el.nameEn;
  }

  getDegreeName(id: number, lang: "uz" | "ru" | "en" = "uz"): string {
    const degree = this.degrees.find((d) => d.id === id);
    if (!degree) return `Degree #${id}`;
    return lang === "uz" ? degree.nameUz : lang === "ru" ? degree.nameRu : degree.nameEn;
  }

  getCategoryName(id: number, lang: "uz" | "ru" | "en" = "uz"): string {
    const cat = this.categories.find((c) => c.id === id);
    if (!cat) return `Category #${id}`;
    return lang === "uz" ? cat.nameUz : lang === "ru" ? cat.nameRu : cat.nameEn;
  }

  resolveIds(data: Record<string, any>, lang: "uz" | "ru" | "en" = "uz"): Record<string, any> {
    const resolved: Record<string, any> = { ...data };

    if (resolved.location_id !== undefined) {
      resolved.location_name = this.getRegionName(resolved.location_id, lang);
    }
    if (resolved.education_type_id !== undefined) {
      resolved.education_type_name = this.getEducationTypeName(resolved.education_type_id, lang);
    }
    if (resolved.education_language_id !== undefined) {
      resolved.education_language_name = this.getEducationLanguageName(resolved.education_language_id, lang);
    }
    if (resolved.degree_ids && Array.isArray(resolved.degree_ids)) {
      resolved.degree_names = resolved.degree_ids.map((id: number) => this.getDegreeName(id, lang));
    }
    if (resolved.institution_category_id !== undefined) {
      resolved.institution_category_name = this.getCategoryName(resolved.institution_category_id, lang);
    }

    return resolved;
  }
}

export const lookupManager = new LookupManager();
