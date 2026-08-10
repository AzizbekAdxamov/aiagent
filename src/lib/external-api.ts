/**
 * Mentalaba External API Client
 * 
 * Barcha ma'lumotlar tashqi API orqali real-time olinadi.
 * Qo'llanmada ko'rsatilganidek, AI Agent hech qachon database bilan 
 * to'g'ridan-to'g'ri ishlamaydi — har doim API orqali ma'lumot oladi.
 * 
 * Base URL: https://api.mentalaba.uz/v1
 * 
 * Token: 23 soatda bir marta refresh qilinadi
 *   - Bearer token: MENTALABA_API_KEY
 *   - Refresh token: MENTALABA_REFRESH_TOKEN
 */

import iconv from 'iconv-lite';
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { apiAuthContext } from "./api-auth-context";
import { refreshUserTokens } from "./auth";

const BASE_URL = process.env.MENTALABA_API_URL || "https://api.mentalaba.uz/v1";
// .env fayli proyekt ildizida (npm run dev shu yerdan ishga tushadi)
const ENV_PATH = join(process.cwd(), ".env");
const ACCESS_TOKEN = process.env.MENTALABA_API_KEY || "";
const REFRESH_TOKEN = process.env.MENTALABA_REFRESH_TOKEN || "";

class ExternalAPI {
  private baseURL: string;
  private accessToken: string;
  private refreshTokenValue: string;
  private refreshTimer: ReturnType<typeof setTimeout> | null;
  private refreshInProgress: Promise<void> | null;
  private readonly REFRESH_INTERVAL_MS = 22 * 60 * 60 * 1000; // 22 soat

  constructor() {
    this.baseURL = BASE_URL;
    this.accessToken = ACCESS_TOKEN;
    this.refreshTokenValue = REFRESH_TOKEN;
    this.refreshTimer = null;
    this.refreshInProgress = null;

    // Avtomatik refresh tokenni rejalashtirish
    if (this.refreshTokenValue) {
      this.scheduleTokenRefresh();
    }
  }

  // ============ Token boshqaruvi ============

  /**
   * POST /v1/auth/refresh
   * Refresh token orqali yangi bearer token olish
   * Race condition dan himoyalangan: bir vaqtda faqat 1 ta refresh ishlaydi
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshTokenValue) return;

    // Race condition oldini olish: agar refresh allaqachon ishlayotgan bo'lsa,
    // yangi chaqiruvni kutib turiladi
    if (this.refreshInProgress) {
      return this.refreshInProgress;
    }

    this.refreshInProgress = this.executeTokenRefresh();
    return this.refreshInProgress;
  }

  private async executeTokenRefresh(): Promise<void> {
    try {
      let response = await this.postRefresh();

      // 401 bo'lsa — refresh token ham eskirgan bo'lishi mumkin.
      // .env ga yangi token yozilgan bo'lsa (login skript yoki qo'lda),
      // uni o'qib yana bir marta urinamiz — server restart talab qilinmaydi.
      if (response.status === 401 && this.reloadTokensFromEnv()) {
        console.log("[Token Refresh] .env dan yangi tokenlar o'qildi — qayta urinish...");
        response = await this.postRefresh();
      }

      if (!response.ok) {
        if (response.status === 401) {
          console.warn("[Token Refresh Failed] 401 — Refresh token ham muddati o'tgan.\n  ➜ Yangi token olish: node scripts/mentalaba-login.mjs (admin email + parol)\n  ➜ yoki .env dagi MENTALABA_API_KEY / MENTALABA_REFRESH_TOKEN ni yangilang.");
        } else {
          console.warn("[Token Refresh Failed]", response.status);
        }
        return;
      }

      const data = await response.json();
      // CamelCase va snake_case ni qo'llab-quvvatlash
      this.accessToken = data.accessToken || data.access_token || data.token || this.accessToken;
      if (data.refreshToken || data.refresh_token) {
        this.refreshTokenValue = data.refreshToken || data.refresh_token;
      }

      // MUHIM: aylanadigan tokenlarni .env ga yozish — server qayta ishga tushganda
      // eski o'lik token ishlatilmaydi, zanjir uzilmaydi.
      this.persistTokens();

      this.scheduleTokenRefresh();
    } catch (error) {
      console.error("[Token Refresh Error]", error);
    } finally {
      this.refreshInProgress = null;
    }
  }

  private async postRefresh(): Promise<Response> {
    return fetch(`${this.baseURL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: this.refreshTokenValue }),
    });
  }

  /**
   * .env faylidan tokenlarni qayta o'qiydi.
   * Foydalanuvchi .env ni yangilagan bo'lsa (login skript yoki qo'lda),
   * ishlayotgan server ham darhol yangi tokenni oladi — restart shart emas.
   * @returns tokenlar o'zgargan bo'lsa true
   */
  private reloadTokensFromEnv(): boolean {
    try {
      const env = readFileSync(ENV_PATH, "utf8");
      const get = (key: string) => env.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();
      const newAccess = get("MENTALABA_API_KEY");
      const newRefresh = get("MENTALABA_REFRESH_TOKEN");
      let changed = false;
      if (newAccess && newAccess !== this.accessToken) {
        this.accessToken = newAccess;
        changed = true;
      }
      if (newRefresh && newRefresh !== this.refreshTokenValue) {
        this.refreshTokenValue = newRefresh;
        changed = true;
      }
      return changed;
    } catch (error) {
      console.warn("[Token Reload Warn]", (error as Error).message);
      return false;
    }
  }

  /**
   * Yangi aylanadigan tokenlarni .env fayliga yozish.
   * Server restart bo'lsa ham yangi token ishlatiladi.
   */
  private persistTokens(): void {
    try {
      let env = readFileSync(ENV_PATH, "utf8");
      const setLine = (key: string, value: string) => {
        const line = `${key}=${value}`;
        const re = new RegExp(`^${key}=.*$`, "m");
        if (re.test(env)) env = env.replace(re, line);
        else env = env.replace(/\n*$/, "") + `\n${line}\n`;
      };
      setLine("MENTALABA_API_KEY", this.accessToken);
      setLine("MENTALABA_REFRESH_TOKEN", this.refreshTokenValue);
      writeFileSync(ENV_PATH, env);
      console.log("[Token Refresh] .env yangilandi (keyingi restart uchun ham amal qiladi)");
    } catch (error) {
      console.warn("[Token Persist Warn]", (error as Error).message);
    }
  }

  /**
   * 22 soatda bir marta tokenni yangilash
   */
  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refreshAccessToken(), this.REFRESH_INTERVAL_MS);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // PER-USER TOKEN (BOSQICH 1): so'rov kontekstida user tokeni bo'lsa —
    // global .env tokeni o'rniga USER tokeni ishlatiladi.
    const userCtx = apiAuthContext.getStore();
    const token = userCtx?.accessToken || this.accessToken;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request(endpoint: string, options?: RequestInit): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    let response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options?.headers,
      },
    });

    // 401 xatosi bo'lsa, tokenni yangilab qayta urinish
    if (response.status === 401) {
      const userCtx = apiAuthContext.getStore();
      if (userCtx?.accessToken && userCtx.refreshToken) {
        // PER-USER TOKEN (BOSQICH 1): user tokeni eskirgan → user refresh
        // tokeni bilan yangilaymiz va DB'ga yozamiz (onTokenRefreshed).
        const refreshed = await refreshUserTokens(userCtx.refreshToken);
        if (refreshed) {
          userCtx.accessToken = refreshed.accessToken;
          if (refreshed.refreshToken) userCtx.refreshToken = refreshed.refreshToken;
          try {
            userCtx.onTokenRefreshed?.(refreshed.accessToken, refreshed.refreshToken);
          } catch (e) {
            console.warn("[Token Persist Warn]", (e as Error).message);
          }
          response = await fetch(url, {
            ...options,
            headers: {
              ...this.getHeaders(),
              ...options?.headers,
            },
          });
        }
      } else if (this.refreshTokenValue) {
        // Global (admin) token — eski mexanizm
        await this.refreshAccessToken();
        response = await fetch(url, {
          ...options,
          headers: {
            ...this.getHeaders(),
            ...options?.headers,
          },
        });
      }
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`API error: ${response.status} ${response.statusText} for ${endpoint}${errorBody ? ': ' + errorBody.substring(0, 200) : ''}`);
    }

    return response.json();
  }

  // ======================================================================
  // UNIVERSITIES - Universitetlar
  // ======================================================================

  /**
   * GET /v1/universities
   * Admin: barcha universitetlar ro'yxati (status va order parametrlari bilan)
   */
  async getUniversities(params?: {
    q?: string;
    limit?: number;
    offset?: number;
    status?: "active" | "non-active" | "deleted";
    order?: "asc" | "desc";
    institutionCategoryId?: number;
    institutionType?: string;
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set("q", params.q);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    if (params?.status) searchParams.set("status", params.status);
    if (params?.order) searchParams.set("order", params.order);
    if (params?.institutionCategoryId) searchParams.set("institution_category_id", params.institutionCategoryId.toString());
    if (params?.institutionType) searchParams.set("institution_type", params.institutionType);
    const query = searchParams.toString();
    return this.request(`/universities${query ? `?${query}` : ""}`);
  }

  /**
   * GET /v1/universities/filter
   * Barcha universitetlarni filter orqali olish (asosiy user-side endpoint)
   */
  async getUniversitiesFilter(params?: {
    limit?: number;
    offset?: number;
    category?: string;
    region?: string;
    hasGrant?: string;
    search?: string;
    institutionCategoryId?: string;
    isPartner?: string;
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    if (params?.category) searchParams.set("category", params.category);
    if (params?.region) searchParams.set("region", params.region);
    if (params?.hasGrant) searchParams.set("hasGrant", params.hasGrant);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.institutionCategoryId) searchParams.set("institution_category_id", params.institutionCategoryId);
    if (params?.isPartner) searchParams.set("is_partner", params.isPartner);
    const query = searchParams.toString();
    return this.request(`/universities/filter${query ? `?${query}` : ""}`);
  }

  /**
   * GET /v1/universities/select-box
   * Select box uchun universitetlar ro'yxati
   */
  async getUniversitiesSelectBox(): Promise<any> {
    return this.request("/universities/select-box");
  }

  /**
   * GET /v1/universities/user-side/{id}
   * Universitetning to'liq ma'lumotini olish (user-side)
   */
  async getUniversityUserSide(id: number): Promise<any> {
    return this.request(`/universities/user-side/${id}`);
  }

  /**
   * GET /v1/universities/one/{slug}
   * Universitetni slug bo'yicha olish
   */
  async getUniversityBySlug(slug: string): Promise<any> {
    return this.request(`/universities/one/${encodeURIComponent(slug)}`);
  }

  /**
   * GET /v1/universities/get-university-slug/{name}
   * Universitet nomidan slug olish
   */
  async getUniversitySlug(name: string): Promise<any> {
    return this.request(`/universities/get-university-slug/${encodeURIComponent(name)}`);
  }

  /**
   * GET /v1/universities/{id}
   * Universitetni ID bo'yicha olish (admin)
   */
  async getUniversityById(id: number): Promise<any> {
    return this.request(`/universities/${id}`);
  }

  // ======================================================================
  // DIRECTIONS - Yo'nalishlar
  // ======================================================================

  /**
   * GET /v1/directions/bot
   * Barcha yo'nalishlar (bot uchun - User-Agent: MentalabaBot/1.0 kerak)
   * DIQQAT: bu endpoint faqat id, name_uz, name_ru, name_en, logo qaytaradi.
   * university_id BERMAYDI — shuning uchun yo'nalish -> universitet bog'lanishi
   * uchun getDirectionsByUniversity() ishlatilishi kerak.
   */
  async getDirectionsBot(params?: { limit?: number; offset?: number }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    const query = searchParams.toString();
    return this.request(`/directions/bot${query ? `?${query}` : ""}`, {
      headers: { "User-Agent": "MentalabaBot/1.0" },
    });
  }

  /**
   * GET /v1/directions/getAll/{universityId}
   * Berilgan universitetning barcha yo'nalishlari (id, name_uz, name_ru, name_en).
   * Swagger orqali tekshirilgan — oddiy "user" roli uchun 200 qaytaradi
   * (asosiy /v1/directions va /v1/directions/{id} 403 Forbidden beradi, faqat admin uchun).
   * Yo'nalish -> universitet bog'lanishini olishning ISHLAYDIGAN yagona yo'li shu.
   */
  async getDirectionsByUniversity(universityId: number): Promise<any> {
    return this.request(`/directions/getAll/${universityId}`);
  }

  /**
   * GET /v1/directions
   * Yo'nalishlar ro'yxati (universityId bo'yicha filter bilan)
   * DIQQAT: bu endpoint hozircha faqat admin uchun ochiq (403 qaytaradi, role: "user" bilan).
   * Oddiy foydalanuvchi/bot uchun ishlatmang — getDirectionsByUniversity() ni ishlating.
   */
  async getDirections(params?: {
    q?: string;
    limit?: number;
    offset?: number;
    universityId?: string;
    degree?: string;
    language?: string;
    search?: string;
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set("q", params.q);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    if (params?.universityId) searchParams.set("universityId", params.universityId);
    if (params?.degree) searchParams.set("degree", params.degree);
    if (params?.language) searchParams.set("language", params.language);
    if (params?.search) searchParams.set("search", params.search);
    const query = searchParams.toString();
    return this.request(`/directions${query ? `?${query}` : ""}`);
  }

  /**
   * GET /v1/directions/filter
   * Yo'nalishlarni filterlash
   */
  async filterDirections(params?: {
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set("q", params.q);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    const query = searchParams.toString();
    return this.request(`/directions/filter${query ? `?${query}` : ""}`);
  }

  /**
   * GET /v1/directions/search
   * Yo'nalishlarni qidirish (degree parametri majburiy)
   */
  async searchDirections(params: {
    degree: number;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    searchParams.set("degree", params.degree.toString());
    if (params?.q) searchParams.set("q", params.q);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    return this.request(`/directions/search?${searchParams.toString()}`);
  }

  /**
   * GET /v1/directions/{id}
   * Yo'nalishni ID bo'yicha olish
   * DIQQAT: hozircha faqat admin uchun ochiq (403 qaytaradi, role: "user" bilan).
   */
  async getDirectionById(id: number): Promise<any> {
    return this.request(`/directions/${id}`);
  }

  /**
   * GET /v1/directions/page/{slug}
   * Yo'nalishni slug bo'yicha olish
   */
  async getDirectionBySlug(slug: string): Promise<any> {
    return this.request(`/directions/page/${encodeURIComponent(slug)}`);
  }

  /**
   * GET /v1/directions/tuition-fees
   * Barcha yo'nalishlar uchun to'lov ma'lumotlari
   */
  async getTuitionFees(): Promise<any> {
    return this.request("/directions/tuition-fees");
  }

  /**
   * GET /v1/directions/exam-subjects
   * Yo'nalishlar bo'yicha imtihon fanlari
   */
  async getExamSubjects(): Promise<any> {
    return this.request("/directions/exam-subjects");
  }

  // ======================================================================
  // DEGREES - Darajalar
  // ======================================================================

  /**
   * GET /v1/degrees/filter
   * Darajalar ro'yxati (user-side filter uchun)
   */
  async getDegrees(): Promise<any> {
    return this.request("/degrees/filter");
  }

  /**
   * GET /v1/degrees?status=active
   * Darajalar ro'yxati (admin - auth talab qiladi)
   */
  async getDegreesAdmin(params?: { status?: "active" | "non-active" | "deleted" }): Promise<any> {
    const query = params?.status ? `?status=${params.status}` : "?status=active";
    return this.request(`/degrees${query}`);
  }

  // ======================================================================
  // EDUCATION TYPES - Ta'lim turlari
  // ======================================================================

  /**
   * GET /v1/education-types/filter
   * Ta'lim turlari (kunduzgi, sirtqi, kechki, masofaviy)
   */
  async getEducationTypes(): Promise<any> {
    return this.request("/education-types/filter");
  }

  /**
   * GET /v1/education-types?status=active
   * Ta'lim turlari (admin - auth talab qiladi)
   */
  async getEducationTypesAdmin(params?: { status?: "active" | "non-active" | "deleted" }): Promise<any> {
    const query = params?.status ? `?status=${params.status}` : "?status=active";
    return this.request(`/education-types${query}`);
  }

  /**
   * GET /v1/education-types/educations
   * Ta'lim turlari (qisqartirilgan ro'yxat)
   */
  async getEducations(): Promise<any> {
    return this.request("/education-types/educations");
  }

  // ======================================================================
  // EDUCATION LANGUAGES - Ta'lim tillari
  // ======================================================================

  /**
   * GET /v1/education-languages/filter
   * Ta'lim tillari (user-side)
   */
  async getEducationLanguages(): Promise<any> {
    return this.request("/education-languages/filter");
  }

  /**
   * GET /v1/education-languages?status=active
   * Ta'lim tillari (admin - auth talab qiladi)
   */
  async getEducationLanguagesAdmin(params?: { status?: "active" | "non-active" | "deleted" }): Promise<any> {
    const query = params?.status ? `?status=${params.status}` : "?status=active";
    return this.request(`/education-languages${query}`);
  }

  // ======================================================================
  // EXAM TYPES - Imtihon turlari
  // ======================================================================

  /**
   * GET /v1/exam-types?status=active
   * Imtihon turlari
   */
  async getExamTypes(params?: { status?: "active" | "non-active" | "deleted" }): Promise<any> {
    const query = params?.status ? `?status=${params.status}` : "?status=active";
    return this.request(`/exam-types${query}`);
  }

  // ======================================================================
  // SUBJECTS - Fanlar
  // ======================================================================

  /**
   * GET /v1/subjects
   * Fanlar ro'yxati
   */
  async getSubjects(): Promise<any> {
    return this.request("/subjects");
  }

  // ======================================================================
  // EXAM ADDRESSES - Imtihon manzillari
  // ======================================================================

  /**
   * GET /v1/exam-addresses
   * Imtihon manzillari
   */
  async getExamAddresses(): Promise<any> {
    return this.request("/exam-addresses");
  }

  /**
   * GET /v1/exam-addresses/for-exam
   * Imtihon uchun manzillar
   */
  async getExamAddressesForExam(): Promise<any> {
    return this.request("/exam-addresses/for-exam");
  }

  // ======================================================================
  // APPLICATION FORM - Ariza shakli
  // ======================================================================

  /**
   * GET /v1/application-form
   * Foydalanuvchining ariza shakli
   */
  async getMyApplicationForm(): Promise<any> {
    return this.request("/application-form");
  }

  // ======================================================================
  // UNIVERSITIES APPLICANTS - Universitet abiturientlari (o'z arizalari)
  // ======================================================================

  /**
   * GET /v1/universities-applicants/myApplications
   * Foydalanuvchining barcha arizalari
   */
  async getMyApplications(params?: { limit?: number; offset?: number }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    const query = searchParams.toString();
    return this.request(`/universities-applicants/myApplications${query ? `?${query}` : ""}`);
  }

  /**
   * GET /v1/universities-applicants/myApplication
   * Foydalanuvchining arizasi
   */
  async getMyApplication(): Promise<any> {
    return this.request("/universities-applicants/myApplication");
  }

  /**
   * GET /v1/universities-applicants/applicant-application
   * Foydalanuvchining universitet bo'yicha arizasi
   */
  async getMyApplicationByUniversity(): Promise<any> {
    return this.request("/universities-applicants/applicant-application");
  }

  // ======================================================================
  // GRANTS - Grantlar
  // ======================================================================

  /**
   * GET /v1/university-grants/user-side
   * Universitet grantlari (user-side)
   */
  async getGrants(params?: {
    limit?: number;
    offset?: number;
    university?: string;
    region?: string;
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    if (params?.university) searchParams.set("university", params.university);
    if (params?.region) searchParams.set("region", params.region);
    const query = searchParams.toString();
    return this.request(`/university-grants/user-side${query ? `?${query}` : ""}`);
  }

  /**
   * GET /v1/university-grants/user-side
   * Universitet grantlari (user-side - alohida nom bilan)
   */
  async getUserSideUniversityGrants(params?: {
    limit?: number;
    offset?: number;
    university?: string;
    region?: string;
  }): Promise<any> {
    return this.getGrants(params);
  }

  // ======================================================================
  // PREFOUNDATION COURSES - Tayyorlov kurslari
  // ======================================================================

  /**
   * GET /v1/prefoundation-courses/{id}
   * Tayyorlov kursini ID bo'yicha olish
   */
  async getPrefoundationCourseById(id: number): Promise<any> {
    return this.request(`/prefoundation-courses/${id}`);
  }

  /**
   * GET /v1/prefoundation-courses/slug/{slug}
   * Tayyorlov kursini slug bo'yicha olish
   */
  async getPrefoundationCourseBySlug(slug: string): Promise<any> {
    return this.request(`/prefoundation-courses/slug/${encodeURIComponent(slug)}`);
  }

  // ======================================================================
  // TESTS - Testlar
  // ======================================================================

  /**
   * GET /v1/tests/all/{test_type}
   * Barcha testlar
   */
  async getAllTests(testType: string): Promise<any> {
    return this.request(`/tests/all/${encodeURIComponent(testType)}`);
  }

  /**
   * GET /v1/tests/{test_type}/{test_id}
   * Testni ID bo'yicha olish
   */
  async getTestById(testType: string, testId: number): Promise<any> {
    return this.request(`/tests/${encodeURIComponent(testType)}/${testId}`);
  }

  /**
   * GET /v1/test-questions/daily/{test_id}
   * Kunlik test savollari
   */
  async getDailyTestQuestions(testId: number): Promise<any> {
    return this.request(`/test-questions/daily/${testId}`);
  }

  /**
   * GET /v1/test-questions/{test_classification_id}/{type}
   * Test savollarini turi bo'yicha olish
   */
  async getTestQuestionsByType(testClassificationId: number, type: string): Promise<any> {
    return this.request(`/test-questions/${testClassificationId}/${encodeURIComponent(type)}`);
  }

  // ======================================================================
  // NEWS - Yangiliklar
  // ======================================================================

  /**
   * GET /v1/news
   * Yangiliklar ro'yxati
   */
  async getNews(params?: {
    limit?: number;
    offset?: number;
    universityId?: string;
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    if (params?.universityId) searchParams.set("universityId", params.universityId);
    const query = searchParams.toString();
    return this.request(`/news${query ? `?${query}` : ""}`);
  }

  /**
   * GET /v1/news/popular
   * Ommabop yangiliklar
   */
  async getPopularNews(params?: { limit?: number }): Promise<any> {
    const query = params?.limit ? `?limit=${params.limit}` : "";
    return this.request(`/news/popular${query}`);
  }

  /**
   * GET /v1/news/related
   * Tegishli yangiliklar
   */
  async getRelatedNews(params?: { limit?: number }): Promise<any> {
    const query = params?.limit ? `?limit=${params.limit}` : "";
    return this.request(`/news/related${query}`);
  }

  /**
   * GET /v1/news/{slug}
   * Yangilikni slug bo'yicha olish
   */
  async getNewsBySlug(slug: string): Promise<any> {
    return this.request(`/news/${encodeURIComponent(slug)}`);
  }

  /**
   * GET /v1/news-categories
   * Yangilik kategoriyalari
   */
  async getNewsCategories(): Promise<any> {
    return this.request("/news-categories");
  }

  // ======================================================================
  // NOTIFICATIONS - Bildirishnomalar
  // ======================================================================

  /**
   * GET /v1/notifications/user
   * Foydalanuvchi bildirishnomalari
   */
  async getUserNotifications(params?: { limit?: number; offset?: number }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    const query = searchParams.toString();
    return this.request(`/notifications/user${query ? `?${query}` : ""}`);
  }

  /**
   * GET /v1/notifications/unread-count
   * O'qilmagan bildirishnomalar soni
   */
  async getUnreadNotificationsCount(): Promise<any> {
    return this.request("/notifications/unread-count");
  }

  // ======================================================================
  // LOCATIONS - Joylashuv
  // ======================================================================

  /**
   * GET /v1/locations/countries
   * Davlatlar ro'yxati
   */
  async getCountries(): Promise<any> {
    return this.request("/locations/countries");
  }

  /**
   * GET /v1/locations/regions
   * Viloyatlar ro'yxati
   */
  async getRegions(): Promise<any> {
    return this.request("/locations/regions");
  }

  /**
   * GET /v1/locations/districts/{regionId}
   * Viloyat bo'yicha tumanlar
   */
  async getDistrictsByRegion(regionId: number): Promise<any> {
    return this.request(`/locations/districts/${regionId}`);
  }

  // ======================================================================
  // REVIEWS - Sharhlar
  // ======================================================================

  /**
   * GET /v1/reviews
   * Sharhlar ro'yxati
   */
  async getReviews(params?: { limit?: number; offset?: number }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    const query = searchParams.toString();
    return this.request(`/reviews${query ? `?${query}` : ""}`);
  }

  /**
   * GET /v1/reviews/universities
   * Universitetlar bo'yicha sharhlar
   */
  async getUniversitiesReviews(params?: { limit?: number; offset?: number }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    const query = searchParams.toString();
    return this.request(`/reviews/universities${query ? `?${query}` : ""}`);
  }

  /**
   * GET /v1/reviews/ratings/{university_id}
   * Universitet reytinglari
   */
  async getUniversityRatings(universityId: number): Promise<any> {
    return this.request(`/reviews/ratings/${universityId}`);
  }

  // ======================================================================
  // INFO - Umumiy ma'lumot
  // ======================================================================

  /**
   * GET /v1/info/statistics
   * Statistik ma'lumotlar
   */
  async getInfoStatistics(): Promise<any> {
    return this.request("/info/statistics");
  }

  /**
   * GET /v1/info/address
   * Manzil ma'lumotlari
   */
  async getInfoAddress(): Promise<any> {
    return this.request("/info/address");
  }

  // ======================================================================
  // GENERAL DIRECTIONS - Umumiy yo'nalishlar
  // ======================================================================

  /**
   * GET /v1/general-directions
   * Umumiy yo'nalishlar
   */
  async getGeneralDirections(): Promise<any> {
    return this.request("/general-directions");
  }

  // ======================================================================
  // INSTITUTION CATEGORIES - Universitet kategoriyalari
  // ======================================================================

  /**
   * GET /v1/institution-categories
   * Universitet kategoriyalari (davlat, xususiy, xalqaro)
   */
  async getInstitutionCategories(): Promise<any> {
    return this.request("/institution-categories");
  }

  /**
   * GET /v1/institution-categories/{id}
   * Universitet kategoriyasini ID bo'yicha
   */
  async getInstitutionCategoryById(id: number): Promise<any> {
    return this.request(`/institution-categories/${id}`);
  }

  // ======================================================================
  // CATEGORIES - Yo'nalish kategoriyalari (IT, Tibbiyot, va h.k.)
  // ======================================================================

  /**
   * GET /v1/categories/user-side
   * Yo'nalish kategoriyalari (IT, Tibbiyot, Muhandislik va h.k.)
   */
  async getDirectionCategories(): Promise<any> {
    return this.request("/categories/user-side");
  }

  // ======================================================================
  // WISHLIST - Sevimlilar
  // ======================================================================

  /**
   * GET /v1/wishlist
   * Foydalanuvchining sevimlilar ro'yxati
   */
  async getWishlist(): Promise<any> {
    return this.request("/wishlist");
  }

  // ======================================================================
  // FOLLOWS - Obunalar
  // ======================================================================

  /**
   * GET /v1/follows
   * Foydalanuvchining obunalari
   */
  async getFollows(): Promise<any> {
    return this.request("/follows");
  }
}

export const externalApi = new ExternalAPI();
