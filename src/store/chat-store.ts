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
  currentUniversity: null,
  currentDirection: null,

  setLanguage: (lang) => set({ language: lang }),

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          sessionId: state.currentSessionId,
          language: state.language,
        }),
      });

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
      const response = await fetch("/api/v1/chat");
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
        { method: "DELETE" }
      );
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
      const response = await fetch(`/api/v1/chat?sessionId=${sessionId}`);
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
