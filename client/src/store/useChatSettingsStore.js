import { create } from "zustand";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

function chatDocRef(uid, chatId) {
  return doc(db, "users", uid, "chats", chatId);
}

function normalize(data) {
  const d = data && typeof data === "object" ? data : {};
  return {
    memoryEnabled: d.memoryEnabled !== false,
    systemPromptOverride: typeof d.systemPromptOverride === "string" ? d.systemPromptOverride : "",
    promptHistory: Array.isArray(d.promptHistory) ? d.promptHistory : [],
  };
}

export const useChatSettingsStore = create((set, get) => ({
  byChatId: {},
  loading: false,
  error: null,

  getForChat: (chatId) => {
    const v = get().byChatId[chatId];
    return normalize(v);
  },

  loadChatSettings: async ({ uid, chatId }) => {
    if (!uid || !chatId) return;
    set({ loading: true, error: null });
    try {
      const snap = await getDoc(chatDocRef(uid, chatId));
      const next = normalize(snap.exists() ? snap.data() : {});
      set((s) => ({ byChatId: { ...s.byChatId, [chatId]: next } }));
    } catch (e) {
      console.warn("[ChatSettings] Load failed:", e);
      set({ error: e?.message || "Failed to load chat settings" });
    } finally {
      set({ loading: false });
    }
  },

  updateChatSettings: async ({ uid, chatId, patch }) => {
    if (!uid || !chatId) return;
    const prev = get().getForChat(chatId);
    const next = normalize({ ...prev, ...(patch || {}) });

    set((s) => ({ byChatId: { ...s.byChatId, [chatId]: next }, error: null }));

    try {
      await setDoc(
        chatDocRef(uid, chatId),
        {
          ...next,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      set((s) => ({ byChatId: { ...s.byChatId, [chatId]: prev }, error: e?.message || "Failed to save" }));
      throw e;
    }
  },
}));
