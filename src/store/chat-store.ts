import { create } from "zustand";
import type { ChatMessage, University, Direction } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  sessions: Array<{
    id: string;
    title: string;
    language: string;
    createdAt: string;
    updatedAt: string;
  }>;
  currentSessionId: string | null;
  isStreaming: boolean;
  isLoading: boolean;
  sessionsLoading: boolean;
  error: string | null;
  language: "uz" | "ru" | "en";
  theme: "light" | "dark";
  sidebarOpen: boolean;

  // ===== AUTH (BOSQICH 1 + GUEST REJIM) =====
  authToken: string | null;
  refreshToken: string | null;
  /** GUEST REJIM: login qilmagan foydalanuvchi brauzerda UUID yaratadi (X-Guest-Id) */
  guestId: string | null;
  /** Auth tekshirilganmi (birinchi yuklashda login gate miltillamasligi uchun) */
  authChecked: boolean;
  /** Sahifa yuklanganda token'larni topib, authChecked ni o'rnatadi */
  initAuth: () => void;
  /** Chat API'ga yuboriladigan auth header'lari */
  authHeaders: () => Record<string, string>;
  /** 401 bo'lsa login gate'ga o'tkazadi */
  handleAuthResponse: (response: Response) => boolean;

  // Session context
  currentUniversity: University | null;
  currentDirection: Direction | null;

  // Actions
  setLanguage: (lang: "uz" | "ru" | "en") => void;
  toggleSidebar: () => void;
  setTheme: (t: "light" | "dark") => void;
  toggleTheme: () => void;
  sendMessage: (content: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  newSession: () => void;
  deleteSession: (sessionId: string) => Promise<void>;
  clearError: () => void;
}

// ===== AUTH TOKEN MANBALARI (BOSQICH 1) =====
// mentalaba.uz frontend token'ni localStorage'da saqlashi mumkin bo'lgan kalitlar.
// Shu bilan birga URL'dan ?token=&refreshToken= ham o'qiladi (sayt redirect qilganda).
const TOKEN_STORAGE_KEYS = [
  "accessToken",
  "access_token",
  "token",
  "auth_token",
  "mentalaba_access_token",
  "mentalaba_token",
];
const REFRESH_TOKEN_STORAGE_KEYS = ["refreshToken", "refresh_token", "mentalaba_refresh_token"];

// ===== GUEST REJIM (BOSQICH 1 + GUEST) =====
// Login qilmagan foydalanuvchi uchun brauzerda UUID yaratiladi va localStorage'da
// saqlanadi. Shu guestId X-Guest-Id header'ida yuboriladi — session'lar shu id
// bo'yicha izolyatsiya qilinadi. Oxirgi session id ham saqlanadi — refresh'da
// joriy suhbat yo'qolmaydi (guest tarixi ro'yxatda ko'rinmaydi, lekin joriy
// suhbat brauzerda davom etadi).
const GUEST_ID_KEY = "mentalaba_guest_id";
const LAST_SESSION_KEY = "mentalaba_last_session";

function getOrCreateGuestId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id || id.length < 10) {
      id = `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return null;
  }
}

function readFromStorage(keys: string[]): string | null {
  if (typeof window === "undefined") return null;
  for (const key of keys) {
    try {
      const v = localStorage.getItem(key);
      if (v && v.length > 20) return v;
    } catch (e) {
      /* ignore */
    }
  }
  return null;
}

function readFromUrl(name: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

/**
 * Token'ni quyidagi tartibda qidiradi:
 *   1. URL parametr (?token= / ?accessToken=) — mentalaba.uz redirect qilganda
 *   2. localStorage (bir nechta keng tarqalgan kalit nomlari)
 * Topilganda localStorage'ga ham saqlaydi (keyingi sahifalarda ishlaydi).
 */
function resolveAuthTokens(): { token: string | null; refresh: string | null } {
  const urlToken =
    readFromUrl("token") ||
    readFromUrl("accessToken") ||
    readFromUrl("access_token");
  const urlRefresh = readFromUrl("refreshToken") || readFromUrl("refresh_token");
  const lsToken = readFromStorage(TOKEN_STORAGE_KEYS);
  const lsRefresh = readFromStorage(REFRESH_TOKEN_STORAGE_KEYS);

  const token = urlToken || lsToken;
  const refresh = urlRefresh || lsRefresh;

  // URL'dan kelgan token'ni localStorage'ga saqlash (keyingi yuklashlarda ham ishlaydi)
  if (token && typeof window !== "undefined") {
    try {
      const existing = readFromStorage(TOKEN_STORAGE_KEYS);
      if (existing !== token) localStorage.setItem("mentalaba_access_token", token);
    } catch (e) {
      /* ignore */
    }
  }
  if (refresh && typeof window !== "undefined") {
    try {
      localStorage.setItem("mentalaba_refresh_token", refresh);
    } catch (e) {
      /* ignore */
    }
  }
  return { token, refresh };
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sessions: [],
  currentSessionId: null,
  isStreaming: false,
  isLoading: false,
  // Dastlab true — Sidebar birinchi yuklashda skeleton ko'rsatadi
  sessionsLoading: true,
  error: null,
  language: "uz",
  // MUHIM (hydration): doim "light" boshlanadi — SSR va client bir xil render
  // qiladi. Haqiqiy rejim DOM'dan (layout skripti qo'shgan class) mount'da
  // sinxronlanadi — mismatch bo'lmaydi.
  theme: "light",
  sidebarOpen: true,
  // AUTH (BOSQICH 1 + GUEST REJIM)
  authToken: null,
  refreshToken: null,
  guestId: null,
  authChecked: false,
  currentUniversity: null,
  currentDirection: null,

  setLanguage: (lang) => set({ language: lang }),

  // ===== AUTH INIT (BOSQICH 1) =====
  // Sahifa yuklanganda chat-store ichida chaqiriladi (page.tsx mount'ida)
  // 1. URL/localStorage'dan token o'qiydi
  // 2. authChecked = true — login gate'ni ko'rsatish/qo'ymaslikni hal qiladi
  initAuth: () => {
    const { token, refresh } = resolveAuthTokens();
    const guestId = getOrCreateGuestId();
    set({
      authToken: token,
      refreshToken: refresh,
      guestId,
      authChecked: true,
      // GUEST REJIM: token bo'lmasa ham chat ishlaydi! Login qilmaganlar
      // guestId bilan izolyatsiya qilinadi, lekin tarixi saqlanmaydi.
    });
    // GUEST: oxirgi session'ni tiklash (refresh'da joriy suhbat yo'qolmasin)
    if (!token && guestId && typeof window !== "undefined") {
      try {
        const lastSession = localStorage.getItem(LAST_SESSION_KEY);
        if (lastSession) get().loadSession(lastSession);
      } catch (e) {
        /* ignore */
      }
    }
  },

  /** Barcha chat API so'rovlariga Authorization + guest header'lar qo'shadi */
  authHeaders: () => {
    const { authToken, refreshToken, guestId } = get();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    if (refreshToken) headers["X-Refresh-Token"] = refreshToken;
    if (guestId) headers["X-Guest-Id"] = guestId;
    return headers;
  },

  /**
   * 401 javobni tekshiradi. GUEST REJIM: 401 faqat token yaroqsiz/eskirganida
   * keladi (guest'lar serverda 401 olmaydi). Token bo'lsa — tozalab, guest
   * rejimga o'tamiz (chat davom etadi, login taklifi ko'rsatiladi).
   * Return: true = chaqiruvchi to'xtashi kerak (yoki qayta urinishi).
   */
  handleAuthResponse: (response: Response) => {
    if (response.status === 401) {
      const hadToken = !!get().authToken;
      // Fix (reviewer): isLoading ni ham tozalash kerak — aks holda 401 dan
      // keyin qayta login qilganda input doim disabled bo'lib qoladi.
      set({
        authToken: null,
        refreshToken: null,
        isLoading: false,
        isStreaming: false,
      });
      if (hadToken) {
        try {
          localStorage.removeItem("mentalaba_access_token");
          localStorage.removeItem("mentalaba_refresh_token");
        } catch (e) {
          /* ignore */
        }
      }
      return true;
    }
    return false;
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setTheme: (t) => {
    set({ theme: t });
    try {
      localStorage.setItem("mentalaba-theme", t);
      document.documentElement.classList.toggle("dark", t === "dark");
    } catch (e) {
      /* localStorage mavjud bo'lmaganda */
    }
  },

  toggleTheme: () => {
    get().setTheme(get().theme === "light" ? "dark" : "light");
  },

  sendMessage: async (content: string) => {
    const state = get();

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };

    set((s) => ({
      messages: [...s.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    try {
      let response = await fetch("/api/v1/chat", {
        method: "POST",
        headers: get().authHeaders(),
        body: JSON.stringify({
          message: content,
          sessionId: state.currentSessionId,
          language: state.language,
        }),
      });

      // GUEST REJIM: 401 → token yaroqsiz/eskirgan — tozalab, guest sifatida
      // qayta urinamiz (xabar yo'qolmasin). handleAuthResponse token'ni
      // tozalaydi, authHeaders endi X-Guest-Id bilan qaytaradi.
      if (response.status === 401) {
        const hadToken = !!get().authToken;
        get().handleAuthResponse(response);
        if (hadToken) {
          response = await fetch("/api/v1/chat", {
            method: "POST",
            headers: get().authHeaders(),
            body: JSON.stringify({
              message: content,
              sessionId: state.currentSessionId,
              language: state.language,
            }),
          });
        }
        if (response.status === 401) {
          // Guest sifatida ham rad etildi (kutilmagan) — xatoni ko'rsatamiz,
          // xabar indamay yo'qolib qolmasin.
          set({
            error: "Xizmat hozircha ishlamayapti — qayta urinib ko'ring.",
          });
          return;
        }
      }

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const result = await response.json();

      const assistantMessage: ChatMessage = {
        id: result.data.messageId || `assistant-${Date.now()}`,
        role: "assistant",
        content: result.data.message,
        intent: result.data.intent,
        selectedTool: result.data.toolUsed,
        timestamp: new Date(),
      };

      set((s) => ({
        messages: [...s.messages, assistantMessage],
        currentSessionId: result.data.sessionId,
        isLoading: false,
        error: null,
      }));

      // GUEST: joriy session'ni eslab qolamiz — refresh'da suhbat tiklanadi
      // (guest tarixi ro'yxatda ko'rinmaydi, lekin joriy suhbat davom etadi)
      if (!get().authToken && typeof window !== "undefined") {
        try {
          localStorage.setItem(LAST_SESSION_KEY, result.data.sessionId);
        } catch (e) {
          /* ignore */
        }
      }

      // Refresh sessions list
      get().loadSessions();
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || "Xatolik yuz berdi",
      });
    }
  },

  loadSessions: async () => {
    // Skeleton faqat ro'yxat BO'SH bo'lganda ko'rsatiladi —
    // har bir xabardan keyin miltillamasligi uchun
    set((s) => ({ sessionsLoading: s.sessions.length === 0 }));
    try {
      const response = await fetch("/api/v1/chat", {
        headers: get().authHeaders(),
      });
      if (get().handleAuthResponse(response)) return;
      if (response.ok) {
        const result = await response.json();
        set({ sessions: result.data || [], sessionsLoading: false });
      } else {
        set({ sessionsLoading: false });
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
      set({ sessionsLoading: false });
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      const response = await fetch(
        `/api/v1/chat?sessionId=${encodeURIComponent(sessionId)}`,
        { method: "DELETE", headers: get().authHeaders() }
      );
      if (get().handleAuthResponse(response)) return;
      if (response.ok) {
        set((s) => ({
          sessions: s.sessions.filter((x) => x.id !== sessionId),
        }));
        // O'chirilgan session hozirgi bo'lsa — yangi bo'sh suhbatga o'tamiz
        if (get().currentSessionId === sessionId) {
          get().newSession();
        }
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  },

  loadSession: async (sessionId: string) => {
    try {
      set({ isLoading: true });
      const response = await fetch(`/api/v1/chat?sessionId=${sessionId}`, {
        headers: get().authHeaders(),
      });
      if (get().handleAuthResponse(response)) return;
      if (response.ok) {
        const result = await response.json();
        const sessionData = result.data;

        set({
          currentSessionId: sessionId,
          messages: (sessionData.messages || []).map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            intent: m.intent,
            selectedTool: m.selectedTool,
            timestamp: new Date(m.createdAt),
          })),
          isLoading: false,
        });
      } else {
        // 404: session topilmadi (o'chirilgan yoki login'da claim qilingan) —
        // eski last-session kalitini tozalaymiz, guest suhbatni yo'qotmaydi
        set({ isLoading: false });
        if (response.status === 404 && typeof window !== "undefined") {
          try {
            localStorage.removeItem(LAST_SESSION_KEY);
          } catch (e) {
            /* ignore */
          }
        }
      }
    } catch (error) {
      set({ isLoading: false });
    }
  },

  newSession: () => {
    set({
      messages: [],
      currentSessionId: null,
      currentUniversity: null,
      currentDirection: null,
      error: null,
    });
    // GUEST: "Yangi suhbat" bosilganda oxirgi session eslab qolinmasin
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(LAST_SESSION_KEY);
      } catch (e) {
        /* ignore */
      }
    }
  },

  clearError: () => set({ error: null }),
}));
