import { useEffect, useRef } from "react";

const commands = [
  {
    name: "swarm",
    description: "Use multiple agents together to collaborate on your query.",
    hint: "Press Tab or click to insert",
    detail: "Agents collaborate, critique, and synthesize a superior answer. View runs with Ctrl+Shift+D.",
  },
];

export default function SlashPalette({ open, onSelect, onClose, query }) {
  const listRef = useRef(null);
  const filtered = query
    ? commands.filter((c) => c.name.startsWith(query.toLowerCase()))
    : commands;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        const first = filtered[0];
        if (first) onSelect(first);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, filtered, onSelect, onClose]);

  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 z-[60] w-80 max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] shadow-2xl">
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)]">Commands</p>
      </div>
      {filtered.length === 0 ? (
        <div className="px-3 py-3 text-xs text-[var(--text-muted)]">No matches</div>
      ) : (
        <ul className="py-1" ref={listRef}>
          {filtered.map((cmd) => (
            <li key={cmd.name}>
              <button
                type="button"
                onClick={() => onSelect(cmd)}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-white">/{cmd.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{cmd.hint}</span>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1">{cmd.description}</div>
                {cmd.detail && (
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">{cmd.detail}</div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
