"use client";

import { LogIn, ShieldCheck, UserPlus } from "lucide-react";

/**
 * GUEST REJIM (BOSQICH 1 + GUEST):
 * Login qilmagan foydalanuvchi chat'ni ishlatishi mumkin, lekin tarixi
 * saqlanmaydi. Sidebar'da shu ixcham karta ko'rsatiladi — login qilganda
 * tarix accountinga bog'lanadi (hatto guest session ham davom ettiriladi).
 */
export function LoginPrompt() {
  const currentUrl =
    typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="relative rounded-2xl border border-primary-100 dark:border-primary-800/50 bg-gradient-to-br from-primary-50/80 to-secondary-50/50 dark:from-primary-950/40 dark:to-secondary-950/30 p-4 overflow-hidden">
      {/* Dekorativ glow */}
      <div className="absolute -top-8 -right-8 w-24 h-24 bg-primary-400/20 dark:bg-primary-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative">
        {/* Ikonka */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center shadow-md shadow-primary-500/25 mb-3">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>

        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1 leading-snug">
          Suhbatlaringizni saqlang
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
          Hozir mehmon sifatida ishlayapsiz — suhbat tarixi accountingizga
          saqlanmaydi. Kirganingizda barcha suhbatlar saqlanadi.
        </p>

        <a
          href={`https://mentalaba.uz/auth?sign-in&redirect=${encodeURIComponent(currentUrl)}`}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white text-xs font-semibold shadow-md shadow-primary-500/25 hover:from-primary-600 hover:to-primary-700 hover:shadow-lg active:scale-[0.98] transition-all duration-200"
        >
          <LogIn className="w-3.5 h-3.5" />
          Accountga kirish
        </a>

        <p className="mt-2.5 text-[11px] text-gray-400 dark:text-gray-500 text-center">
          Accountingiz yo'qmi?{" "}
          <a
            href="https://mentalaba.uz/auth?sign-up"
            className="inline-flex items-center gap-0.5 text-primary-500 dark:text-primary-400 font-medium hover:underline"
          >
            <UserPlus className="w-3 h-3" />
            Ro'yxatdan o'ting
          </a>
        </p>
      </div>
    </div>
  );
}
