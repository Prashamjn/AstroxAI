import { useEffect, useMemo, useState } from "react";

const API_BASE = "/api";

export default function DebugCollabPanel({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [details, setDetails] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const canShow = open === true;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [recentRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/collab/recent?limit=25`),
        fetch(`${API_BASE}/collab/stats?limit=500`),
      ]);
      const recentJson = await recentRes.json();
      const statsJson = await statsRes.json();
      setRuns(recentJson.runs || []);
      setStats(statsJson.stats || null);
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canShow) return;
    load();
  }, [canShow]);

  useEffect(() => {
    if (!canShow || !selectedId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/collab/run/${selectedId}`);
        const json = await res.json();
        if (!cancelled) setDetails(json.run || null);
      } catch {
        if (!cancelled) setDetails(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canShow, selectedId]);

  const selected = useMemo(() => runs.find((r) => String(r.id) === String(selectedId)) || null, [runs, selectedId]);

  if (!canShow) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-x-3 sm:inset-x-8 inset-y-6 sm:inset-y-10 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex">
        <div className="w-[340px] border-r border-[var(--border)] flex flex-col">
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Swarm Debug</div>
              <div className="text-xs text-[var(--text-muted)]">Recent collaboration runs</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={load}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white"
              >
                Close
              </button>
            </div>
          </div>

          {stats && (
            <div className="px-4 pb-3">
              <div className="text-xs text-[var(--text-muted)]">Swarm runs: {stats.total}</div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {loading && <div className="p-4 text-xs text-[var(--text-muted)]">Loading…</div>}
            {error && <div className="p-4 text-xs text-red-200">{error}</div>}
            {!loading && !error && runs.length === 0 && (
              <div className="p-4 text-xs text-[var(--text-muted)]">No runs yet.</div>
            )}
            {runs.map((r) => {
              const active = String(r.id) === String(selectedId);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[var(--border)] transition-colors ${
                    active ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <div className="text-xs text-white font-medium truncate">{r.leaderAgent || "(unknown)"}</div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate">
                    {Array.isArray(r.agents) ? r.agents.join(", ") : ""}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate">{r.routerReason || "unknown"}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-4 border-b border-[var(--border)]">
            <div className="text-sm font-semibold text-white">Run Details</div>
            {selected && (
              <div className="text-xs text-[var(--text-muted)] mt-1">
                run_id={selected.id} response_id={selected.responseId || ""}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!selectedId && <div className="text-xs text-[var(--text-muted)]">Select a run from the left.</div>}
            {selectedId && !details && <div className="text-xs text-[var(--text-muted)]">Loading details…</div>}

            {details && (
              <>
                <div>
                  <div className="text-xs font-semibold text-white mb-2">Query</div>
                  <div className="text-xs text-[var(--text-primary)] whitespace-pre-wrap break-words bg-white/5 border border-white/10 rounded-xl p-3">
                    {details.query}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-white mb-2">Final</div>
                  <div className="text-xs text-[var(--text-primary)] whitespace-pre-wrap break-words bg-white/5 border border-white/10 rounded-xl p-3">
                    {details.final?.final_answer || ""}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-white mb-2">Agent Answers</div>
                  <div className="space-y-2">
                    {(details.answers || []).map((a, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <div className="text-[11px] text-[var(--text-muted)] mb-1">{a.agent_id}</div>
                        <div className="text-xs text-[var(--text-primary)] whitespace-pre-wrap break-words">{a.answer || a.error || ""}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-white mb-2">Critiques</div>
                  <div className="space-y-2">
                    {(details.critiques || []).map((c, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <div className="text-[11px] text-[var(--text-muted)] mb-1">{c.reviewer_id}</div>
                        <div className="text-xs text-[var(--text-primary)] whitespace-pre-wrap break-words">{c.critique || c.error || ""}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {(details.votes || []).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-white mb-2">Votes</div>
                    <div className="space-y-2">
                      {(details.votes || []).map((v, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-3">
                          <div className="text-[11px] text-[var(--text-muted)] mb-1">
                            voter={v.voter_id} target={v.target_agent_id}
                          </div>
                          <div className="text-xs text-[var(--text-primary)]">
                            acc={v.accuracy_vote ?? "-"} rel={v.relevance_vote ?? "-"} clr={v.clarity_vote ?? "-"}
                          </div>
                          {v.notes && <div className="text-[11px] text-[var(--text-muted)] mt-1">{v.notes}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
