"use client";

import { useChatStore } from "@/store/chat-store";
import { LogIn, Lock, MessageCircleHeart, Sparkles } from "lucide-react";

/**
 * LOGIN GATE (BOSQICH 1):
 * Foydalanuvchi Mentalaba accountiga kirmagan bo'lsa, chat o'rniga shu ekran
 * ko'rsatiladi. "Kirish" tugmasi mentalaba.uz saytining auth sahifasiga olib
 * boradi — user u yerda login qiladi va qaytib kelganda token avtomatik
 * olinadi (URL param / localStorage).
 */
export function LoginGate() {
  const { refreshToken, authToken } = useChatStore();

  const loginUrl = `https://mentalaba.uz/auth?sign-in${authToken || refreshToken ? "" : "&redirect=" + encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`;

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-md">
        {/* Karta */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden">
          {/* Dekorativ glow */}
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary-400/20 dark:bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 w-56 h-56 bg-secondary-400/20 dark:bg-secondary-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Ikonka */}
          <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center shadow-lg shadow-primary-500/30 mb-5">
            <Lock className="w-7 h-7 text-white" />
          </div>

          <h2 className="relative text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Mentalaba AI yordamchisi
          </h2>
          <p className="relative text-sm sm:text-[15px] text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
            AI yordamchidan foydalanish uchun{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              Mentalaba accountiga kiring
            </span>
            . Universitetlar, yo'nalishlar, grantlar va kontrakt narxlari bo'yicha
            shaxsiy maslahatlar oling.
          </p>

          {/* Afzalliklar */}
          <div className="relative space-y-2.5 mb-7 text-left">
            {[
              { icon: MessageCircleHeart, text: "Shaxsiy suhbatlar — faqat siz ko'rasiz" },
              { icon: Sparkles, text: "Suhbat tarixi accountingizda saqlanadi" },
              { icon: LogIn, text: "Bitta login — barcha imkoniyatlar" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/50"
              >
                <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary-500 dark:text-primary-400" />
                </div>
                <span className="text-[13px] sm:text-sm text-gray-600 dark:text-gray-300">
                  {text}
                </span>
              </div>
            ))}
          </div>

          {/* Kirish tugmasi */}
          <a
            href={loginUrl}
            className="relative w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold text-[15px] shadow-lg shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
          >
            <LogIn className="w-5 h-5" />
            Mentalaba accountiga kirish
          </a>

          <p className="relative mt-4 text-xs text-gray-400 dark:text-gray-500">
            Hali accountingiz yo'qmi?{" "}
            <a
              href="https://mentalaba.uz/auth?sign-up"
              className="text-primary-500 dark:text-primary-400 font-medium hover:underline"
            >
              Ro'yxatdan o'ting
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
