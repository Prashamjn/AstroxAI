/**
 * Agent dropdown with tooltip descriptions (no API keys in UI).
 */

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";

export default function AgentSelector() {
  const [open, setOpen] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  const agents = useChatStore((s) => s.agents);
  const currentAgent = useChatStore((s) => s.currentAgent);
  const setCurrentAgent = useChatStore((s) => s.setCurrentAgent);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Ensure "Auto" is always present and listed first (fallback if API didn't return it)
  const autoMeta = { name: "Auto", description: "System picks the best agent for your question" };
  const agentsWithAuto = { auto: agents.auto ?? autoMeta, ...agents };
  const entries = Object.entries(agentsWithAuto).sort(([a], [b]) =>
    a === "auto" ? -1 : b === "auto" ? 1 : 0
  );
  const currentMeta = agentsWithAuto[currentAgent];
  const currentName = currentMeta?.name ?? currentAgent;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setTooltip(currentMeta?.description ?? null)}
        onMouseLeave={() => setTooltip(null)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-colors min-w-[140px] justify-between"
      >
        <span className="truncate">{currentName}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-64 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-xl py-1 z-50 animate-fade-in">
          {entries.map(([id, meta]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setCurrentAgent(id);
                setOpen(false);
              }}
              onMouseEnter={() => setTooltip(meta?.description ?? null)}
              onMouseLeave={() => setTooltip(null)}
              className={`
                w-full text-left px-3 py-2.5 text-sm transition-colors
                ${id === currentAgent ? "bg-indigo-500/20 text-indigo-300" : "hover:bg-white/10 text-[var(--text-primary)]"}
              `}
            >
              <span className="font-medium block">{meta?.name ?? id}</span>
              {meta?.description && (
                <span className="text-xs text-[var(--text-muted)] mt-0.5 block">
                  {meta.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Agent info tooltip (when dropdown closed) */}
      {tooltip && !open && (
        <div className="absolute bottom-full left-0 mb-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs text-[var(--text-muted)] max-w-[220px] z-50 shadow-lg animate-fade-in">
          {tooltip}
        </div>
      )}
    </div>
  );
}

function ChevronDown({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
