"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/store/chat-store";
import { ChatMessage as ChatMessageComponent } from "./ChatMessage";
import { SuggestionCards } from "./SuggestionCards";
import { LoadingState } from "./LoadingState";
import { Bot, Sparkles, Brain } from "lucide-react";

export function ChatMessages() {
  const { messages, isLoading, sendMessage, currentSessionId } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Welcome screen
  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {/* Floating particles background */}
        <div className="particle-bg" aria-hidden="true">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                width: `${60 + i * 40}px`,
                height: `${60 + i * 40}px`,
                left: `${10 + i * 18}%`,
                top: `${20 + (i % 3) * 25}%`,
                background: `radial-gradient(circle, ${
                  ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#6366f1"][i]
                } 0%, transparent 70%)`,
                '--duration': `${12 + i * 3}s`,
                '--delay': `${-i * 2}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center pt-16 sm:pt-24 pb-8 sm:pb-12 px-4">
            {/* Logo with glow */}
            <div className="relative inline-block mb-6 sm:mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-400 via-secondary-400 to-purple-400 rounded-2xl blur-2xl opacity-30 pulse-glow" />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary-500 via-secondary-500 to-purple-600 flex items-center justify-center shadow-xl shadow-primary-200 dark:shadow-primary-950/40">
                <Brain className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-3 sm:mb-4 gradient-text leading-tight">
              Mentalaba AI Agent
            </h1>
            <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto text-sm sm:text-base leading-relaxed px-2">
              O'zbekistondagi universitetlar, yo'nalishlar, grantlar va ta'lim 
              yangiliklari haqida ma'lumot topishda yordam beruvchi aqlli yordamchi
            </p>
          </div>

          {/* Welcome message card */}
          <div className="px-4 pb-4">
            <div className="max-w-2xl mx-auto glass-card rounded-2xl p-4 sm:p-5 message-enter">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Mentalaba AI</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-300 text-[10px] font-semibold">
                      Online
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    Assalomu alaykum! 👋 Men <strong className="text-primary-600 dark:text-primary-400">Mentalaba AI</strong> yordamchisiman. 
                    Universitetlar, yo'nalishlar, grantlar va ta'lim haqida barcha ma'lumotlarni topishda 
                    yordam bera olaman. Quyidagi yo'nalishlardan birini tanlang yoki o'z savolingizni yozing!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Suggestion Cards */}
          <SuggestionCards onSelect={(prompt) => sendMessage(prompt)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto py-3">
        {messages.map((msg, index) => (
          <div key={msg.id} className="message-stagger" style={{ animationDelay: `${index * 50}ms` }}>
            <ChatMessageComponent
              id={msg.id}
              sessionId={currentSessionId || undefined}
              role={msg.role as "user" | "assistant"}
              content={msg.content}
              intent={msg.intent}
              timestamp={msg.timestamp}
            />
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && <LoadingState />}

        {/* Scroll anchor */}
        <div ref={bottomRef} className="h-2" />
      </div>
    </div>
  );
}
