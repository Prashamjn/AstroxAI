/**
 * Toast notification — shows message for a few seconds (controlled by store).
 */

import { useChatStore } from "../store/useChatStore";

export default function Toast() {
  const toastMessage = useChatStore((s) => s.toastMessage);
  if (!toastMessage) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)] shadow-xl text-sm text-white animate-fade-in"
      role="status"
    >
      {toastMessage}
    </div>
  );
}
