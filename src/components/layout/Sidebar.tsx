"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/store/chat-store";
import { cn } from "@/lib/cn";
import { LoginPrompt } from "@/components/auth/LoginPrompt";
import {
  MessageSquare,
  Plus,
  Trash2,
  X,
  GraduationCap,
  Sun,
  Moon,
} from "lucide-react";

export function Sidebar() {
  const {
    sessions,
    currentSessionId,
    sidebarOpen,
    language,
    theme,
    sessionsLoading,
    loadSessions,
    loadSession,
    newSession,
    toggleSidebar,
    toggleTheme,
    setLanguage,
    deleteSession,
    // GUEST REJIM: login qilmaganlar uchun tarix o'rniga login taklifi
    authToken,
  } = useChatStore();

  // Item'lar faqat BIRINCHI yuklashda stagger animatsiya oladi
  // (keyingi yangilanishlarda takrorlanmasin — chalg'itmaydi)
  const [entered, setEntered] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enteredRef = useRef(false);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Kirish animatsiyasi sessiyalar birinchi marta yuklangandan KEYIN boshlanadi
  // (tarmoq kechikishida animatsiya o'tkazib yuborilmaydi)
  useEffect(() => {
    if (!sessionsLoading && !enteredRef.current) {
      enteredRef.current = true;
      const t = setTimeout(() => setEntered(true), 600);
      return () => clearTimeout(t);
    }
  }, [sessionsLoading]);

  // confirmTimer'ni unmount'da tozalash
  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const langIndex = language === "uz" ? 0 : language === "ru" ? 1 : 2;

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmDeleteId !== id) {
      // 1-bosish: tasdiqlash holati (bekor qilish uchun 3s vaqt)
      setConfirmDeleteId(id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    // 2-bosish: haqiqiy o'chirish
    setConfirmDeleteId(null);
    deleteSession(id);
  };

  const languages = [
    { code: "uz", label: "O'zbek", flag: "🇺🇿" },
    { code: "ru", label: "Русский", flag: "🇷🇺" },
    { code: "en", label: "English", flag: "🇬🇧" },
  ];

  return (
    <>
      {/* Mobile overlay — silliq fade + blur */}
      {sidebarOpen && (
        <div
          className="overlay-fade fixed inset-0 bg-black/40 backdrop-blur-sm z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/*
        Mini-logo tugmasi — faqat DESKTOP'da (mobilda header'ning Menu
        tugmasi bor). Sidebar yopiq bo'lganda ko'rinadi, pop-in animatsiya bilan.
      */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          aria-label="Sidebarni ochish"
          title="Menyu"
          className="pop-in hidden lg:flex fixed top-4 left-4 z-40 w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 via-secondary-500 to-purple-500 items-center justify-center shadow-lg shadow-primary-200/60 dark:shadow-primary-900/40 hover:scale-110 hover:rotate-6 active:scale-95 transition-all duration-300"
        >
          <GraduationCap className="w-5 h-5 text-white" />
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white dark:border-gray-900" />
        </button>
      )}

      <aside
        className={cn(
          "fixed lg:relative z-30 h-full flex flex-col bg-white border-r border-gray-200 dark:bg-gray-900 dark:border-gray-800 overflow-hidden transition-[width,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          sidebarOpen ? "w-[300px] translate-x-0" : "w-0 -translate-x-full lg:w-0 lg:translate-x-0"
        )}
      >
        {/* Ichki kontent: min-w — torayishda matn buzilmasligi uchun; opacity — silliq fade */}
        <div
          className={cn(
            "flex flex-col h-full min-w-[300px] transition-opacity duration-300",
            sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0 hover:rotate-6 hover:scale-110 transition-all duration-300">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">Mentalaba</span>
            </div>
            <button
              onClick={toggleSidebar}
              title="Yopish"
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:rotate-90 hover:text-gray-700 dark:hover:text-gray-200 text-gray-500 dark:text-gray-400 transition-all duration-300 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* New Chat Button — shine (yorug'lik supurishi) effekti */}
          <div className="p-3">
            <button
              onClick={newSession}
              className="group shine-btn w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium text-sm hover:from-primary-600 hover:to-primary-700 active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg whitespace-nowrap"
            >
              <Plus className="w-4 h-4 flex-shrink-0 transition-transform duration-300 group-hover:rotate-90" />
              <span>Yangi suhbat</span>
            </button>
          </div>

          {/* Chat History — GUEST REJIM: login qilmaganlar uchun tarix o'rniga
              login taklifi ko'rsatiladi (tarix saqlanmaydi). */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3">
            {!authToken ? (
              <div className="pt-1 pb-3">
                <LoginPrompt />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mt-3 px-2 leading-relaxed">
                  Mehmon tarixi saqlanmaydi — joriy suhbat bu qurilmada davom etadi
                </p>
              </div>
            ) : (
              <>
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Suhbatlar tarixi
              </div>
              {sessions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 font-semibold">
                  {sessions.length}
                </span>
              )}
            </div>

            {sessionsLoading ? (
              /* Skeleton loading */
              <div className="space-y-2.5 px-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg skeleton-line flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton-line w-3/4" />
                      <div className="skeleton-line w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-8 px-2 sidebar-item-in">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Hali suhbatlar mavjud emas
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session, index) => (
                  <div
                    key={session.id}
                    className={cn("relative group", !entered && "sidebar-item-in")}
                    style={
                      !entered
                        ? { animationDelay: `${Math.min(index, 8) * 45}ms` }
                        : undefined
                    }
                  >
                    <button
                      onClick={() => loadSession(session.id)}
                      className={cn(
                        "w-full text-left p-2.5 pl-3 rounded-xl text-sm transition-all duration-200",
                        currentSessionId === session.id
                          ? "bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 active-accent"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <MessageSquare
                          className={cn(
                            "w-4 h-4 mt-0.5 flex-shrink-0 transition-all duration-300",
                            currentSessionId === session.id
                              ? "text-primary-500 dark:text-primary-400"
                              : "text-gray-400 dark:text-gray-500 group-hover:text-primary-400 group-hover:-rotate-6"
                          )}
                        />
                        <div className="min-w-0 flex-1 pr-5">
                          <p className="truncate font-medium">
                            {session.title || "Yangi suhbat"}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">
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

                    {/* O'chirish tugmasi — hover'da paydo bo'ladi, 2-bosishda o'chiradi */}
                    <button
                      onClick={(e) => handleDelete(e, session.id)}
                      title={
                        confirmDeleteId === session.id
                          ? "Tasdiqlash uchun yana bosing"
                          : "O'chirish"
                      }
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200",
                        confirmDeleteId === session.id
                          ? "bg-red-500 text-white opacity-100 scale-100"
                          // Mobil/touch'da doim ko'rinadi; desktop'da faqat hover'da
                          : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100 scale-100 lg:scale-90 lg:group-hover:scale-100 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 dark:hover:text-red-400 border border-gray-100 dark:border-gray-700 shadow-sm"
                      )}
                    >
                      {confirmDeleteId === session.id ? (
                        <Trash2 className="w-3.5 h-3.5 animate-pulse" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
              </>
            )}
          </div>

          {/* Theme & Language & Footer */}
          <div className="border-t border-gray-100 dark:border-gray-800 p-3 space-y-2.5">
            {/* Tema tugmasi */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium text-gray-600 dark:text-gray-300 transition-all duration-200 active:scale-[0.98]"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Yorug' rejim</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-primary-500" />
                  <span>Qorong'i rejim</span>
                </>
              )}
            </button>

            {/* Sliding indicator — til almashganda pill silliq sirg'anadi */}
            <div className="relative flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl p-1">
              <div
                className="absolute left-1 top-1 bottom-1 rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{
                  width: "calc((100% - 8px) / 3)",
                  transform: `translateX(${langIndex * 100}%)`,
                }}
              />
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code as "uz" | "ru" | "en")}
                  className={cn(
                    "relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 whitespace-nowrap",
                    language === lang.code
                      ? "text-gray-800 dark:text-gray-100"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  )}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-600 text-center whitespace-nowrap">
              Mentalaba AI Agent v1.0
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
