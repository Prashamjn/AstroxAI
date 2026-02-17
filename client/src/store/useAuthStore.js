/**
 * Auth state: user, profile, loading, errors.
 * Profile comes from Firestore users/{uid}. Profile complete = has name + dob.
 */

import { create } from "zustand";

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  authLoading: true,
  profileLoading: true,
  error: null,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setAuthLoading: (v) => set({ authLoading: v }),
  setProfileLoading: (v) => set({ profileLoading: v }),
  setError: (error) => set({ error }),

  isProfileComplete: () => {
    const p = get().profile;
    return !!(p && p.name && p.dob);
  },

  clearError: () => set({ error: null }),
  signOut: () => set({ user: null, profile: null }),
}));
