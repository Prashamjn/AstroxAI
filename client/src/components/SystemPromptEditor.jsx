/**
 * System Prompt Editor — modal to edit per-agent system prompts.
 * ChatGPT-style settings panel: agent dropdown, textarea, Save, Reset to default.
 */

import { useState, useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import AstroxLoader from "./AstroxLoader";

const API_BASE = "/api";

export default function SystemPromptEditor({ open, onClose, embedded = false }) {
  const agents = useChatStore((s) => s.agents);
  const showToast = useChatStore((s) => s.showToast);

  const [selectedAgentId, setSelectedAgentId] = useState("arcee");
  const [customPrompt, setCustomPrompt] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const concreteIds = ["arcee", "solar", "liquid", "qwen", "nemotron"];

  const isOpen = embedded ? true : open;

  useEffect(() => {
    if (!isOpen) setDropdownOpen(false);
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAgentId("arcee");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedAgentId) return;
    setLoading(true);
    fetch(`${API_BASE}/prompts/${selectedAgentId}`)
      .then((res) => res.json())
      .then((data) => {
        setCustomPrompt(data.custom_prompt ?? "");
        setDefaultPrompt(data.default_prompt ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, selectedAgentId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/prompts/${selectedAgentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_prompt: customPrompt }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("Prompt updated successfully");
      } else {
        showToast(data.error || "Failed to save");
      }
    } catch (e) {
      showToast("Failed to save prompt");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/prompts/${selectedAgentId}/reset`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        setCustomPrompt("");
        setDefaultPrompt(data.system_prompt ?? "");
        showToast("Reset to default successfully");
      } else {
        showToast(data.error || "Failed to reset");
      }
    } catch (e) {
      showToast("Failed to reset");
    } finally {
      setSaving(false);
    }
  };

  if (!embedded && !isOpen) return null;

  const agentName = agents[selectedAgentId]?.name ?? selectedAgentId;
  const tokenCount = customPrompt ? customPrompt.split(/\s+/).filter(Boolean).length : 0;

  const content = (
    <div className="p-5 flex flex-col gap-4 overflow-hidden flex-1 min-h-0">
      <div ref={dropdownRef} className="relative">
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Agent</label>
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl
            bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10
            text-left text-sm text-white font-medium
            hover:border-white/20 hover:from-white/[0.12] hover:to-white/[0.04]
            focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/30
            transition-all duration-200 shadow-sm"
        >
          <span className="truncate">{agents[selectedAgentId]?.name ?? selectedAgentId}</span>
          <span className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}>
            <ChevronDown className="w-4 h-4" />
          </span>
        </button>
        {dropdownOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-1.5 py-1 rounded-xl
              bg-[var(--bg-tertiary)]/95 backdrop-blur-md border border-white/10 shadow-xl
              animate-fade-in z-10 overflow-hidden"
          >
            {concreteIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSelectedAgentId(id);
                  setDropdownOpen(false);
                }}
                className={`w-full flex items-center px-4 py-2.5 text-left text-sm transition-colors duration-150
                  ${id === selectedAgentId
                    ? "bg-indigo-500/10 text-indigo-200 shadow-[inset_2px_0_0_0_rgba(129,140,248,0.6)]"
                    : "text-[var(--text-primary)] hover:bg-white/8"}`}
              >
                <span className="truncate">{agents[id]?.name ?? id}</span>
                {id === selectedAgentId && (
                  <span className="ml-auto shrink-0 text-indigo-400">
                    <CheckIcon className="w-4 h-4" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
          System prompt for {agentName}
        </label>
        {loading ? (
          <AstroxLoader fullScreen={false} />
        ) : (
          <>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={defaultPrompt || "Enter custom system prompt…"}
              className="flex-1 min-h-[200px] w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y"
              spellCheck="false"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {tokenCount} words · Leave empty to use default prompt
            </p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-white/10 text-[var(--text-primary)] text-sm font-medium hover:bg-white/20 disabled:opacity-50"
        >
          Reset to default
        </button>
        {!embedded && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-lg text-[var(--text-muted)] text-sm hover:bg-white/10"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">System Prompt Editor</h3>
        </div>
        <div className="px-5 py-4 min-h-[300px]">{content}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-2xl flex flex-col max-h-[85vh] animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-white">System Prompt Editor</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white"
            aria-label="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {content}
      </div>
    </div>
  );
}

function CloseIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronDown({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
