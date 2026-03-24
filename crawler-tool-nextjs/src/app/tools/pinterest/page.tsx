"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const API = "/api/proxy";

// ===== EXPORT =====
function dl(content: string, filename: string, type: string) {
  const b = new Blob([content], { type });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u; a.download = filename; a.click();
  URL.revokeObjectURL(u);
}
function exportCSV(results: any[], label: string) {
  if (!results.length) return;
  const headers = Object.keys(results[0]).filter(k => typeof results[0][k] !== "object");
  const rows = results.map(item => headers.map(h => `"${String(item[h] ?? "").replace(/"/g, '""')}"`));
  dl(headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n"), `pinterest-${label}-${Date.now()}.csv`, "text/csv;charset=utf-8");
}
function exportJSON(results: any[], label: string) {
  dl(JSON.stringify(results, null, 2), `pinterest-${label}-${Date.now()}.json`, "application/json");
}

type Tab = "pins" | "profile" | "history";

export default function PinterestToolPage() {
  // Form
  const [tab, setTab] = useState<Tab>("pins");
  const [keyword, setKeyword] = useState("");
  const [limit, setLimit] = useState(20);
  const [profileUrl, setProfileUrl] = useState("");

  // UI
  const [loading, setLoading] = useState(false);
  const [taskStatus, setTaskStatus] = useState<"idle" | "pending" | "running" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [histPage, setHistPage] = useState(1);
  const [histSearch, setHistSearch] = useState("");
  const [histStatusFilter, setHistStatusFilter] = useState("");
  const [histTypeFilter, setHistTypeFilter] = useState("");

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/pinterest/tasks?limit=200`);
      const data = await res.json();
      if (data.success) setHistory(data.data || []);
    } catch { /* ignore */ }
  }, []);

  const startPolling = useCallback((requestId: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/pinterest/tasks?request_id=${requestId}`);
        const data = await res.json();
        if (!data.success || !data.data?.length) return;
        const task = data.data[0];
        if (task.status === "success" && task.result) {
          stopPolling();
          setTaskStatus("success");
          setResults(Array.isArray(task.result) ? task.result : [task.result]);
          setLoading(false);
          setPage(1);
          fetchHistory();
        } else if (task.status === "error") {
          stopPolling();
          setTaskStatus("error");
          setErrorMsg(task.error || task.error_message || "Task bị lỗi");
          setLoading(false);
        } else if (task.status === "running") {
          setTaskStatus("running");
        }
      } catch { /* ignore */ }
    }, 3000);
  }, [fetchHistory]);

  // Load history & latest results on mount
  useEffect(() => {
    fetchHistory();
    (async () => {
      try {
        const res = await fetch(`${API}/pinterest/tasks/success?limit=1`);
        const data = await res.json();
        if (data.success && data.data?.length > 0) {
          const task = data.data[0];
          if (task.result) {
            setResults(Array.isArray(task.result) ? task.result : [task.result]);
            setTaskStatus("success");
          }
        }
      } catch { /* ignore */ }
    })();
    return () => stopPolling();
  }, [fetchHistory]);

  // ===== SUBMIT =====
  const handleScan = async () => {
    if (loading) return;
    let body: any = {};
    if (tab === "pins") {
      if (!keyword.trim()) { setErrorMsg("Vui lòng nhập keyword"); return; }
      body = { scan_type: "pins", keyword, limit };
    } else if (tab === "profile") {
      if (!profileUrl.trim()) { setErrorMsg("Vui lòng nhập URL profile"); return; }
      body = { scan_type: "profile", profile_url: profileUrl };
    }

    try {
      stopPolling(); setLoading(true); setResults([]); setTaskStatus("pending"); setErrorMsg("");
      const res = await fetch(`${API}/pinterest/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) { setTaskStatus("error"); setErrorMsg(data.message); setLoading(false); return; }
      setTaskStatus("running");
      const requestId = data.data?._id;
      if (requestId) startPolling(requestId);
    } catch (err: any) {
      setTaskStatus("error"); setErrorMsg(err?.message || "Lỗi"); setLoading(false);
    }
  };

  // Pagination
  const paginate = (data: any[], pg: number, ps: number) => data.slice((pg - 1) * ps, pg * ps);
  const totalPages = (data: any[], ps: number) => Math.max(1, Math.ceil(data.length / ps));
  const pagedResults = paginate(results, page, pageSize);
  const pagedHistory = paginate(history, histPage, 10);

  const PaginationBar = ({ current, total, totalItems, onChange, ps }: { current: number; total: number; totalItems: number; onChange: (p: number) => void; ps: number }) => {
    if (totalItems <= 0) return null;
    const start = (current - 1) * ps + 1;
    const end = Math.min(current * ps, totalItems);
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "#94A3B8" }}>
        <span>{start}–{end} / {totalItems}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {ps === pageSize && (
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); onChange(1); }} style={{ background: "#1E293B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "3px 8px", color: "#CBD5E1", fontSize: 12 }}>
              {[12, 24, 48, 96].map(s => <option key={s} value={s}>{s}/trang</option>)}
            </select>
          )}
          <button disabled={current <= 1} onClick={() => onChange(current - 1)} style={{ background: current <= 1 ? "transparent" : "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, padding: "3px 10px", color: current <= 1 ? "#475569" : "#EF4444", cursor: current <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
          <span style={{ minWidth: 60, textAlign: "center" }}>{current} / {total}</span>
          <button disabled={current >= total} onClick={() => onChange(current + 1)} style={{ background: current >= total ? "transparent" : "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, padding: "3px 10px", color: current >= total ? "#475569" : "#EF4444", cursor: current >= total ? "default" : "pointer", fontSize: 12 }}>▶</button>
        </div>
      </div>
    );
  };

  const StatusBadge = () => {
    if (taskStatus === "idle") return null;
    const cfg = {
      pending: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "rgba(251,191,36,0.3)", text: "⏳ Đang chờ worker..." },
      running: { bg: "rgba(220,38,38,0.15)", color: "#f87171", border: "rgba(220,38,38,0.3)", text: "🔄 Đang quét..." },
      success: { bg: "rgba(34,197,94,0.15)", color: "#4ade80", border: "rgba(34,197,94,0.3)", text: `✅ Hoàn thành — ${results.length} kết quả` },
      error: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "rgba(239,68,68,0.3)", text: `❌ ${errorMsg}` },
    }[taskStatus];
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, marginBottom: 16, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
        {(taskStatus === "pending" || taskStatus === "running") && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor", display: "inline-block", animation: "pulse 1.5s infinite" }} />}
        {cfg.text}
      </div>
    );
  };

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h1>📌 Pinterest Crawler</h1>
        <p>Quét pins, boards và profiles theo keyword</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {([
          { key: "pins" as Tab, label: "🖼️ Quét Pins" },
          { key: "profile" as Tab, label: "👤 Quét Profile" },
          { key: "history" as Tab, label: `📜 Lịch sử (${history.length})` },
        ]).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === "history") fetchHistory(); }} className={`tab-btn ${tab === t.key ? "active" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>

      {/* ===== PINS TAB ===== */}
      {tab === "pins" && (
        <>
          <div className="tool-form" style={{ maxWidth: 500 }}>
            <div className="form-group">
              <label>Keyword <span style={{ color: "#EF4444" }}>*</span></label>
              <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="VD: home decor, web design, fashion" onKeyDown={e => e.key === "Enter" && handleScan()} />
            </div>
            <div className="form-group">
              <label>Số lượng pins</label>
              <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} min={1} max={200} />
            </div>
            <button className="btn-submit" onClick={handleScan} disabled={loading}>
              {loading ? (taskStatus === "pending" ? "⏳ Đang chờ..." : "🔄 Đang quét...") : "🔍 Quét Pins"}
            </button>
            {errorMsg && taskStatus !== "error" && <p style={{ marginTop: 8, fontSize: 13, color: "#f87171" }}>⚠️ {errorMsg}</p>}
          </div>

          <div style={{ marginTop: 20 }}>
            <StatusBadge />

            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 12, color: "#94A3B8" }}>
                <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.1)", borderTop: "3px solid #E60023", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <p>Tự động cập nhật mỗi 3 giây...</p>
              </div>
            )}

            {!loading && results.length === 0 && taskStatus !== "error" && (
              <div style={{ textAlign: "center", padding: "3rem", color: "#64748B" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📌</div>
                <p>Nhập keyword và bấm &quot;Quét Pins&quot;</p>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="results-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <h2 style={{ margin: 0 }}>Kết quả: {results.length} pins</h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => exportCSV(results, "pins")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ CSV</button>
                    <button onClick={() => exportJSON(results, "pins")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ JSON</button>
                  </div>
                </div>

                {/* Pinterest Masonry Grid */}
                <div style={{ columnCount: 4, columnGap: 12, width: "100%" }}>
                  {pagedResults.map((pin: any, i: number) => (
                    <div key={i} onClick={() => setSelectedRow(pin)} style={{
                      breakInside: "avoid", marginBottom: 12, background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 12, overflow: "hidden", cursor: "pointer", transition: "all 0.2s",
                    }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(220,38,38,0.4)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                       onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
                      {/* Image */}
                      {pin.image ? (
                        <img src={pin.image} alt="" style={{ width: "100%", display: "block" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div style={{ width: "100%", height: 150, background: "linear-gradient(135deg, #1E293B, #0F172A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>📌</div>
                      )}
                      <div style={{ padding: "8px 10px" }}>
                        {pin.title && (
                          <div style={{ fontWeight: 600, color: "#F1F5F9", fontSize: 13, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>{pin.title}</div>
                        )}
                        {pin.creator && (
                          <div style={{ fontSize: 12, color: "#E60023", marginBottom: 2 }}>
                            {pin.creator_link ? <a href={pin.creator_link} target="_blank" onClick={e => e.stopPropagation()} style={{ color: "#E60023", textDecoration: "none" }}>📌 {pin.creator}</a> : `📌 ${pin.creator}`}
                          </div>
                        )}
                        {pin.description && (
                          <p style={{ fontSize: 11, color: "#94A3B8", margin: "4px 0 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>{pin.description}</p>
                        )}
                        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                          {pin.pin_link && <a href={pin.pin_link} target="_blank" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: "#E60023", textDecoration: "none", padding: "2px 6px", borderRadius: 10, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)" }}>📌 Pin</a>}
                          {pin.external_link && <a href={pin.external_link} target="_blank" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: "#3B82F6", textDecoration: "none", padding: "2px 6px", borderRadius: 10, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>🔗 Link</a>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <PaginationBar current={page} total={totalPages(results, pageSize)} totalItems={results.length} onChange={setPage} ps={pageSize} />
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== PROFILE TAB ===== */}
      {tab === "profile" && (
        <>
          <div className="tool-form" style={{ maxWidth: 500 }}>
            <div className="form-group">
              <label>URL Profile Pinterest <span style={{ color: "#EF4444" }}>*</span></label>
              <input value={profileUrl} onChange={e => setProfileUrl(e.target.value)} placeholder="https://www.pinterest.com/username/" onKeyDown={e => e.key === "Enter" && handleScan()} />
            </div>
            <button className="btn-submit" onClick={handleScan} disabled={loading}>
              {loading ? "🔄 Đang quét..." : "🔍 Quét Profile"}
            </button>
            {errorMsg && taskStatus !== "error" && <p style={{ marginTop: 8, fontSize: 13, color: "#f87171" }}>⚠️ {errorMsg}</p>}
          </div>
          <div style={{ marginTop: 20 }}>
            <StatusBadge />
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 12, color: "#94A3B8" }}>
                <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.1)", borderTop: "3px solid #E60023", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <p>Đang quét profile...</p>
              </div>
            )}

            {/* Profile Result */}
            {!loading && results.length > 0 && results[0]?.username && (
              <div className="results-section">
                {results.map((profile: any, idx: number) => (
                  <div key={idx} style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, maxWidth: 500 }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                      {profile.avatar ? (
                        <img src={profile.avatar} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "3px solid #E60023" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #E60023, #BD081C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>📌</div>
                      )}
                      <div>
                        <h2 style={{ margin: 0, fontSize: 20, color: "#F1F5F9" }}>{profile.name || profile.username}</h2>
                        <p style={{ margin: 0, fontSize: 14, color: "#E60023" }}>@{profile.username}</p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: "flex", gap: 24, padding: "12px 16px", background: "rgba(15,23,42,0.8)", borderRadius: 10, marginBottom: 14, justifyContent: "center" }}>
                      {profile.followers && (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9" }}>{profile.followers}</div>
                          <div style={{ fontSize: 11, color: "#64748B" }}>Followers</div>
                        </div>
                      )}
                      {profile.following && (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9" }}>{profile.following}</div>
                          <div style={{ fontSize: 11, color: "#64748B" }}>Following</div>
                        </div>
                      )}
                      {profile.boards_count != null && (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9" }}>{profile.boards_count}</div>
                          <div style={{ fontSize: 11, color: "#64748B" }}>Boards</div>
                        </div>
                      )}
                    </div>

                    {/* Bio */}
                    {profile.bio && profile.bio !== "Log in" && (
                      <div style={{ padding: "10px 14px", background: "rgba(15,23,42,0.8)", borderRadius: 8, marginBottom: 14, borderLeft: "3px solid #E60023" }}>
                        <p style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{profile.bio}</p>
                      </div>
                    )}

                    {/* Website */}
                    {profile.website && (
                      <div style={{ marginBottom: 14 }}>
                        <span style={{ fontSize: 12, color: "#64748B" }}>🌐 </span>
                        <a href={profile.website} target="_blank" style={{ fontSize: 13, color: "#3B82F6", textDecoration: "none" }}>{profile.website}</a>
                      </div>
                    )}

                    {/* Profile link */}
                    <a href={profile.profile_url} target="_blank" style={{
                      display: "inline-block", padding: "8px 18px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                      background: "rgba(220,38,38,0.15)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)", textDecoration: "none",
                    }}>📌 Xem trên Pinterest</a>

                    {/* Boards */}
                    {profile.boards && profile.boards.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <h3 style={{ fontSize: 15, color: "#E60023", marginBottom: 10 }}>📋 Boards ({profile.boards.length})</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                          {profile.boards.map((board: any, bi: number) => (
                            <a key={bi} href={board.url} target="_blank" style={{
                              background: "rgba(15,23,42,0.8)", borderRadius: 10, overflow: "hidden", textDecoration: "none",
                              border: "1px solid rgba(255,255,255,0.06)", transition: "border-color 0.2s",
                            }}>
                              {board.thumbnail && <img src={board.thumbnail} alt="" style={{ width: "100%", height: 80, objectFit: "cover" }} />}
                              <div style={{ padding: "6px 10px", fontSize: 12, color: "#CBD5E1", fontWeight: 600 }}>{board.name}</div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button onClick={() => exportJSON(results, "profile")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ JSON</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== HISTORY TAB ===== */}
      {tab === "history" && (
        <div className="results-section">
          <h2>Lịch sử quét ({history.length})</h2>

          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input value={histSearch} onChange={e => { setHistSearch(e.target.value); setHistPage(1); }}
              placeholder="🔍 Tìm theo keyword, URL..." style={{ flex: 1, minWidth: 180, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#F1F5F9", fontSize: 13, outline: "none" }} />
            <select value={histTypeFilter} onChange={e => { setHistTypeFilter(e.target.value); setHistPage(1); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#CBD5E1", fontSize: 13 }}>
              <option value="">Tất cả loại</option>
              <option value="pins">pins</option>
              <option value="profile">profile</option>
            </select>
            <select value={histStatusFilter} onChange={e => { setHistStatusFilter(e.target.value); setHistPage(1); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#CBD5E1", fontSize: 13 }}>
              <option value="">Tất cả trạng thái</option>
              <option value="success">✅ Success</option>
              <option value="error">❌ Error</option>
              <option value="pending">⏳ Pending</option>
            </select>
            {(histSearch || histTypeFilter || histStatusFilter) && (
              <button onClick={() => { setHistSearch(""); setHistTypeFilter(""); setHistStatusFilter(""); setHistPage(1); }}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#f87171", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                ✕ Xóa bộ lọc
              </button>
            )}
          </div>

          {(() => {
            const filtered = history.filter(t => {
              if (histStatusFilter && t.status !== histStatusFilter) return false;
              if (histTypeFilter && t.scan_type !== histTypeFilter) return false;
              if (histSearch) {
                const s = histSearch.toLowerCase();
                const input = (t.input?.keyword || t.input?.profile_url || "").toLowerCase();
                if (!input.includes(s) && !(t.scan_type || "").toLowerCase().includes(s)) return false;
              }
              return true;
            });
            const pagedFiltered = paginate(filtered, histPage, 10);
            return (
              <>
          <table className="result-table">
            <thead><tr><th>#</th><th>Loại</th><th>Input</th><th>Status</th><th>Kết quả</th><th>Thời gian</th><th></th></tr></thead>
            <tbody>
              {pagedFiltered.map((task: any, i: number) => (
                <tr key={task._id}>
                  <td>{(histPage - 1) * 10 + i + 1}</td>
                  <td><span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "rgba(220,38,38,0.12)", color: "#fca5a5" }}>{task.scan_type}</span></td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.input?.keyword || task.input?.profile_url || "—"}</td>
                  <td>
                    <span style={{
                      padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: task.status === "success" ? "rgba(34,197,94,0.15)" : task.status === "error" ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.15)",
                      color: task.status === "success" ? "#4ade80" : task.status === "error" ? "#f87171" : "#fbbf24",
                    }}>
                      {task.status === "success" ? "✅" : task.status === "error" ? "❌" : "⏳"} {task.status}
                    </span>
                  </td>
                  <td>{Array.isArray(task.result) ? task.result.length : task.result ? 1 : 0} mục</td>
                  <td style={{ fontSize: 12, color: "#64748B" }}>{new Date(task.createdAt).toLocaleString()}</td>
                  <td>
                    {task.status === "success" && task.result && (
                      <button onClick={() => { setResults(Array.isArray(task.result) ? task.result : [task.result]); setPage(1); setTab("pins"); setTaskStatus("success"); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.1)", color: "#f87171", cursor: "pointer", fontSize: 12 }}>
                        👁 Xem
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar current={histPage} total={totalPages(filtered, 10)} totalItems={filtered.length} onChange={setHistPage} ps={10} />
              </>
            );
          })()}
        </div>
      )}

      {/* ===== DETAIL MODAL ===== */}
      {selectedRow && (
        <div onClick={() => setSelectedRow(null)} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#1E293B", borderRadius: 16, padding: 0, maxWidth: 550, width: "90%",
            maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(148,163,184,0.15)",
          }}>
            {/* Image */}
            {selectedRow.image && (
              <img src={selectedRow.image} alt="" style={{ width: "100%", display: "block", borderRadius: "16px 16px 0 0" }} />
            )}
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 18, color: "#F1F5F9" }}>{selectedRow.title || "Pin"}</h2>
                <button onClick={() => setSelectedRow(null)} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>

              {selectedRow.description && (
                <p style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 1.6, marginBottom: 12 }}>{selectedRow.description}</p>
              )}

              {selectedRow.creator && (
                <div style={{ marginBottom: 12, fontSize: 14 }}>
                  <span style={{ color: "#64748B" }}>Creator: </span>
                  {selectedRow.creator_link ? <a href={selectedRow.creator_link} target="_blank" style={{ color: "#E60023", fontWeight: 600 }}>{selectedRow.creator}</a> : <span style={{ color: "#F1F5F9", fontWeight: 600 }}>{selectedRow.creator}</span>}
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {selectedRow.pin_link && <a href={selectedRow.pin_link} target="_blank" style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, background: "rgba(220,38,38,0.15)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)", textDecoration: "none" }}>📌 Xem trên Pinterest</a>}
                {selectedRow.external_link && <a href={selectedRow.external_link} target="_blank" style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, background: "rgba(59,130,246,0.15)", color: "#93C5FD", border: "1px solid rgba(59,130,246,0.3)", textDecoration: "none" }}>🔗 External Link</a>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
