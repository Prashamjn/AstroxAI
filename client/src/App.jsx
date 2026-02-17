/**
 * AstroxAI — Router + Auth. Protected dashboard; public login/signup/onboarding.
 */

import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import LoadingScreen from "./components/LoadingScreen";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Onboarding from "./pages/Onboarding";
import { useChatStore } from "./store/useChatStore";
import { useAuthStore } from "./store/useAuthStore";
import { useSettingsStore } from "./store/useSettingsStore";

const API_BASE = "/api";
const MIN_SPLASH_MS = 2200;

function AppContent() {
  const setAgents = useChatStore((s) => s.setAgents);
  const themeSelection = useSettingsStore((s) => s.settings?.theme);
  const [showLoader, setShowLoader] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");

    const apply = () => {
      const selection = themeSelection || "system";
      const effective = selection === "system" ? (media?.matches ? "dark" : "light") : selection;
      document.documentElement.setAttribute("data-theme", effective);
    };

    apply();

    if ((themeSelection || "system") !== "system" || !media) return;
    const handle = () => apply();
    if (media.addEventListener) media.addEventListener("change", handle);
    else media.addListener(handle);
    return () => {
      if (media.removeEventListener) media.removeEventListener("change", handle);
      else media.removeListener(handle);
    };
  }, [themeSelection]);

  useEffect(() => {
    let agentsDone = false;
    let minTimeDone = false;
    const checkReady = () => {
      if (agentsDone && minTimeDone) setIsAppReady(true);
    };
    fetch(`${API_BASE}/agents`)
      .then((r) => r.json())
      .then((data) => setAgents(data.agents || {}))
      .catch(() => setAgents({}))
      .finally(() => {
        agentsDone = true;
        checkReady();
      });
    const t = setTimeout(() => {
      minTimeDone = true;
      checkReady();
    }, MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, [setAgents]);

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showLoader && (
        <LoadingScreen
          isAppReady={isAppReady}
          onReady={() => setShowLoader(false)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
