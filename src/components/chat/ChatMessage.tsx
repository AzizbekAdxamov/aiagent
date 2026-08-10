"use client";

import { cn } from "@/lib/cn";
import { User, GraduationCap, Check, Copy, Sparkles, ThumbsUp, ThumbsDown, Lock, LogIn } from "lucide-react";
import { useState } from "react";
import { RichContent } from "./RichContent";

interface ChatMessageProps {
  id: string;
  sessionId?: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  /** GUEST REJIM: "auth_required" bo'lsa — login CTA kartasi ko'rsatiladi */
  selectedTool?: string;
  timestamp?: Date;
}

export function ChatMessage({ id, sessionId, role, content, intent, selectedTool, timestamp }: ChatMessageProps) {
  const isUser = role === "user";
  const isAuthRequired = !isUser && selectedTool === "auth_required";
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<1 | -1 | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendFeedback = async (rating: 1 | -1) => {
    if (!sessionId || feedback) return;
    setFeedback(rating);

    try {
      await fetch("/api/v1/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: id, sessionId, rating }),
      });
    } catch {
      setFeedback(null);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 sm:gap-3 px-3 sm:px-6 py-3 sm:py-3.5 message-enter group",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ring-white",
          isUser
            ? "bg-gradient-to-br from-gray-700 to-gray-900"
            : "bg-gradient-to-br from-primary-500 via-secondary-500 to-purple-500"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <GraduationCap className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn("min-w-0 max-w-[92%] sm:max-w-[85%] space-y-1.5", isUser ? "items-end" : "items-start")}>
        {/* Header */}
        <div className={cn("flex items-center gap-2 px-1", isUser && "flex-row-reverse")}>
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
            {isUser ? "Siz" : "Mentalaba AI"}
          </span>
          {!isUser && intent && intent !== "unknown" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-950/50 dark:to-secondary-950/50 text-primary-600 dark:text-primary-300 text-[10px] font-semibold tracking-wide">
              <Sparkles className="w-2.5 h-2.5" />
              {getIntentLabel(intent)}
            </span>
          )}
          {timestamp && (
            <span className="text-[10px] text-gray-300 dark:text-gray-600">
              {timestamp.toLocaleTimeString("uz-UZ", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {/* Content — GUEST REJIM: auth_required bo'lsa login CTA kartasi */}
        {isAuthRequired ? (
          <LoginCtaCard content={content} />
        ) : (
          <div
            className={cn(
              "relative rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 text-[15px] leading-relaxed break-words transition-colors duration-300",
              isUser
                ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-tr-md shadow-md"
                : "bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/60 dark:border-gray-700 shadow-sm rounded-tl-md"
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words">{content}</p>
            ) : (
              <RichContent content={content} />
            )}
          </div>
        )}

        {/* Copy button for assistant messages */}
        {!isUser && (
          /* Mobil/touch'da doim ko'rinadi; desktop'da faqat hover'da */
          <div className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-200 flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-green-500" />
                  <span className="text-green-500">Nusxalandi</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Nusxa olish</span>
                </>
              )}
            </button>
            <button
              onClick={() => sendFeedback(1)}
              disabled={!sessionId || feedback !== null}
              title="Javob foydali"
              className={cn(
                "p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-green-50 dark:hover:bg-green-950/40 hover:text-green-600 dark:hover:text-green-400 disabled:cursor-default",
                feedback === 1 && "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400"
              )}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => sendFeedback(-1)}
              disabled={!sessionId || feedback !== null}
              title="Javob foydasiz"
              className={cn(
                "p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 disabled:cursor-default",
                feedback === -1 && "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
              )}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * GUEST REJIM (BOSQICH 1 + GUEST): data tool'i bloklanganda ko'rsatiladigan
 * login CTA kartasi. Matn + aniq [ Kirish ] tugmasi — mentalaba.uz auth
 * sahifasiga olib boradi (redirect bilan qaytadi).
 */
function LoginCtaCard({ content }: { content: string }) {
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const loginUrl = `https://mentalaba.uz/auth?sign-in&redirect=${encodeURIComponent(currentUrl)}`;
  const signupUrl = `https://mentalaba.uz/auth?sign-up`;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-primary-100 dark:border-primary-800/50 shadow-md rounded-tl-md">
      {/* Gradient top bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary-500 via-secondary-500 to-purple-500" />

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-primary-500/25">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <RichContent content={content} />
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <a
            href={loginUrl}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-semibold shadow-md shadow-primary-500/25 hover:from-primary-600 hover:to-primary-700 hover:shadow-lg active:scale-[0.98] transition-all duration-200"
          >
            <LogIn className="w-4 h-4" />
            Mentalaba accountiga kirish
          </a>
          <a
            href={signupUrl}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[0.98] transition-all duration-200"
          >
            Ro'yxatdan o'tish
          </a>
        </div>
      </div>
    </div>
  );
}

function getIntentLabel(intent: string): string {
  const labels: Record<string, string> = {
    university_search: "Universitet",
    university_list: "Universitetlar",
    direction_search: "Yo'nalish",
    direction_list: "Yo'nalishlar",
    grant_search: "Grant",
    grant_list: "Grantlar",
    news_search: "Yangilik",
    news_list: "Yangiliklar",
    tuition_search: "Narxlar",
    comparison: "Taqqoslash",
    admission: "Qabul",
    transfer: "Ko'chirish",
    recommendation: "Tavsiya",
    greeting: "Salomlashish",
    faq: "Savol",
  };
  return labels[intent] || intent;
}
