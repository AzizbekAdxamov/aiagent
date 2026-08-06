"use client";

import { cn } from "@/lib/cn";
import { User, GraduationCap, Check, Copy, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import { useState } from "react";
import { RichContent } from "./RichContent";

interface ChatMessageProps {
  id: string;
  sessionId?: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  timestamp?: Date;
}

export function ChatMessage({ id, sessionId, role, content, intent, timestamp }: ChatMessageProps) {
  const isUser = role === "user";
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
        "flex items-start gap-3 px-4 sm:px-6 py-4 message-enter group",
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
      <div className={cn("max-w-[85%] sm:max-w-[75%] space-y-1.5", isUser ? "items-end" : "items-start")}>
        {/* Header */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-medium text-gray-400">
            {isUser ? "Siz" : "Mentalaba AI"}
          </span>
          {!isUser && intent && intent !== "unknown" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary-50 to-secondary-50 text-primary-600 text-[10px] font-semibold tracking-wide">
              <Sparkles className="w-2.5 h-2.5" />
              {getIntentLabel(intent)}
            </span>
          )}
          {timestamp && (
            <span className="text-[10px] text-gray-300">
              {timestamp.toLocaleTimeString("uz-UZ", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {/* Content */}
        <div
          className={cn(
            "relative rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-tr-md shadow-md"
              : "glass-card rounded-tl-md"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <RichContent content={content} />
          )}
        </div>

        {/* Copy button for assistant messages */}
        {!isUser && (
          <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 text-[10px] text-gray-400 hover:text-gray-600"
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
                "p-1 rounded-lg text-gray-400 hover:bg-green-50 hover:text-green-600 disabled:cursor-default",
                feedback === 1 && "bg-green-50 text-green-600"
              )}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => sendFeedback(-1)}
              disabled={!sessionId || feedback !== null}
              title="Javob foydasiz"
              className={cn(
                "p-1 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-default",
                feedback === -1 && "bg-red-50 text-red-600"
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
