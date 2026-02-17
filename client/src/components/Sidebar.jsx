/**
 * Collapsible sidebar: logo, new chat, search, chat history.
 */

import { useState, useMemo } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useAvatarStore } from "../store/useAvatarStore";

const LOGO = "AstroxAI";

export default function Sidebar({ mobileMode = false, onRequestClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const localAvatar = useAvatarStore((s) => s.avatarDataUrl);
  // Profile pic: uploaded first, then Google/Gmail photo from Auth
  const photoURL = localAvatar || profile?.photoURL || user?.photoURL || null;
  const displayName = profile?.name || user?.displayName || "User";
  const initials = displayName.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  const [photoFailed, setPhotoFailed] = useState(false);

  const chats = useChatStore((s) => s.chats);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const searchChats = useChatStore((s) => s.searchChats);
  const newChat = useChatStore((s) => s.newChat);
  const selectChat = useChatStore((s) => s.selectChat);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const setSettingsOpen = useChatStore((s) => s.setSettingsOpen);

  const handleNewChat = () => {
    newChat();
    if (mobileMode) onRequestClose?.();
  };

  const handleSelectChat = (id) => {
    selectChat(id);
    if (mobileMode) onRequestClose?.();
  };

  const handleOpenSettings = () => {
    setSettingsOpen(true);
    if (mobileMode) onRequestClose?.();
  };

  const filteredChats = useMemo(
    () => searchChats(search),
    [chats, search, searchChats]
  );

  return (
    <aside
      className={`
        flex flex-col bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)] border-r border-[var(--border)]
        transition-all duration-300 ease-out overflow-hidden
        ${mobileMode ? "w-full h-full" : (collapsed ? "w-[52px] min-w-[52px]" : "w-64 min-w-[256px]")}
      `}
    >
      {/* Top: logo + collapse */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-[var(--border)] shrink-0">
        {!collapsed && (
          <span className="font-semibold text-lg tracking-tight text-white truncate">
            {LOGO}
          </span>
        )}
        <div className="flex items-center gap-0.5">
          {mobileMode && (
            <button
              type="button"
              onClick={onRequestClose}
              className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors duration-200"
              aria-label="Close"
              title="Close"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={handleOpenSettings}
              className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors duration-200"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          )}
          {!mobileMode && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors duration-200 text-[var(--text-muted)] hover:text-white"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {collapsed && (
        <div className="p-2 shrink-0 flex justify-center">
          <button
            type="button"
            onClick={handleNewChat}
            className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-[var(--text-muted)] hover:text-white"
            aria-label="New chat"
            title="New chat"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      )}

      {!collapsed && (
        <>
          <div className="p-2 shrink-0">
            <button
              type="button"
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>

          <div className="px-2 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Find chat"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent"
              />
            </div>
          </div>
        </>
      )}

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 animate-fade-in">
        {!collapsed &&
          filteredChats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === currentChatId}
              onSelect={() => handleSelectChat(chat.id)}
              onDelete={(e) => {
                e.stopPropagation();
                deleteChat(chat.id);
              }}
            />
          ))}
      </div>

      {collapsed && (
        <div className="px-2 pb-1 shrink-0 flex justify-center transition-all duration-300 ease-out">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors duration-200 text-[var(--text-muted)] hover:text-white"
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* User: avatar + name */}
      <div className="border-t border-[var(--border)] p-2 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            {photoURL && !photoFailed ? (
              <img
                src={photoURL}
                alt=""
                onError={() => setPhotoFailed(true)}
                className="w-9 h-9 rounded-full object-cover bg-white/10"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-indigo-600/80 flex items-center justify-center text-white text-sm font-semibold">
                {initials}
              </div>
            )}
            <span className="truncate font-medium text-white text-sm flex-1 min-w-0">{displayName}</span>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            {photoURL && !photoFailed ? (
              <img src={photoURL} alt="" onError={() => setPhotoFailed(true)} className="w-8 h-8 rounded-full object-cover bg-white/10" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600/80 flex items-center justify-center text-white text-xs font-semibold">{initials}</div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function ChatItem({ chat, isActive, onSelect, onDelete }) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      className={`
        group flex items-center gap-2 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors
        ${isActive ? "bg-white/10 text-white" : "hover:bg-white/5 text-[var(--text-muted)]"}
      `}
    >
      <MessageIcon className="w-4 h-4 shrink-0 opacity-70" />
      <span className="flex-1 truncate text-sm">{chat.title}</span>
      {showDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-500/20 text-red-400 opacity-80 hover:opacity-100"
          aria-label="Delete chat"
        >
          <Trash className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function Plus({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function Search({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function CloseIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronLeft({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRight({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function MessageIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function Trash({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function SettingsIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

