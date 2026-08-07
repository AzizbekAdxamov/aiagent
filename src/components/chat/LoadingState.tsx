"use client";

import { GraduationCap } from "lucide-react";

export function LoadingState() {
  return (
    <div className="flex items-start gap-3 px-4 py-4 message-enter">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0 shadow-sm">
        <GraduationCap className="w-4 h-4 text-white" />
      </div>

      {/* Loading dots */}
      <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}
