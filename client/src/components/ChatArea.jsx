/**
 * Main chat area: message list with user (right) / assistant (left) bubbles.
 * Streaming shows typing cursor; markdown + code highlight for assistant.
 */

import { useRef, useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import MarkdownMessage from "./MarkdownMessage";
import TypingDots from "./TypingDots";

const API_BASE = "/api";

export default function ChatArea() {
  const bottomRef = useRef(null);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const getCurrentChat = useChatStore((s) => s.getCurrentChat);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const agents = useChatStore((s) => s.agents);
  const currentAgent = useChatStore((s) => s.currentAgent);
  const setChatSettingsOpen = useChatStore((s) => s.setChatSettingsOpen);
  const user = useAuthStore((s) => s.user);

  const chat = getCurrentChat();
  const messages = chat?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // New chat / no messages: show welcome and clickable agent buttons (only the 5 concrete agents, not Auto)
  const isNewChatEmpty = messages.length === 0;
  const concreteAgentIds = ["arcee", "solar", "liquid", "qwen", "nemotron"];

  if (isNewChatEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6">
        <div className="w-full max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight mb-3">
            What are you working on?
          </h1>
          <p className="text-[var(--text-muted)] text-sm sm:text-base max-w-xl mx-auto mb-7">
            Pick an agent and start a conversation.
          </p>
        </div>

        <div className="hidden sm:block w-full max-w-2xl">
          <div className="flex flex-wrap gap-2 justify-center">
            {concreteAgentIds.map((id) => {
              const meta = agents[id];
              const name = meta?.name ?? id;
              const isSelected = currentAgent === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => useChatStore.getState().setCurrentAgent(id)}
                  className={`
                    px-4 py-2.5 rounded-2xl text-sm font-medium transition-colors
                    border focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                    ${isSelected
                      ? "bg-indigo-600/80 border-indigo-500 text-white"
                      : "bg-white/5 border-white/10 text-[var(--text-muted)] hover:bg-white/10 hover:text-white hover:border-white/20"}
                  `}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="hidden md:block max-w-3xl mx-auto px-4 pt-4">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setChatSettingsOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors"
            aria-label="Chat settings"
            title="Chat settings"
          >
            <SlidersIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-6 space-y-5 sm:space-y-6">
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            role={msg.role}
            content={msg.content}
            agentId={msg.agent}
            responseId={msg.responseId}
            feedback={msg.feedback}
            collabAgents={msg.collabAgents}
            uid={user?.uid || null}
            agents={agents}
            isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
          />
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start animate-slide-in">
            <div className="rounded-2xl rounded-tl-sm bg-[var(--bg-tertiary)] border border-[var(--border)] px-4 py-3 min-h-[44px] shadow-sm">
              <p className="text-xs text-[var(--text-muted)] mb-2">
                {agents[currentAgent]?.name ?? currentAgent}
              </p>
              <TypingDots className="text-base" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function SlidersIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21v-7m0-4V3m10 18v-5m0-4V3m10 18v-9m0-4V3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 14h6m4 2h6m-6-8h6" />
    </svg>
  );
}

function MessageBubble({ role, content, agentId, responseId, feedback, uid, agents, isStreaming, collabAgents }) {
  // When agent is "auto", backend should have sent the real selected agent; fallback label if still "auto"
  const meta = agents[agentId];
  const name = meta?.name ?? (agentId === "auto" ? "Auto" : agentId);
  const swarmLabel = Array.isArray(collabAgents) && collabAgents.length > 0
    ? `Swarm: ${collabAgents
        .map((id) => agents[id]?.name ?? id)
        .filter(Boolean)
        .join(", ")}`
    : null;

  if (role === "user") {
    return (
      <div className="flex justify-end animate-slide-in">
        <div className="user-message-bg rounded-2xl rounded-tr-sm text-white px-4 py-3 max-w-[92%] sm:max-w-[85%] shadow-lg border border-white/10">
          <p className="whitespace-pre-wrap break-words text-[15px] sm:text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-slide-in">
      <div className="rounded-2xl rounded-tl-sm bg-[var(--bg-tertiary)] border border-[var(--border)] px-4 py-3 max-w-[92%] sm:max-w-[85%] shadow-sm">
        <p className="text-xs text-[var(--text-muted)] mb-2">{swarmLabel || name}</p>
        {content ? (
          <div className={isStreaming ? "typing-cursor" : ""}>
            <MarkdownMessage content={content} />
          </div>
        ) : (
          <TypingDots />
        )}

        {!isStreaming && responseId && (
          <FeedbackRow
            responseId={responseId}
            agentId={agentId}
            collabAgents={collabAgents}
            uid={uid}
            current={feedback}
          />
        )}
      </div>
    </div>
  );
}

function FeedbackRow({ responseId, agentId, collabAgents, uid, current }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const setLastAssistantFeedback = useChatStore((s) => s.setLastAssistantFeedback);

  const send = async (fb) => {
    if (!responseId || sending) return;
    setSending(true);
    try {
      await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response_id: responseId,
          user_id: uid,
          feedback: fb,
          agent_name: agentId,
          agent_names: Array.isArray(collabAgents) ? collabAgents : undefined,
        }),
      });
      setLastAssistantFeedback(fb);
      setSent(true);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const base = "mt-3 flex items-center gap-2";
  const btn = (active) =>
    `px-2 py-1 rounded-md text-xs border border-white/10 transition-colors ${
      active ? "bg-white/10 text-white" : "bg-white/5 text-[var(--text-muted)] hover:bg-white/10 hover:text-white"
    } ${sending ? "opacity-50" : ""}`;

  if (sent) {
    return (
      <div className="mt-3 text-xs text-[var(--text-muted)]">
        Thanks for your feedback!
      </div>
    );
  }

  return (
    <div className={base}>
      <button type="button" className={btn(current === "up")} onClick={() => send("up")} disabled={sending}>
        👍
      </button>
      <button type="button" className={btn(current === "down")} onClick={() => send("down")} disabled={sending}>
        👎
      </button>
    </div>
  );
}
