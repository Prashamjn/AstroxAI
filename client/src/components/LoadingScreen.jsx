/**
 * Full-screen loading / splash screen for AstroxAI.
 * Shown on initial load, then fades out when app is ready.
 */

import { useState, useEffect } from "react";

export default function LoadingScreen({ onReady, isAppReady }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!isAppReady) return;
    setFadeOut(true);
    const t = setTimeout(() => {
      onReady?.();
    }, 400);
    return () => clearTimeout(t);
  }, [isAppReady, onReady]);

  return (
    <div
      className={`
        fixed inset-0 z-[100] flex flex-col items-center justify-center
        bg-[#050508] overflow-hidden
        transition-opacity duration-500 ease-out
        ${fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"}
      `}
    >
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="loading-orb loading-orb-1" />
        <div className="loading-orb loading-orb-2" />
        <div className="loading-orb loading-orb-3" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,transparent_0%,#050508_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(99,102,241,0.03)_50%,transparent_100%)]" />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo / Brand */}
        <div className="loading-logo mb-6">
          <span className="loading-logo-text">Astrox</span>
          <span className="loading-logo-accent">AI</span>
        </div>
        <p className="text-xs tracking-[0.35em] uppercase text-zinc-500 mb-10 animate-pulse">
          Multi-Agent Intelligence
        </p>

        {/* Loading bar */}
        <div className="w-48 h-0.5 rounded-full bg-white/5 overflow-hidden">
          <div className="loading-bar-progress h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
        </div>
      </div>

      {/* Corner accent */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-12 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
    </div>
  );
}
