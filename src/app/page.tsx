"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatInput } from "@/components/chat/ChatInput";
import { useChatStore } from "@/store/chat-store";
import { Menu } from "lucide-react";

export default function Home() {
  const { toggleSidebar, sidebarOpen } = useChatStore();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="font-semibold text-gray-800 text-sm">
              Mentalaba AI
            </span>
          </div>
        </div>

        {/* Chat Messages */}
        <ChatMessages />

        {/* Chat Input */}
        <ChatInput />
      </div>
    </div>
  );
}
