/**
 * Main chat page: sidebar + chat area + input bar + prompt editor modal + toast.
 */

import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useChatSettingsStore } from "../store/useChatSettingsStore";
import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import InputBar from "../components/InputBar";
import SettingsModal from "../components/SettingsModal";
import ChatSettingsModal from "../components/ChatSettingsModal";
import Toast from "../components/Toast";
import DebugCollabPanel from "../components/DebugCollabPanel";

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const settingsOpen = useChatStore((s) => s.settingsOpen);
  const setSettingsOpen = useChatStore((s) => s.setSettingsOpen);
  const chatSettingsOpen = useChatStore((s) => s.chatSettingsOpen);
  const setChatSettingsOpen = useChatStore((s) => s.setChatSettingsOpen);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  const loadChatSettings = useChatSettingsStore((s) => s.loadChatSettings);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid || !currentChatId) return;
    loadChatSettings({ uid, chatId: currentChatId });
  }, [user?.uid, currentChatId, loadChatSettings]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setDebugOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-[100dvh] bg-[var(--bg-primary)] overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <div
        className={`md:hidden fixed inset-0 z-[140] transition-opacity duration-200 ${
          mobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!mobileSidebarOpen}
      >
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
            mobileSidebarOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileSidebarOpen(false)}
        />
        <div className="absolute inset-y-0 left-0 w-[85vw] max-w-[340px]">
          <div
            className={`h-full transition-transform duration-200 ease-out ${
              mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <Sidebar mobileMode onRequestClose={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      </div>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden h-14 shrink-0 border-b border-[var(--border)] bg-[var(--bg-secondary)]/70 backdrop-blur-md">
          <div className="h-full px-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white"
              aria-label="Open menu"
              title="Menu"
            >
              <MenuIcon className="w-5 h-5" />
            </button>

            <div className="text-sm font-semibold text-white/90 truncate">AstroxAI</div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setChatSettingsOpen(true)}
                className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white"
                aria-label="Chat settings"
                title="Chat settings"
              >
                <SlidersIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white"
                aria-label="Settings"
                title="Settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <ChatArea />
        <InputBar />
      </main>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ChatSettingsModal open={chatSettingsOpen} onClose={() => setChatSettingsOpen(false)} />
      <DebugCollabPanel open={debugOpen} onClose={() => setDebugOpen(false)} />
      <Toast />
    </div>
  );
}

function MenuIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function SlidersIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21v-7m0-4V3m10 18v-5m0-4V3m10 18v-9m0-4V3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 14h6m4 2h6m-6-8h6" />
    </svg>
  );
}

function SettingsIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.983 2.25c.43 0 .78.322.824.749l.192 1.86a7.2 7.2 0 012.014.835l1.55-1.05a.825.825 0 011.084.11l1.144 1.144a.825.825 0 01.11 1.084l-1.05 1.55c.35.634.63 1.309.835 2.014l1.86.192c.427.044.749.394.749.824v1.618c0 .43-.322.78-.749.824l-1.86.192a7.2 7.2 0 01-.835 2.014l1.05 1.55a.825.825 0 01-.11 1.084l-1.144 1.144a.825.825 0 01-1.084.11l-1.55-1.05a7.2 7.2 0 01-2.014.835l-.192 1.86a.825.825 0 01-.824.749h-1.618a.825.825 0 01-.824-.749l-.192-1.86a7.2 7.2 0 01-2.014-.835l-1.55 1.05a.825.825 0 01-1.084-.11l-1.144-1.144a.825.825 0 01-.11-1.084l1.05-1.55a7.2 7.2 0 01-.835-2.014l-1.86-.192a.825.825 0 01-.749-.824v-1.618c0-.43.322-.78.749-.824l1.86-.192c.205-.705.485-1.38.835-2.014l-1.05-1.55a.825.825 0 01.11-1.084l1.144-1.144a.825.825 0 011.084-.11l1.55 1.05a7.2 7.2 0 012.014-.835l.192-1.86a.825.825 0 01.824-.749h1.618z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" />
    </svg>
  );
}
