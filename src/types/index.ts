// ============ University Types ============

export interface University {
  id: number;
  slug: string;
  fullNameUz: string;
  fullNameRu?: string | null;
  fullNameEn?: string | null;
  abbrNameUz?: string | null;
  abbrNameRu?: string | null;
  abbrNameEn?: string | null;
  descriptionUz?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
  logo?: string | null;
  institutionCategoryId?: number | null;
  institutionType?: string | null;
  locationId?: number | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  supportEmail?: string | null;
  domain?: string | null;
  foundedYear?: number | null;
  studentsCount?: number | null;
  minimalTuitionFee?: number | null;
  maximalTuitionFee?: number | null;
  addressUz?: string | null;
  addressRu?: string | null;
  addressEn?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  admissionPhone?: string | null;
  admissionStartDate?: string | null;
  admissionDeadline?: string | null;
  currentQuota?: number | null;
  hasAccommodation: boolean;
  hasGrant: boolean;
  isPartner: boolean;
  isOpenForAdmission: boolean;
  isBanned: boolean;
  representativeFullName?: string | null;
  certificationLink?: string | null;
  accreditationCertificate?: string | null;
  instagramUsername?: string | null;
  telegramUsername?: string | null;
  facebookUsername?: string | null;
  linkedinUsername?: string | null;
  youtubeUsername?: string | null;
  gallery?: Gallery[];
}

export interface Gallery {
  id: number;
  universityId: number;
  imageUrl: string;
  captionUz?: string | null;
  captionRu?: string | null;
  captionEn?: string | null;
}

// ============ Direction Types ============

export interface Direction {
  id: number;
  universityId: number;
  slug: string;
  idNumber?: string | null;
  nameUz: string;
  nameRu?: string | null;
  nameEn?: string | null;
  descriptionUz?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
  categoryId?: number | null;
  degreeIds: number[];
  contractTypeIds: number[];
  hasStipend: boolean;
  startDate?: string | null;
  endDate?: string | null;
  isOpenForAdmission: boolean;
  isStudyTransferable: boolean;
  transferStartDate?: string | null;
  transferEndDate?: string | null;
  requirementUz?: string | null;
  requirementRu?: string | null;
  requirementEn?: string | null;
  hasMandatorySubjects: boolean;
  firstSubject?: string | null;
  secondSubject?: string | null;
  examSubjects?: ExamSubject | null;
  educationTypeLanguages: EducationTypeLanguage[];
  university?: University;
}

export interface ExamSubject {
  firstSubjectId?: number;
  firstSubjectNameUz?: string;
  firstSubjectNameRu?: string;
  firstSubjectNameEn?: string;
  secondSubjectId?: number;
  secondSubjectNameUz?: string;
  secondSubjectNameRu?: string;
  secondSubjectNameEn?: string;
  thirdSubjectId?: number;
  thirdSubjectNameUz?: string;
  thirdSubjectNameRu?: string;
  thirdSubjectNameEn?: string;
}

export interface EducationTypeLanguage {
  id: number;
  directionId: number;
  academicYear?: number | null;
  educationTypeId: number;
  educationLanguageId: number;
  localTuitionFee?: number | null;
  internationalTuitionFee?: number | null;
}

// ============ Grant Types ============

export interface UniversityGrant {
  id: number;
  grantImage?: string | null;
  universitySlugName?: string | null;
  universityNameUz?: string | null;
  universityNameRu?: string | null;
  universityNameEn?: string | null;
  universityLogo?: string | null;
  regionNameUz?: string | null;
  regionNameRu?: string | null;
  regionNameEn?: string | null;
  grantTitleUz?: string | null;
  grantTitleRu?: string | null;
  grantTitleEn?: string | null;
  grantDescUz?: string | null;
  grantDescRu?: string | null;
  grantDescEn?: string | null;
  status: string;
  order?: number | null;
  createdAt: string;
}

// ============ News Types ============

export interface NewsItem {
  id: number;
  relatedTo?: string | null;
  relationId?: number | null;
  headerImage?: string | null;
  titleUz?: string | null;
  titleRu?: string | null;
  titleEn?: string | null;
  descriptionUz?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
  status: string;
  viewsCount: number;
  tagIds: number[];
  createdAt: string;
}

// ============ Lookup Types ============

export interface Region {
  id: number;
  nameUz: string;
  nameRu: string;
  nameEn: string;
}

export interface EducationType {
  id: number;
  nameUz: string;
  nameRu: string;
  nameEn: string;
}

export interface EducationLanguage {
  id: number;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  code: string;
}

export interface Degree {
  id: number;
  nameUz: string;
  nameRu: string;
  nameEn: string;
}

export interface InstitutionCategory {
  id: number;
  nameUz: string;
  nameRu: string;
  nameEn: string;
}

// ============ AI Agent Types ============

export type Intent =
  | "university_search"
  | "university_list"   // Katalog: "qanday universitetlar bor" — qidiruv emas
  | "university_detail" // Batafsil: "X universiteti haqida batafsil ma'lumot" (BOSQICH 4 — JSON-only intent)
  | "direction_search"
  | "direction_list"    // Katalog: "qanday yo'nalishlar mavjud" — qidiruv emas
  | "grant_search"
  | "grant_list"        // Katalog: "qanday grantlar bor"
  | "news_search"
  | "news_list"         // Katalog: "qanday yangiliklar bor"
  | "tuition_search"    // "eng arzon universitet" — narx bo'yicha qidiruv
  | "comparison"
  | "admission"
  | "transfer"
  | "recommendation"
  | "general_chat"   // Umumiy suhbat / maslahat — ruhiy qo'llab-quvvatlash, hayot maslahati (tool chaqirilmaydi)
  | "faq"
  | "greeting"
  | "unknown";

export type Tool =
  | "get_university"
  | "search_university"
  | "list_directions"   // Katalog: yo'nalish kategoriyalari ro'yxati (API chaqiruvsiz)
  | "search_direction"
  | "search_grants"
  | "search_news"
  | "search_tuition"    // Narx bo'yicha qidiruv (eng arzon)
  | "compare_universities"
  | "recommend"
  | "lookup"
  | "none";

export interface IntentResult {
  intent: Intent;
  confidence: number;
  secondaryIntents?: string[];
  /**
   * CONFIDENCE SCORE (BOSQICH 7): har bir entity uchun ishonch bali (0-1).
   * Past ishonch (< 0.7) bo'lsa agent aniqlashtiruvchi savol so'raydi.
   * Masalan: "Kompyutr" → direction: { it: 0.61 } → "«IT» yo'nalishini nazarda tutdingizmi?"
   */
  entityConfidence?: Record<string, number>;
  entities: {
    university?: string;
    direction?: string;
    region?: string;
    degree?: string;
    language?: string;
    educationType?: string;
    grantType?: string;
    institutionCategory?: string;  // "3"=davlat, "4"=xususiy, "5"=xalqaro
    institutionCategories?: string[]; // YANGI (Fix): "davlat yoki xalqaro" → ["3", "5"]
    accommodation?: string;        // "true"=yotoqxona so'ralgan
    // ---- Entity-First kengaytmalar (BOSQICH 1) ----
    tuitionMax?: number;           // byudjet yuqori chegarasi (so'm): "20 mln gacha" → 20000000
    tuitionMin?: number;           // byudjet pastki chegarasi (so'm): "15 mln dan yuqori" → 15000000
    faculty?: string;              // fakultet nomi: "stomatologiya fakulteti"
    deadline?: string;             // qabul muddati: "deadline", "hujjat topshirish"
    newsCategory?: string;         // yangilik kategoriyasi: "grant", "sport"
    hasStipend?: boolean;          // stipendiya so'ralgan: "stipendiyali" → true
    // ---- Profil kengaytmalar (YANGI) ----
    preferredCities?: string[];    // afzal shaharlar: ["toshkent", "samarqand"]
    careerGoal?: string;           // kasb maqsadi: "ai_medicine", "medicine", "software_dev"
    englishLevel?: string;         // ingliz darajasi: "C1", "B2", "IELTS 7.0"
    wantsInternational?: boolean;  // xalqaro diplom kerakmi?
  };
}

export interface ToolResult {
  tool: Tool;
  success: boolean;
  data?: any;
  error?: string;
  cached?: boolean;
  /**
   * TOOL ACCESS POLICY (GUEST REJIM): true bo'lsa tool data tool'i bo'lib,
   * foydalanuvchi login qilmagan (guest) — Mentalaba API'ga UMUMAN
   * chaqirilmaydi, login so'raladi. Yoki login qilingan bo'lsa ham user
   * tokeni muddati tugab refresh ishlamagan (AUTH_EXPIRED).
   */
  authRequired?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent?: string;
  selectedTool?: string;
  toolResults?: any;
  timestamp: Date;
}

export interface SessionContext {
  currentUniversity?: University;
  currentUniversityId?: number;
  currentDirection?: Direction;
  currentDirectionId?: number;
  currentTopicName?: string;        // Oxirgi ko'rilgan universitet/direction nomi (follow-up uchun)
  currentDegree?: string;
  currentLanguage?: string;
  currentRegion?: string;
  currentDirectionCategory?: string;
  currentInstitutionCategory?: string;
  currentInstitutionCategories?: string[]; // Fix: "davlat yoki xalqaro" → ["3", "5"]
  currentTuitionMax?: number;       // Byudjet yuqori chegarasi (so'm) — follow-up uchun
  currentTuitionMin?: number;       // Byudjet pastki chegarasi (so'm) — follow-up uchun
  interestGrant?: boolean;
  language: "uz" | "ru" | "en";
  /**
   * RECOMMENDATION PROFILE (BOSQICH 9): session bo'ylab to'planadigan
   * foydalanuvchi profili. "Matematikam yaxshi" → strengths, "Pulim kam" →
   * budget, "Toshkentda o'qimoqchiman" → city. Har bir yangi ma'lumot
   * qo'shiladi — keyingi javoblar shu profilga asoslanadi (JARVIS usuli).
   * Metadata JSON'da saqlanadi (Prisma ChatSession.metadata).
   */
  recommendationProfile?: {
    interests?: string[];          // "AI", "IT", "tibbiyot"...
    strengths?: string[];          // "matematika", "biologiya"...
    weaknesses?: string[];         // "fizika", "matematika"...
    budgetLevel?: "low" | "mid" | "high";
    budget?: number;               // YANGI: aniq byudjet (so'm)
    city?: string;                 // "Toshkent", "Samarqand"... (home region)
    preferredCities?: string[];    // YANGI: afzal o'qish shaharlari ["toshkent", "samarqand"]
    language?: string;             // "english", "russian", "uzbek"
    englishLevel?: string;         // YANGI: "C1", "B2", "IELTS 7.0"
    degree?: string;               // "bachelor", "master", "phd"
    interestGrant?: boolean;
    wantsForeign?: boolean;        // "xorijga ketmoqchiman"
    wantsHostel?: boolean;         // YANGI: yotoqxona kerak
    wantsInternational?: boolean;  // YANGI: xalqaro diplom kerak
    careerGoal?: string;           // YANGI: "ai_medicine", "medicine", "software_dev"
  };
  /**
   * RECOMMENDATION MEMORY (BOSQICH 9): oxirgi tavsiya qilingan universitetlar.
   * "Yotoqxonasi bormi?" kabi follow-up so'rovlarda qayta qidirish o'rniga
   * shu ro'yxat ishlatiladi. { universityId: fullNameUz } formatida.
   */
  lastRecommendations?: Array<{
    id: number;
    name: string;
    slug?: string;
    /** BOSQICH 14: "Nega aynan X?" tushuntirish uchun backend hisoblagan ball va sabablar */
    score?: { total: number; reasons: string[]; nuances: string[] };
  }>;
  /**
   * LAST UNIVERSITY MEMORY (BOSQICH 11): oxirgi ko'rilgan/ko'rsatilgan
   * universitet (search_university / search_direction / recommend /
   * get_university ishlaganda yoziladi). Follow-up savollar ("uning
   * narxlari qancha?", "kontrakti qancha?", "telefoni?") shu universitetga
   * bog'lanadi — lastUniversity > lastGrant > lastDirection ustuvorligi.
   * Metadata JSON'da saqlanadi (Prisma ChatSession.metadata).
   */
  lastUniversity?: { id: number; name: string; slug?: string };
  /**
   * GUEST REJIM (BOSQICH 1 + GUEST): true = login qilmagan foydalanuvchi.
   * Chat route authUser yo'q bo'lganda o'rnatadi — ToolAccessPolicy shunga
   * qarab data tool'larini bloklaydi (Mentalaba API'ga chiqilmaydi).
   */
  isGuest?: boolean;
}

// ============ API Types ============

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pageInfo: {
    currentCount: number;
    totalCount: number;
    offset: number;
    limit: number;
  };
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  language?: string;
}

export interface ChatResponse {
  message: string;
  messageId?: string;
  sessionId: string;
  intent?: string;
  toolUsed?: string;
  suggestions?: string[];
}
