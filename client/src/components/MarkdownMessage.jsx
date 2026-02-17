/**
 * Renders markdown with Prism code highlighting and copy button for code/terminal blocks.
 */

import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-css";

function CodeBlockWithCopy({ children, ...props }) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef(null);

  const handleCopy = async () => {
    const el = preRef.current;
    const text = el?.textContent ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  return (
    <div className="relative group mt-4 mb-4 rounded-xl overflow-hidden bg-[#1e1e2e] border border-white/10">
      <pre ref={preRef} {...props} className="!mt-0 !mb-0 px-5 py-4 overflow-x-auto text-sm leading-relaxed">
        {children}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-3 right-3 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white/10 text-[var(--text-muted)] hover:bg-white/20 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        aria-label="Copy"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export default function MarkdownMessage({ content }) {
  useEffect(() => {
    Prism.highlightAll();
  }, [content]);

  return (
    <div className="markdown-body text-[var(--text-primary)] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }) {
            return (
              <code className={className || ""} {...props}>
                {children}
              </code>
            );
          },
          pre({ node, children, ...props }) {
            return (
              <CodeBlockWithCopy {...props}>
                {children}
              </CodeBlockWithCopy>
            );
          },
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto">
                <table className="min-w-full text-sm border border-[var(--border)] rounded-lg overflow-hidden">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                {children}
              </thead>
            );
          },
          th({ children }) {
            return (
              <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)] border-r border-[var(--border)] last:border-r-0">
                {children}
              </th>
            );
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-[var(--border)]">{children}</tbody>;
          },
          tr({ children }) {
            return (
              <tr className="hover:bg-[var(--bg-secondary)] transition-colors">
                {children}
              </tr>
            );
          },
          td({ children }) {
            return (
              <td className="px-4 py-3 text-[var(--text-primary)] border-r border-[var(--border)] last:border-r-0">
                {children}
              </td>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
