"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
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
function exportCSV(results: any[], st: string) {
  if (!results.length) return;
  const headers = Object.keys(results[0]).filter(k => typeof results[0][k] !== "object");
  const rows = results.map(item => headers.map(h => `"${String(item[h] ?? "").replace(/"/g, '""')}"`));
  dl(headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n"), `twitter-${st}-${Date.now()}.csv`, "text/csv;charset=utf-8");
}
function exportJSON(results: any[], st: string) {
  dl(JSON.stringify(results, null, 2), `twitter-${st}-${Date.now()}.json`, "application/json");
}

const TABS = [
  { key: "posts", label: "📝 Bài viết", scanType: "posts" },
  { key: "users", label: "👤 Tài khoản", scanType: "users" },
  { key: "replies", label: "💬 Replies", scanType: "replies" },
  { key: "history", label: "📜 Lịch sử", scanType: "" },
];

export default function TwitterToolPage() {
  const params = useParams();
  const tab = (params.tab as string) || "posts";
  const currentTab = TABS.find(t => t.key === tab) || TABS[0];
  const scanType = currentTab.scanType;

  // Form
  const [keyword, setKeyword] = useState("");
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState("latest");
  const [tweetUrl, setTweetUrl] = useState("");

  // UI
  const [loading, setLoading] = useState(false);
  const [taskStatus, setTaskStatus] = useState<"idle" | "pending" | "running" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [histPage, setHistPage] = useState(1);
  const [histScanType, setHistScanType] = useState("");
  const histPerPage = 10;
  const histResultRef = useRef<HTMLDivElement>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };

  const startPolling = useCallback((st: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/twitter/task/latest?scan_type=${st}`);
        if (!res.ok) return;
        const json = await res.json();
        const task = json?.data;
        if (!task) return;
        if (task.status === "running") setTaskStatus("running");
        else if (task.status === "success") {
          stopPolling(); setTaskStatus("success"); setResults(task.result || []); setLoading(false); setPage(1);
        } else if (task.status === "error") {
          stopPolling(); setTaskStatus("error"); setErrorMsg(task.error_message || "Task bị lỗi"); setLoading(false);
          if (task.result?.length) setResults(task.result);
        }
      } catch { /* ignore */ }
    }, 3000);
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/twitter/tasks?limit=100`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setHistory(json.data || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (tab === "history") {
      stopPolling(); setResults([]); setTaskStatus("idle"); setHistPage(1);
      fetchHistory();
      return;
    }
    stopPolling(); setResults([]); setTaskStatus("idle"); setErrorMsg(""); setPage(1);
    (async () => {
      try {
        const latestRes = await fetch(`${API}/twitter/task/latest?scan_type=${scanType}`);
        if (latestRes.ok) {
          const lj = await latestRes.json();
          const task = lj?.data;
          if (task) {
            if (task.status === "pending" || task.status === "running") {
              setTaskStatus(task.status); setLoading(true); startPolling(scanType); return;
            } else if (task.status === "error") {
              setTaskStatus("error"); setErrorMsg(task.error_message || "Task bị lỗi");
              if (task.result?.length) setResults(task.result);
            }
          }
        }
        const res = await fetch(`${API}/twitter/task/latest?scan_type=${scanType}&status=success`);
        if (res.ok) {
          const json = await res.json();
          if (json?.data?.result?.length) { setTaskStatus("success"); setResults(json.data.result); }
        }
      } catch { /* ignore */ }
    })();
    return () => stopPolling();
  }, [tab, scanType, startPolling, fetchHistory]);

  // ===== SUBMIT =====
  const handleScan = async () => {
    if (loading) return;
    let body: any = { scan_type: scanType, scan_account: "tool_bot_01" };
    switch (scanType) {
      case "posts":
        if (!keyword.trim()) { setErrorMsg("Vui lòng nhập keyword"); return; }
        body.keyword = keyword; body.limit = limit; body.sort_by = sortBy;
        break;
      case "users":
        if (!keyword.trim()) { setErrorMsg("Vui lòng nhập keyword"); return; }
        body.keyword = keyword; body.limit = limit;
        break;
      case "replies":
        if (!tweetUrl.trim()) { setErrorMsg("Vui lòng nhập URL tweet"); return; }
        body.tweet_url = tweetUrl; body.limit = limit;
        break;
    }
    try {
      stopPolling(); setLoading(true); setResults([]); setTaskStatus("pending"); setErrorMsg("");
      const res = await fetch(`${API}/twitter/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) { setTaskStatus("error"); setErrorMsg(data.message); setLoading(false); return; }
      setTaskStatus("running"); startPolling(scanType);
    } catch (err: any) {
      setTaskStatus("error"); setErrorMsg(err?.message || "Lỗi"); setLoading(false);
    }
  };

  const fmt = (n: any) => n != null && n !== "" ? Number(n).toLocaleString() : "—";
  const paginate = (data: any[], pg: number) => data.slice((pg - 1) * pageSize, pg * pageSize);
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const pagedResults = paginate(results, page);

  const PaginationBar = () => {
    if (results.length <= 0) return null;
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, results.length);
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "#94A3B8" }}>
        <span>{start}–{end} / {results.length}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ background: "#1E293B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "3px 8px", color: "#CBD5E1", fontSize: 12 }}>
            {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}/trang</option>)}
          </select>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ background: page <= 1 ? "transparent" : "rgba(29,155,240,0.1)", border: "1px solid rgba(29,155,240,0.2)", borderRadius: 6, padding: "3px 10px", color: page <= 1 ? "#475569" : "#1D9BF0", cursor: page <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
          <span style={{ minWidth: 60, textAlign: "center" }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ background: page >= totalPages ? "transparent" : "rgba(29,155,240,0.1)", border: "1px solid rgba(29,155,240,0.2)", borderRadius: 6, padding: "3px 10px", color: page >= totalPages ? "#475569" : "#1D9BF0", cursor: page >= totalPages ? "default" : "pointer", fontSize: 12 }}>▶</button>
        </div>
      </div>
    );
  };

  const StatusBadge = () => {
    if (taskStatus === "idle") return null;
    const cfg = {
      pending: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "rgba(251,191,36,0.3)", text: "⏳ Đang chờ worker..." },
      running: { bg: "rgba(29,155,240,0.15)", color: "#1D9BF0", border: "rgba(29,155,240,0.3)", text: "🔄 Đang quét..." },
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

  // ===== Tweet card component =====
  const TweetCard = ({ item }: { item: any }) => (
    <div onClick={() => setSelectedRow(item)} style={{
      background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16,
      cursor: "pointer", transition: "all 0.2s",
    }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(29,155,240,0.3)"; }}
       onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}>
      {/* Author row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {item.author_avatar ? (
          <img src={item.author_avatar} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(29,155,240,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🐦</div>
        )}
        <div style={{ overflow: "hidden" }}>
          <div style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 14 }}>{item.author_name || "—"}</div>
          <div style={{ fontSize: 12, color: "#1D9BF0" }}>{item.author_username || "—"}</div>
        </div>
        {item.timestamp && <div style={{ marginLeft: "auto", fontSize: 11, color: "#64748B" }}>{new Date(item.timestamp).toLocaleDateString()}</div>}
      </div>
      {/* Text */}
      <p style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 1.5, margin: "0 0 10px", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.text || "—"}</p>
      {/* Stats */}
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#64748B" }}>
        <span>💬 {fmt(item.replies_count)}</span>
        <span style={{ color: "#22c55e" }}>🔄 {fmt(item.retweets)}</span>
        <span style={{ color: "#f87171" }}>❤️ {fmt(item.likes)}</span>
        {item.views != null && item.views !== 0 && <span>👁 {fmt(item.views)}</span>}
      </div>
    </div>
  );

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h1>🐦 X (Twitter) Crawler</h1>
        <p>Quét bài viết, tài khoản và replies từ X.com</p>
      </div>

      {/* Tabs */}
      <div className="tool-tabs">
        {TABS.map(t => (
          <Link key={t.key} href={`/tools/twitter/${t.key}`} className={`tool-tab ${tab === t.key ? "active" : ""}`} style={tab === t.key ? { background: "linear-gradient(135deg, #1D9BF0, #0E71C8)" } : {}}>
            {t.label}
          </Link>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>

      {/* ===== HISTORY TAB ===== */}
      {tab === "history" && (
        <div>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "#F1F5F9" }}>📜 Lịch sử quét — {history.length} tasks</h2>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#64748B" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
              <p>Chưa có lịch sử quét nào</p>
            </div>
          ) : (
            <>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px", fontSize: 14 }}>
                <thead>
                  <tr style={{ fontSize: 12, color: "#64748B", textTransform: "uppercase" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Loại</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Input</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Trạng thái</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Kết quả</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Thời gian</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice((histPage - 1) * histPerPage, histPage * histPerPage).map((task: any) => (
                    <tr key={task._id} style={{ background: "rgba(15,23,42,0.5)" }}>
                      <td style={{ padding: "10px 12px", borderRadius: "8px 0 0 8px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: "rgba(29,155,240,0.15)", color: "#1D9BF0", border: "1px solid rgba(29,155,240,0.2)" }}>
                          {task.scan_type}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#CBD5E1", fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.input?.keyword || task.input?.tweet_url || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                          background: task.status === "success" ? "rgba(34,197,94,0.15)" : task.status === "error" ? "rgba(239,68,68,0.15)" : task.status === "running" ? "rgba(29,155,240,0.15)" : "rgba(251,191,36,0.15)",
                          color: task.status === "success" ? "#4ade80" : task.status === "error" ? "#f87171" : task.status === "running" ? "#1D9BF0" : "#fbbf24",
                        }}>
                          {task.status === "success" ? "✅" : task.status === "error" ? "❌" : task.status === "running" ? "🔄" : "⏳"} {task.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", color: "#94A3B8" }}>
                        {Array.isArray(task.result) ? task.result.length : task.result ? 1 : 0} mục
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#64748B" }}>{new Date(task.createdAt).toLocaleString()}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center", borderRadius: "0 8px 8px 0" }}>
                        {task.result && (Array.isArray(task.result) ? task.result.length > 0 : true) && (
                          <button onClick={() => { setResults(Array.isArray(task.result) ? task.result : [task.result]); setPage(1); setTaskStatus("success"); setHistScanType(task.scan_type || ""); setTimeout(() => histResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(29,155,240,0.3)", background: "rgba(29,155,240,0.1)", color: "#1D9BF0", cursor: "pointer", fontSize: 12 }}>
                            👁 Xem
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* History pagination */}
              {history.length > histPerPage && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 13, color: "#94A3B8" }}>
                  <span>{(histPage - 1) * histPerPage + 1}–{Math.min(histPage * histPerPage, history.length)} / {history.length}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button disabled={histPage <= 1} onClick={() => setHistPage(p => p - 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(29,155,240,0.2)", background: histPage <= 1 ? "transparent" : "rgba(29,155,240,0.1)", color: histPage <= 1 ? "#475569" : "#1D9BF0", cursor: histPage <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
                    <span>{histPage} / {Math.ceil(history.length / histPerPage)}</span>
                    <button disabled={histPage >= Math.ceil(history.length / histPerPage)} onClick={() => setHistPage(p => p + 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(29,155,240,0.2)", background: histPage >= Math.ceil(history.length / histPerPage) ? "transparent" : "rgba(29,155,240,0.1)", color: histPage >= Math.ceil(history.length / histPerPage) ? "#475569" : "#1D9BF0", cursor: histPage >= Math.ceil(history.length / histPerPage) ? "default" : "pointer", fontSize: 12 }}>▶</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Show results below if user clicked Xem */}
          {results.length > 0 && (
            <div ref={histResultRef} style={{ marginTop: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ margin: 0 }}>Kết quả: {results.length} mục</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => exportCSV(results, "history")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ CSV</button>
                  <button onClick={() => exportJSON(results, "history")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ JSON</button>
                  <button onClick={() => { setResults([]); setTaskStatus("idle"); }} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94A3B8", cursor: "pointer", fontSize: 12 }}>✕ Đóng</button>
                </div>
              </div>
              {/* Render based on scan type */}
              {histScanType === "users" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                  {pagedResults.map((u: any, i: number) => (
                    <div key={u.username || i} onClick={() => setSelectedRow(u)} style={{
                      background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16,
                      cursor: "pointer", transition: "all 0.2s",
                    }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(29,155,240,0.3)"; }}
                       onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(29,155,240,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
                        )}
                        <div style={{ overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 14 }}>{u.display_name || "—"}</span>
                            {u.verified && <span title="Verified" style={{ fontSize: 14 }}>✅</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "#1D9BF0" }}>{u.username || "—"}</div>
                        </div>
                      </div>
                      {u.bio && <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.4, margin: "0 0 8px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{u.bio}</p>}
                      <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                        <span><strong style={{ color: "#F1F5F9" }}>{fmt(u.followers)}</strong> <span style={{ color: "#64748B" }}>followers</span></span>
                        <span><strong style={{ color: "#F1F5F9" }}>{fmt(u.following)}</strong> <span style={{ color: "#64748B" }}>following</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {pagedResults.map((item: any, i: number) => <TweetCard key={item.url || i} item={item} />)}
                </div>
              )}
              <PaginationBar />
            </div>
          )}
        </div>
      )}

      {/* 2-col layout */}
      {tab !== "history" && (
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 24, alignItems: "start" }}>
        {/* LEFT: Form */}
        <div className="tool-form" style={{ position: "sticky", top: 80 }}>
          {/* POSTS */}
          {tab === "posts" && (
            <>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#F1F5F9" }}>Quét bài viết theo keyword</h3>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>Tìm tweets mới nhất hoặc phổ biến nhất</p>
              <div className="form-group">
                <label>Keyword <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="VD: AI, blockchain, football" onKeyDown={e => e.key === "Enter" && handleScan()} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Số lượng</label>
                  <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} min={1} max={200} />
                </div>
                <div className="form-group">
                  <label>Sắp xếp</label>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                    <option value="latest">Mới nhất</option>
                    <option value="top">Phổ biến nhất</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* USERS */}
          {tab === "users" && (
            <>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#F1F5F9" }}>Quét tài khoản theo keyword</h3>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>Tìm người dùng X theo ngành/lĩnh vực</p>
              <div className="form-group">
                <label>Keyword <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="VD: developer, marketing, influencer" onKeyDown={e => e.key === "Enter" && handleScan()} />
              </div>
              <div className="form-group">
                <label>Số lượng</label>
                <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} min={1} max={200} />
              </div>
            </>
          )}

          {/* REPLIES */}
          {tab === "replies" && (
            <>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#F1F5F9" }}>Quét replies (bình luận)</h3>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>Lấy tất cả replies trên 1 tweet</p>
              <div className="form-group">
                <label>URL Tweet <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={tweetUrl} onChange={e => setTweetUrl(e.target.value)} placeholder="https://x.com/username/status/123456" onKeyDown={e => e.key === "Enter" && handleScan()} />
              </div>
              <div className="form-group">
                <label>Số replies</label>
                <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} min={1} max={500} />
              </div>
            </>
          )}

          <button className="btn-submit" onClick={handleScan} disabled={loading}>
            {loading ? (taskStatus === "pending" ? "⏳ Đang chờ..." : "🔄 Đang quét...") : "🔍 Bắt đầu quét"}
          </button>
          {errorMsg && taskStatus !== "error" && <p style={{ marginTop: 8, fontSize: 13, color: "#f87171" }}>⚠️ {errorMsg}</p>}
        </div>

        {/* RIGHT: Results */}
        <div>
          <StatusBadge />

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 12, color: "#94A3B8" }}>
              <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.1)", borderTop: "3px solid #1D9BF0", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p>Tự động cập nhật mỗi 3 giây...</p>
            </div>
          )}

          {!loading && results.length === 0 && taskStatus !== "error" && (
            <div style={{ textAlign: "center", padding: "3rem", color: "#64748B" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🐦</div>
              <p>Nhập thông tin và bấm &quot;Bắt đầu quét&quot;</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="results-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ margin: 0 }}>Kết quả: {results.length} mục</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => exportCSV(results, scanType)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ CSV</button>
                  <button onClick={() => exportJSON(results, scanType)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ JSON</button>
                </div>
              </div>

              {/* ===== POSTS — Tweet cards ===== */}
              {scanType === "posts" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {pagedResults.map((item: any, i: number) => <TweetCard key={item.url || i} item={item} />)}
                </div>
              )}

              {/* ===== USERS — Cards grid ===== */}
              {scanType === "users" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                  {pagedResults.map((u: any, i: number) => (
                    <div key={u.username || i} onClick={() => setSelectedRow(u)} style={{
                      background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16,
                      cursor: "pointer", transition: "all 0.2s",
                    }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(29,155,240,0.3)"; }}
                       onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(29,155,240,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
                        )}
                        <div style={{ overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 14 }}>{u.display_name || "—"}</span>
                            {u.verified && <span title="Verified" style={{ fontSize: 14 }}>✅</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "#1D9BF0" }}>{u.username || "—"}</div>
                        </div>
                      </div>
                      {u.bio && (
                        <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.4, margin: "0 0 8px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{u.bio}</p>
                      )}
                      <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                        <span><strong style={{ color: "#F1F5F9" }}>{fmt(u.followers)}</strong> <span style={{ color: "#64748B" }}>followers</span></span>
                        <span><strong style={{ color: "#F1F5F9" }}>{fmt(u.following)}</strong> <span style={{ color: "#64748B" }}>following</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ===== REPLIES — Tweet-like cards ===== */}
              {scanType === "replies" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {pagedResults.map((item: any, i: number) => <TweetCard key={item.url || i} item={item} />)}
                </div>
              )}

              <PaginationBar />
            </div>
          )}
        </div>
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
            background: "#1E293B", borderRadius: 16, padding: 28, maxWidth: 600, width: "90%",
            maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(148,163,184,0.15)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#F1F5F9" }}>Chi tiết</h2>
              <button onClick={() => setSelectedRow(null)} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Author section */}
            {(selectedRow.author_name || selectedRow.display_name) && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: 12, background: "rgba(15,23,42,0.5)", borderRadius: 10 }}>
                {(selectedRow.author_avatar || selectedRow.avatar_url) ? (
                  <img src={selectedRow.author_avatar || selectedRow.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(29,155,240,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🐦</div>
                )}
                <div>
                  <div style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 16 }}>{selectedRow.author_name || selectedRow.display_name || "—"} {selectedRow.verified && "✅"}</div>
                  <div style={{ fontSize: 13, color: "#1D9BF0" }}>{selectedRow.author_username || selectedRow.username || "—"}</div>
                </div>
                {(selectedRow.url || selectedRow.profile_url) && (
                  <a href={selectedRow.url || selectedRow.profile_url} target="_blank" style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "rgba(29,155,240,0.15)", color: "#1D9BF0", border: "1px solid rgba(29,155,240,0.3)", textDecoration: "none" }}>🔗 Xem trên X</a>
                )}
              </div>
            )}

            {/* Text / Bio */}
            {(selectedRow.text || selectedRow.bio) && (
              <div style={{ padding: 12, background: "rgba(15,23,42,0.5)", borderRadius: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>{selectedRow.text ? "Nội dung" : "Bio"}</div>
                <p style={{ margin: 0, fontSize: 14, color: "#CBD5E1", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selectedRow.text || selectedRow.bio}</p>
              </div>
            )}

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
              {Object.entries(selectedRow)
                .filter(([k, v]) => !["author_name", "author_username", "author_avatar", "avatar_url", "text", "bio", "url", "profile_url", "verified"].includes(k) && (typeof v === "number" || typeof v === "string"))
                .map(([key, val]) => (
                  <div key={key} style={{ padding: "8px 12px", background: "rgba(15,23,42,0.5)", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>{key}</div>
                    <div style={{ fontSize: 13, color: "#CBD5E1", wordBreak: "break-all" }}>
                      {typeof val === "string" && (val as string).startsWith("http") ? <a href={val as string} target="_blank" style={{ color: "#1D9BF0" }}>{val as string}</a> : String(val ?? "—")}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
