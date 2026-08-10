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

  // ===== AUTH (BOSQICH 1) =====
  authToken: string | null;
  refreshToken: string | null;
  /** Auth tekshirilganmi (birinchi yuklashda login gate miltillamasligi uchun) */
  authChecked: boolean;
  /** 401 qaytgan — login talab qilinadi */
  authRequired: boolean;
  /** Sahifa yuklanganda token'larni topib, authChecked ni o'rnatadi */
  initAuth: () => void;
  setAuthRequired: (required: boolean) => void;
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
  // AUTH (BOSQICH 1)
  authToken: null,
  refreshToken: null,
  authChecked: false,
  authRequired: false,
  currentUniversity: null,
  currentDirection: null,

  setLanguage: (lang) => set({ language: lang }),

  // ===== AUTH INIT (BOSQICH 1) =====
  // Sahifa yuklanganda chat-store ichida chaqiriladi (page.tsx mount'ida)
  // 1. URL/localStorage'dan token o'qiydi
  // 2. authChecked = true — login gate'ni ko'rsatish/qo'ymaslikni hal qiladi
  initAuth: () => {
    const { token, refresh } = resolveAuthTokens();
    set({
      authToken: token,
      refreshToken: refresh,
      authChecked: true,
      // Token bo'lmasa → login talab qilinadi (majburiy login)
      authRequired: !token,
    });
  },

  setAuthRequired: (required) => {
    if (required) set({ authRequired: true });
  },

  /** Barcha chat API so'rovlariga Authorization header qo'shadi */
  authHeaders: () => {
    const { authToken, refreshToken } = get();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    if (refreshToken) headers["X-Refresh-Token"] = refreshToken;
    return headers;
  },

  /** 401 javobni tekshiradi — bo'lsa login gate'ga o'tadi */
  handleAuthResponse: (response: Response) => {
    if (response.status === 401) {
      // Fix (reviewer): isLoading ni ham tozalash kerak — aks holda 401 dan
      // keyin qayta login qilganda input doim disabled bo'lib qoladi.
      set({ authRequired: true, isLoading: false, isStreaming: false });
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
      const response = await fetch("/api/v1/chat", {
        method: "POST",
        headers: get().authHeaders(),
        body: JSON.stringify({
          message: content,
          sessionId: state.currentSessionId,
          language: state.language,
        }),
      });

      if (get().handleAuthResponse(response)) return;

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
  },

  clearError: () => set({ error: null }),
}));
