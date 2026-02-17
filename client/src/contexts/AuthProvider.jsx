/**
 * Wraps app with Firebase auth listener and Firestore profile loader.
 * Persists auth (local); on auth change loads profile from Firestore.
 */

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useAuthStore } from "../store/useAuthStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useAvatarStore } from "../store/useAvatarStore";

export function AuthProvider({ children }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setAuthLoading = useAuthStore((s) => s.setAuthLoading);
  const setProfileLoading = useAuthStore((s) => s.setProfileLoading);
  const signOut = useAuthStore((s) => s.signOut);

  const hydrateFromAuth = useSettingsStore((s) => s.hydrateFromAuth);
  const resetSettings = useSettingsStore((s) => s.reset);
  const initCrossTabSync = useSettingsStore((s) => s.initCrossTabSync);

  const hydrateAvatar = useAvatarStore((s) => s.hydrate);

  useEffect(() => {
    initCrossTabSync();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      setUser(firebaseUser ?? null);
      setProfile(null);
      if (!firebaseUser) {
        resetSettings();
        hydrateAvatar(null);
        setAuthLoading(false);
        setProfileLoading(false);
        return;
      }
      hydrateAvatar(firebaseUser.uid);
      setProfileLoading(true);
      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        setProfile(data);
        hydrateFromAuth({ uid: firebaseUser.uid, remoteSettings: data?.settings || {} });
      } catch (e) {
        console.warn("[Auth] Profile load failed:", e);
        setProfile(null);
        hydrateFromAuth({ uid: firebaseUser.uid, remoteSettings: {} });
      } finally {
        setAuthLoading(false);
        setProfileLoading(false);
      }
    });
    return () => unsub();
  }, [setUser, setProfile, setAuthLoading, setProfileLoading, hydrateFromAuth, resetSettings, initCrossTabSync, hydrateAvatar]);

  return children;
}
