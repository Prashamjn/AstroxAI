/**
 * Animated three-dot typing indicator (bouncing dots).
 */

export default function TypingDots({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-[var(--text-muted)] ${className}`}>
      <span className="typing-dot" />
      <span className="typing-dot typing-dot-2" />
      <span className="typing-dot typing-dot-3" />
    </span>
  );
}
