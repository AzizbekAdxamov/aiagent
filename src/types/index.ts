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
  | "direction_search"
  | "grant_search"
  | "news_search"
  | "comparison"
  | "admission"
  | "transfer"
  | "recommendation"
  | "faq"
  | "greeting"
  | "unknown";

export type Tool =
  | "get_university"
  | "search_university"
  | "search_direction"
  | "search_grants"
  | "search_news"
  | "compare_universities"
  | "recommend"
  | "lookup"
  | "none";

export interface IntentResult {
  intent: Intent;
  confidence: number;
  entities: {
    university?: string;
    direction?: string;
    region?: string;
    degree?: string;
    language?: string;
    educationType?: string;
    grantType?: string;
    institutionCategory?: string;  // "3"=davlat, "4"=xususiy, "5"=xalqaro
    accommodation?: string;        // "true"=yotoqxona so'ralgan
  };
}

export interface ToolResult {
  tool: Tool;
  success: boolean;
  data?: any;
  error?: string;
  cached?: boolean;
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
  interestGrant?: boolean;
  language: "uz" | "ru" | "en";
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
  sessionId: string;
  intent?: string;
  toolUsed?: string;
  suggestions?: string[];
}
