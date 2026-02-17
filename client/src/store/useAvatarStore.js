import { create } from "zustand";

function keyFor(uid) {
  return uid ? `astroxai_avatar_${uid}` : "astroxai_avatar_guest";
}

function read(uid) {
  try {
    return localStorage.getItem(keyFor(uid)) || "";
  } catch {
    return "";
  }
}

function write(uid, dataUrl) {
  try {
    localStorage.setItem(keyFor(uid), dataUrl || "");
  } catch {
    // ignore
  }
}

export const useAvatarStore = create((set, get) => ({
  uid: null,
  avatarDataUrl: "",

  hydrate: (uid) => {
    set({ uid: uid || null, avatarDataUrl: read(uid) });
  },

  setAvatar: (uid, dataUrl) => {
    write(uid, dataUrl);
    set({ uid: uid || null, avatarDataUrl: dataUrl || "" });
  },

  clearAvatar: (uid) => {
    write(uid, "");
    set({ uid: uid || null, avatarDataUrl: "" });
  },
}));
