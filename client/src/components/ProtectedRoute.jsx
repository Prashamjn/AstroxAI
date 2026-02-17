/**
 * Protects dashboard: redirect to /login if not auth, to /onboarding if profile incomplete.
 */

import { Navigate, useLocation } from "react-router-dom";
import AstroxLoader from "./AstroxLoader";
import { useAuthStore } from "../store/useAuthStore";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const authLoading = useAuthStore((s) => s.authLoading);
  const profileLoading = useAuthStore((s) => s.profileLoading);
  const isProfileComplete = useAuthStore((s) => s.isProfileComplete);

  if (authLoading || profileLoading) {
    return <AstroxLoader fullScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const complete = isProfileComplete();
  if (!complete && user && (profile === null || !profile?.name || !profile?.dob)) {
    return <Navigate to="/onboarding" state={{ from: location }} replace />;
  }

  return children;
}
