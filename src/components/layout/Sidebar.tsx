"use client";

import { useEffect } from "react";
import { useChatStore } from "@/store/chat-store";
import { cn } from "@/lib/cn";
import {
  MessageSquare,
  Plus,
  Trash2,
  Globe,
  Menu,
  X,
  GraduationCap,
} from "lucide-react";

export function Sidebar() {
  const {
    sessions,
    currentSessionId,
    sidebarOpen,
    language,
    loadSessions,
    loadSession,
    newSession,
    toggleSidebar,
    setLanguage,
  } = useChatStore();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const languages = [
    { code: "uz", label: "O'zbek", flag: "🇺🇿" },
    { code: "ru", label: "Русский", flag: "🇷🇺" },
    { code: "en", label: "English", flag: "🇬🇧" },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={cn(
          "fixed lg:relative z-30 h-full flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ease-in-out",
          sidebarOpen ? "w-[300px] translate-x-0" : "w-0 -translate-x-full lg:w-0 lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-800">Mentalaba</span>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors lg:flex"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={newSession}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium text-sm hover:from-primary-600 hover:to-primary-700 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Yangi suhbat</span>
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-2">
            Suhbatlar tarixi
          </div>
          {sessions.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-8 px-2">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Hali suhbatlar mavjud emas
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={cn(
                    "w-full text-left p-2.5 rounded-xl text-sm transition-all duration-200 group",
                    currentSessionId === session.id
                      ? "bg-primary-50 text-primary-700 border border-primary-200"
                      : "hover:bg-gray-50 text-gray-700 border border-transparent"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {session.title || "Yangi suhbat"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(session.updatedAt).toLocaleDateString("uz-UZ", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Language Switcher & Footer */}
        <div className="border-t border-gray-100 p-3 space-y-3">
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code as "uz" | "ru" | "en")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  language === lang.code
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-400 text-center">
            Mentalaba AI Agent v1.0
          </div>
        </div>
      </aside>
    </>
  );
}
