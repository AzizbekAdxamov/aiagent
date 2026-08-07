"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/store/chat-store";
import { Send, Sparkles } from "lucide-react";

export function ChatInput() {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, isLoading } = useChatStore();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-3 sm:p-4">
        <div
          className={`relative flex items-end gap-2 bg-gray-50 dark:bg-gray-800/70 rounded-2xl border-2 transition-all duration-300 ease-out ${
            isFocused
              ? "border-primary-400 bg-white dark:bg-gray-800 shadow-lg shadow-primary-100/60 dark:shadow-primary-900/30"
              : isHovered
              ? "border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/50"
              : "border-gray-100 dark:border-gray-700"
          }`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Input Area */}
          <div className="flex-1 min-h-[48px]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="Savolingizni yozing..."
              rows={1}
              disabled={isLoading}
              className="w-full bg-transparent px-4 sm:px-5 py-3.5 text-[15px] text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none resize-none disabled:opacity-50 transition-colors"
              style={{ minHeight: "48px", maxHeight: "150px" }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 px-2 pb-2">
            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 shadow-sm ${
                input.trim() && !isLoading
                  ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 shadow-md hover:shadow-lg active:scale-95"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0s" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0.3s" }} />
                </div>
              ) : (
                <Send className={`w-4 h-4 transition-transform duration-200 ${input.trim() ? "translate-x-0" : ""}`} />
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary-400" />
            <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
              Mentalaba AI — universitetlar, yo'nalishlar va grantlar
            </p>
          </div>
          {input.length > 0 && (
            <span className={`text-[10px] font-medium ${
              input.length > 500 ? "text-amber-500" : "text-gray-400 dark:text-gray-500"
            }`}>
              {input.length}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
