/**
 * Reusable AstroxAI animated loading screen.
 * fullScreen: use for auth/profile loading; inline: smaller for modals.
 */

export default function AstroxLoader({ fullScreen = true }) {
  const content = (
    <div className="relative z-10 flex flex-col items-center">
      <div className="loading-logo mb-4">
        <span className="loading-logo-text">Astrox</span>
        <span className="loading-logo-accent">AI</span>
      </div>
      <p className="text-xs tracking-[0.2em] uppercase text-zinc-500 mb-4 animate-pulse">
        Loading
      </p>
      <div className={`rounded-full bg-white/5 overflow-hidden ${fullScreen ? "w-48 h-0.5" : "w-32 h-0.5"}`}>
        <div className="loading-bar-progress h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050508] overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="loading-orb loading-orb-1" />
          <div className="loading-orb loading-orb-2" />
          <div className="loading-orb loading-orb-3" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,transparent_0%,#050508_70%)]" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
        {content}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-6">
      {content}
    </div>
  );
}
