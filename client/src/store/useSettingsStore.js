import { create } from "zustand";
import { setUserProfile } from "../lib/firestore";

const STORAGE_KEY = "astroxai_settings";
const LEGACY_THEME_KEY = "astroxai_theme";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? safeParse(raw) : null;
    if (parsed && typeof parsed === "object") return parsed;

    const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacyTheme) return { theme: legacyTheme };
    return {};
  } catch {
    return {};
  }
}

function writeLocal(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function normalizeSettings(s) {
  const base = s && typeof s === "object" ? s : {};
  const theme = base.theme;
  const defaultAgent = base.defaultAgent;
  return {
    ...base,
    theme: theme === "system" || theme === "dark" || theme === "light" ? theme : "system",
    defaultAgent: typeof defaultAgent === "string" && defaultAgent.trim() ? defaultAgent : "auto",
  };
}

export const useSettingsStore = create((set, get) => ({
  uid: null,
  settings: normalizeSettings(readLocal()),
  hydrated: false,

  hydrateFromAuth: ({ uid, remoteSettings }) => {
    const local = normalizeSettings(readLocal());
    const remote = normalizeSettings(remoteSettings || {});
    const merged = { ...local, ...remote };

    set({ uid: uid || null, settings: merged, hydrated: true });
    writeLocal(merged);
  },

  reset: () => {
    const local = normalizeSettings(readLocal());
    set({ uid: null, settings: local, hydrated: true });
  },

  initCrossTabSync: () => {
    if (get()._crossTabInit) return;
    const handler = (e) => {
      if (e?.key !== STORAGE_KEY) return;
      const next = normalizeSettings(readLocal());
      set({ settings: next });
    };
    window.addEventListener("storage", handler);
    set({ _crossTabInit: true, _crossTabHandler: handler });
  },

  disposeCrossTabSync: () => {
    const handler = get()._crossTabHandler;
    if (handler) window.removeEventListener("storage", handler);
    set({ _crossTabInit: false, _crossTabHandler: null });
  },

  setTheme: async (theme) => {
    const prev = get().settings;
    const next = normalizeSettings({ ...prev, theme });

    set({ settings: next });
    writeLocal(next);

    const uid = get().uid;
    if (!uid) return;

    try {
      await setUserProfile(uid, { settings: next });
    } catch (e) {
      set({ settings: prev });
      writeLocal(prev);
      throw e;
    }
  },

  setDefaultAgent: async (defaultAgent) => {
    const prev = get().settings;
    const next = normalizeSettings({ ...prev, defaultAgent });

    set({ settings: next });
    writeLocal(next);

    const uid = get().uid;
    if (!uid) return;

    try {
      await setUserProfile(uid, { settings: next });
    } catch (e) {
      set({ settings: prev });
      writeLocal(prev);
      throw e;
    }
  },
}));
