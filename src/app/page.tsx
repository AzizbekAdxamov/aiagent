"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatInput } from "@/components/chat/ChatInput";
import { useEffect } from "react";
import { useChatStore } from "@/store/chat-store";
import { Menu, Sun, Moon } from "lucide-react";

export default function Home() {
  const { toggleSidebar, toggleTheme, theme, setTheme, initAuth } =
    useChatStore();

  // Haqiqiy rejimni DOM'dan sinxronlash — SSR hydration mismatch oldini oladi
  // (layout skripti <html> ga dark class qo'shgan bo'ladi)
  useEffect(() => {
    setTheme(
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AUTH (BOSQICH 1): token'ni URL/localStorage'dan o'qib, auth holatini o'rnatadi
  useEffect(() => {
    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg">
          <button
            onClick={toggleSidebar}
            aria-label="Menyu"
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">
              Mentalaba AI
            </span>
          </div>
          {/* Tema tugmasi (mobil) */}
          <button
            onClick={toggleTheme}
            aria-label="Rejimni almashtirish"
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* GUEST REJIM (BOSQICH 1 + GUEST): login qilinmagan bo'lsa ham chat
            ishlaydi — guestId bilan izolyatsiya, tarix saqlanmaydi. Login
            taklifi Sidebar'da ko'rsatiladi. */}
        <>
          {/* Chat Messages */}
          <ChatMessages />

          {/* Chat Input */}
          <ChatInput />
        </>
      </div>
    </div>
  );
}
