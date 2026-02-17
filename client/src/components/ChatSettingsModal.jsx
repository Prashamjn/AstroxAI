import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useChatSettingsStore } from "../store/useChatSettingsStore";

export default function ChatSettingsModal({ open, onClose }) {
  const user = useAuthStore((s) => s.user);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const showToast = useChatStore((s) => s.showToast);

  const loadChatSettings = useChatSettingsStore((s) => s.loadChatSettings);
  const updateChatSettings = useChatSettingsStore((s) => s.updateChatSettings);
  const getForChat = useChatSettingsStore((s) => s.getForChat);
  const loading = useChatSettingsStore((s) => s.loading);

  const uid = user?.uid || null;
  const settings = useMemo(() => (currentChatId ? getForChat(currentChatId) : null), [currentChatId, getForChat]);

  const [promptDraft, setPromptDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!uid || !currentChatId) return;
    loadChatSettings({ uid, chatId: currentChatId });
  }, [open, uid, currentChatId, loadChatSettings]);

  useEffect(() => {
    if (!open) return;
    setPromptDraft(settings?.systemPromptOverride || "");
  }, [open, settings?.systemPromptOverride]);

  if (!open) return null;

  const history = settings?.promptHistory || [];

  const savePrompt = async () => {
    if (!uid || !currentChatId) return;
    setSaving(true);
    try {
      const trimmed = promptDraft.trim();
      const prev = settings?.systemPromptOverride || "";
      const nextHistory = prev.trim()
        ? [{ prompt: prev, createdAt: Date.now() }, ...history].slice(0, 20)
        : history;

      await updateChatSettings({
        uid,
        chatId: currentChatId,
        patch: {
          systemPromptOverride: trimmed,
          promptHistory: nextHistory,
        },
      });
      showToast("Chat prompt updated");
    } catch {
      showToast("Failed to update chat prompt");
    } finally {
      setSaving(false);
    }
  };

  const toggleMemory = async () => {
    if (!uid || !currentChatId) return;
    try {
      await updateChatSettings({ uid, chatId: currentChatId, patch: { memoryEnabled: !settings?.memoryEnabled } });
    } catch {
      showToast("Failed to update memory setting");
    }
  };

  const restoreVersion = async (prompt) => {
    setPromptDraft(prompt || "");
  };

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/60 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-2xl flex flex-col max-h-[85vh] animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-white">Chat Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white"
            aria-label="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5 overflow-y-auto">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]">
            <div className="px-5 py-4 border-b border-white/10">
              <div className="text-sm font-semibold text-white">Memory</div>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-white/90">Use chat history</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    When off, only your latest message is sent to the model.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleMemory}
                  className={`h-9 w-[64px] rounded-full border transition-colors relative ${
                    settings?.memoryEnabled ? "bg-[var(--accent)]/70 border-[var(--accent)]/60" : "bg-white/5 border-white/15"
                  }`}
                  aria-label="Toggle memory"
                >
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white shadow transition-all ${
                      settings?.memoryEnabled ? "left-[34px]" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]">
            <div className="px-5 py-4 border-b border-white/10">
              <div className="text-sm font-semibold text-white">System prompt override</div>
            </div>
            <div className="px-5 py-4">
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">This chat only</label>
              <textarea
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                placeholder="Leave empty to use your agent defaults"
                rows={6}
                spellCheck="false"
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y"
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={savePrompt}
                  disabled={saving || !uid || !currentChatId}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setPromptDraft("")}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-medium"
                >
                  Clear
                </button>
                {loading && <span className="text-xs text-[var(--text-muted)] ml-auto">Loading…</span>}
              </div>

              {history.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs text-[var(--text-muted)] mb-2">Previous versions</div>
                  <div className="flex flex-col gap-2">
                    {history.slice(0, 8).map((h, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => restoreVersion(h.prompt)}
                        className="w-full text-left rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 px-4 py-3 transition-colors"
                      >
                        <div className="text-xs text-[var(--text-muted)]">{h.createdAt ? new Date(h.createdAt).toLocaleString() : ""}</div>
                        <div className="text-sm text-white mt-1 line-clamp-2 whitespace-pre-wrap break-words">{h.prompt}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--border)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-medium"
          >
            Done
          </button>
        </div>
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
