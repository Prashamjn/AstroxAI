/**
 * Input bar: agent selector, text input, image button (UI only), send / abort.
 */

import { useState, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useChatSettingsStore } from "../store/useChatSettingsStore";
import AgentSelector from "./AgentSelector";
import SlashPalette from "./SlashPalette";

const API_BASE = "/api";

export default function InputBar() {
  const [input, setInput] = useState("");
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [imageMessage, setImageMessage] = useState(null);
  const [attachedImages, setAttachedImages] = useState([]);
  const [showSlashPalette, setShowSlashPalette] = useState(false);

  const user = useAuthStore((s) => s.user);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const getChatSettings = useChatSettingsStore((s) => s.getForChat);

  const currentAgent = useChatStore((s) => s.currentAgent);
  const getCurrentMessages = useChatStore((s) => s.getCurrentMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const appendStreamingContent = useChatStore((s) => s.appendStreamingContent);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const finishStreaming = useChatStore((s) => s.finishStreaming);
  const setAbortController = useChatStore((s) => s.setAbortController);
  const setLastAssistantAgent = useChatStore((s) => s.setLastAssistantAgent);
  const setLastAssistantResponseId = useChatStore((s) => s.setLastAssistantResponseId);
  const setLastAssistantCollabAgents = useChatStore((s) => s.setLastAssistantCollabAgents);
  const setModelStatus = useChatStore((s) => s.setModelStatus);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const abortRequest = useChatStore((s) => s.abortRequest);

  const send = async () => {
    const raw = input.trim();
    const forceSwarm = /^\s*\/swarm\b/i.test(raw);
    const text = forceSwarm ? raw.replace(/^\s*\/swarm\b\s*/i, "").trim() : raw;
    const hasImages = attachedImages.length > 0;
    if ((!text && !hasImages) || isStreaming) return;

    const messages = getCurrentMessages();
    const userContentForHistory = text || (hasImages ? "[Image]" : "");
    const userMessage = { role: "user", content: userContentForHistory };
    addMessage("user", userContentForHistory);

    setInput("");
    setAttachedImages([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const uid = user?.uid || null;
    const chatSettings = uid && currentChatId ? getChatSettings(currentChatId) : null;
    const memoryEnabled = chatSettings?.memoryEnabled !== false;
    const systemPromptOverride = chatSettings?.systemPromptOverride || "";

    const historyMessages = memoryEnabled ? [...messages, userMessage] : [userMessage];
    const allMessages = historyMessages.map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    setAbortController(controller);
    setStreaming(true);

    addMessage("assistant", "");

    const imageUrls = hasImages ? attachedImages.map((img) => img.dataUrl) : undefined;

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: currentAgent,
          uid: uid,
          messages: allMessages,
          imageUrls: imageUrls,
          systemPromptOverride: systemPromptOverride,
          forceSwarm,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      // When using Auto, set the selected agent as soon as we get it (header or first SSE event) so the bubble shows the real agent name
      const selectedAgentHeader = res.headers.get("X-Selected-Agent");
      if (selectedAgentHeader) {
        setLastAssistantAgent(selectedAgentHeader.trim());
      }

      const responseIdHeader = res.headers.get("X-Response-Id");
      if (responseIdHeader) {
        setLastAssistantResponseId(responseIdHeader.trim());
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.selectedAgent) setLastAssistantAgent(parsed.selectedAgent);
              if (parsed.responseId) setLastAssistantResponseId(parsed.responseId);
              if (parsed.collabAgents) setLastAssistantCollabAgents(parsed.collabAgents);
              if (parsed.status) setModelStatus(parsed.status);
              if (parsed.content) appendStreamingContent(parsed.content);
              if (parsed.error) throw new Error(parsed.error);
            } catch (e) {
              if (e.name === "SyntaxError") continue;
              throw e;
            }
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        // User aborted — keep partial message
      } else {
        appendStreamingContent(`\n\n[Error: ${err.message}]`);
      }
    } finally {
      finishStreaming();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if (e.key === "/") {
      const value = e.currentTarget.value;
      const beforeSlash = value.slice(0, e.currentTarget.selectionStart);
      if (beforeSlash.trim() === "") {
        e.preventDefault();
        setShowSlashPalette(true);
      }
    } else if (e.key === "Escape") {
      setShowSlashPalette(false);
    }
  };

  const handleSelectSlashCommand = (cmd) => {
    setInput(`/${cmd.name} `);
    setShowSlashPalette(false);
    textareaRef.current?.focus();
  };

  const handleCloseSlashPalette = () => {
    setShowSlashPalette(false);
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const resizeImageDataUrl = (dataUrl, maxSize = 1024, quality = 0.85) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) {
            h = Math.round((h * maxSize) / w);
            w = maxSize;
          } else {
            w = Math.round((w * maxSize) / h);
            h = maxSize;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageMessage("Please select an image file (JPEG, PNG, WebP).");
      setTimeout(() => setImageMessage(null), 3000);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      let dataUrl = reader.result;
      dataUrl = await resizeImageDataUrl(dataUrl, 1024, 0.85);
      setAttachedImages((prev) => [...prev, { id: `${Date.now()}-${file.name}`, dataUrl }]);
      setImageMessage(`Added "${file.name}". Ask the agent to analyze it.`);
      setTimeout(() => setImageMessage(null), 2000);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeAttachedImage = (id) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== id));
  };

  return (
    <div className="px-3 sm:px-4 pt-3 pb-[calc(0.9rem+env(safe-area-inset-bottom))] bg-[var(--bg-primary)]">
      <div className="max-w-3xl mx-auto flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <AgentSelector />
        </div>

        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-hidden="true"
            onChange={handleImageSelect}
          />
          {attachedImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachedImages.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.dataUrl}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover border border-[var(--border)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachedImage(img.id)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500/80 text-white text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              disabled={isStreaming}
              className="flex-1 min-h-[48px] max-h-[200px] resize-none bg-transparent px-3 py-3 text-[15px] sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleImageClick}
              disabled={isStreaming}
              className="p-2.5 rounded-xl shrink-0 text-[var(--text-muted)] hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              aria-label="Upload image"
              title="Attach image for analysis"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            {isStreaming ? (
              <button
                type="button"
                onClick={abortRequest}
                className="p-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                aria-label="Stop generating"
              >
                <StopIcon className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={send}
                disabled={!input.trim() && attachedImages.length === 0}
                className="send-button-bg p-2.5 rounded-xl text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-[0_6px_18px_rgba(79,70,229,0.35)]"
                aria-label="Send message"
              >
                <SendIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          <SlashPalette
            open={showSlashPalette}
            onSelect={handleSelectSlashCommand}
            onClose={handleCloseSlashPalette}
            query={input.startsWith("/") ? input.slice(1) : ""}
          />
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-[var(--text-muted)]">
            Enter to send, Shift+Enter for new line.
          </p>
          {imageMessage && (
            <p className="text-xs text-indigo-400 animate-fade-in">
              {imageMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function SendIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M12 4l7 7-7 7" />
    </svg>
  );
}

function StopIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
