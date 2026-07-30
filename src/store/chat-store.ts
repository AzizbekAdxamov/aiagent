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
  error: string | null;
  language: "uz" | "ru" | "en";
  sidebarOpen: boolean;

  // Session context
  currentUniversity: University | null;
  currentDirection: Direction | null;

  // Actions
  setLanguage: (lang: "uz" | "ru" | "en") => void;
  toggleSidebar: () => void;
  sendMessage: (content: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  newSession: () => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sessions: [],
  currentSessionId: null,
  isStreaming: false,
  isLoading: false,
  error: null,
  language: "uz",
  sidebarOpen: true,
  currentUniversity: null,
  currentDirection: null,

  setLanguage: (lang) => set({ language: lang }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

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
        id: `assistant-${Date.now()}`,
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
    try {
      const response = await fetch("/api/v1/chat");
      if (response.ok) {
        const result = await response.json();
        set({ sessions: result.data || [] });
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
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
