/**
 * Global chat state: conversations, current chat, agent, streaming, abort.
 * Persists chat list and messages in localStorage.
 */

import { create } from "zustand";

const STORAGE_KEY = "astroxai_chats";
const MAX_TITLE_LENGTH = 40;

function loadChats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveChats(chats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch (e) {
    console.warn("Failed to save chats", e);
  }
}

export const useChatStore = create((set, get) => ({
  // All chats: { id, title, agent, messages, createdAt }
  chats: loadChats(),

  // Active chat id; null = new unsaved chat
  currentChatId: null,

  // Currently selected agent key (auto, arcee, solar, etc.)
  currentAgent: "auto",

  // Agents list from API (id -> { name, description, model })
  agents: {},

  // Streaming state
  isStreaming: false,
  abortController: null,

  // Last model status from stream: "primary" | "fallback" | null
  modelStatus: null,
  setModelStatus: (status) => set({ modelStatus: status }),

  // Toast message (e.g. "Prompt updated successfully")
  toastMessage: null,
  showToast: (message) => {
    set({ toastMessage: message });
    setTimeout(() => set({ toastMessage: null }), 3000);
  },

  /** Attach responseId to the last assistant message (used for thumbs up/down). */
  setLastAssistantResponseId: (responseId) => {
    const { chats, currentChatId } = get();
    if (!currentChatId) return;
    const rid = responseId ? String(responseId) : null;
    const nextChats = chats.map((c) => {
      if (c.id !== currentChatId) return c;
      const messages = [...c.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        messages[messages.length - 1] = { ...last, responseId: rid };
      }
      return { ...c, messages };
    });
    set({ chats: nextChats });
    saveChats(nextChats);
  },

  /** Attach collab agent list to last assistant message (swarm mode). */
  setLastAssistantCollabAgents: (agents) => {
    const { chats, currentChatId } = get();
    if (!currentChatId) return;
    const arr = Array.isArray(agents) ? agents.map(String).filter(Boolean) : null;
    const nextChats = chats.map((c) => {
      if (c.id !== currentChatId) return c;
      const messages = [...c.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        messages[messages.length - 1] = { ...last, collabAgents: arr };
      }
      return { ...c, messages };
    });
    set({ chats: nextChats });
    saveChats(nextChats);
  },

  /** Persist user's feedback on the last assistant message. */
  setLastAssistantFeedback: (feedback) => {
    const { chats, currentChatId } = get();
    if (!currentChatId) return;
    const fb = feedback ? String(feedback) : null;
    const nextChats = chats.map((c) => {
      if (c.id !== currentChatId) return c;
      const messages = [...c.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        messages[messages.length - 1] = { ...last, feedback: fb };
      }
      return { ...c, messages };
    });
    set({ chats: nextChats });
    saveChats(nextChats);
  },

  promptEditorOpen: false,
  setPromptEditorOpen: (open) => set({ promptEditorOpen: open }),

  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  chatSettingsOpen: false,
  setChatSettingsOpen: (open) => set({ chatSettingsOpen: open }),

  setAgents: (agents) => set({ agents }),

  setCurrentAgent: (agent) => set({ currentAgent: agent }),

  getCurrentChat: () => {
    const { chats, currentChatId } = get();
    if (!currentChatId) return null;
    return chats.find((c) => c.id === currentChatId) ?? null;
  },

  getCurrentMessages: () => {
    const chat = get().getCurrentChat();
    return chat ? chat.messages : [];
  },

  newChat: () => {
    set({ currentChatId: null });
    return null;
  },

  addMessage: (role, content, agentUsed = null, extra = null) => {
    const { chats, currentChatId, currentAgent } = get();
    const agent = agentUsed ?? currentAgent;
    const message = {
      role,
      content,
      agent,
      ...(extra && typeof extra === "object" ? extra : {}),
    };

    if (!currentChatId) {
      const id = `chat_${Date.now()}`;
      const title =
        role === "user"
          ? content.slice(0, MAX_TITLE_LENGTH).replace(/\n/g, " ") || "New Chat"
          : "New Chat";
      const newChat = {
        id,
        title,
        agent,
        messages: [message],
        createdAt: Date.now(),
      };
      const nextChats = [newChat, ...chats];
      set({ chats: nextChats, currentChatId: id });
      saveChats(nextChats);
      return id;
    }

    const nextChats = chats.map((c) => {
      if (c.id !== currentChatId) return c;
      const title =
        c.title === "New Chat" && role === "user"
          ? content.slice(0, MAX_TITLE_LENGTH).replace(/\n/g, " ") || c.title
          : c.title;
      return {
        ...c,
        title,
        messages: [...c.messages, message],
      };
    });
    set({ chats: nextChats });
    saveChats(nextChats);
    return currentChatId;
  },

  appendStreamingContent: (content) => {
    const { chats, currentChatId } = get();
    if (!currentChatId) return;
    const nextChats = chats.map((c) => {
      if (c.id !== currentChatId) return c;
      const messages = [...c.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        messages[messages.length - 1] = {
          ...last,
          content: last.content + content,
        };
      } else {
        messages.push({ role: "assistant", content, agent: get().currentAgent });
      }
      return { ...c, messages };
    });
    set({ chats: nextChats });
    saveChats(nextChats);
  },

  /** When Auto selected an agent, set the last assistant message's agent for display */
  setLastAssistantAgent: (agentId) => {
    const { chats, currentChatId } = get();
    if (!currentChatId) return;
    const nextChats = chats.map((c) => {
      if (c.id !== currentChatId) return c;
      const messages = [...c.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        messages[messages.length - 1] = { ...last, agent: agentId };
      }
      return { ...c, messages };
    });
    set({ chats: nextChats });
    saveChats(nextChats);
  },

  finishStreaming: () => {
    set({ isStreaming: false, abortController: null });
  },

  setStreaming: (value) => set({ isStreaming: value }),

  setAbortController: (controller) => set({ abortController: controller }),

  abortRequest: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ isStreaming: false, abortController: null });
    }
  },

  selectChat: (id) => set({ currentChatId: id }),

  deleteChat: (id) => {
    const { chats, currentChatId } = get();
    const next = chats.filter((c) => c.id !== id);
    set({
      chats: next,
      currentChatId: currentChatId === id ? null : currentChatId,
    });
    saveChats(next);
  },

  searchChats: (query) => {
    const { chats } = get();
    if (!query.trim()) return chats;
    const q = query.toLowerCase();
    return chats.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages?.some(
          (m) =>
            typeof m.content === "string" && m.content.toLowerCase().includes(q)
        )
    );
  },
}));
