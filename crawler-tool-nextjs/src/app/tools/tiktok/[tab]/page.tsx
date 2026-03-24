"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";

const API = "/api/proxy";

// ===== EXPORT HELPERS =====
function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(results: any[], scanType: string) {
  if (!results.length) return;
  const headers = Object.keys(results[0]).filter(k => typeof results[0][k] !== "object");
  const rows = results.map((item: any) =>
    headers.map(h => `"${String(item[h] ?? "").replace(/"/g, '""')}"`)
  );
  const csv = headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
  downloadFile(csv, `tiktok-${scanType}-${Date.now()}.csv`, "text/csv;charset=utf-8");
}

function exportJSON(results: any[], scanType: string) {
  downloadFile(JSON.stringify(results, null, 2), `tiktok-${scanType}-${Date.now()}.json`, "application/json");
}

const TABS = [
  { key: "top_posts", label: "🔥 Top bài viết", scanType: "top_posts" },
  { key: "accounts", label: "👤 Tài khoản", scanType: "users" },
  { key: "video_comments", label: "💬 Bình luận video", scanType: "video_comments" },
  { key: "friends", label: "🤝 Bạn bè", scanType: "relations" },
  { key: "history", label: "📜 Lịch sử", scanType: "" },
];

export default function TikTokToolPage() {
  const params = useParams();
  const tab = (params.tab as string) || "top_posts";
  const currentTab = TABS.find(t => t.key === tab) || TABS[0];
  const scanType = currentTab.scanType;

  // Form states per tab
  const [keyword, setKeyword] = useState("");
  const [limit, setLimit] = useState(20);
  const [deepScan, setDeepScan] = useState(true);
  const [videoUrl, setVideoUrl] = useState("");
  const [commentLimit, setCommentLimit] = useState(50);
  const [targetUsername, setTargetUsername] = useState("");
  const [followersLimit, setFollowersLimit] = useState(50);

  // UI
  const [loading, setLoading] = useState(false);
  const [taskStatus, setTaskStatus] = useState<"idle" | "pending" | "running" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [histPage, setHistPage] = useState(1);
  const [histScanType, setHistScanType] = useState("");
  const [histSearch, setHistSearch] = useState("");
  const [histStatusFilter, setHistStatusFilter] = useState("");
  const [histTypeFilter, setHistTypeFilter] = useState("");
  const histPerPage = 10;
  const histResultRef = useRef<HTMLDivElement>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };

  // ===== POLLING =====
  const startPolling = useCallback((st: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/tiktok/task/latest?scan_type=${st}`);
        if (!res.ok) return;
        const json = await res.json();
        const task = json?.data;
        if (!task) return;

        if (task.status === "running") {
          setTaskStatus("running");
        } else if (task.status === "success") {
          stopPolling();
          setTaskStatus("success");
          setResults(st === "relations" ? (task.result?.friends_detail || []) : (task.result || []));
          setLoading(false);
          setPage(1);
        } else if (task.status === "error") {
          stopPolling();
          setTaskStatus("error");
          setErrorMsg(task.error_message || "Task bị lỗi");
          if (task.result) setResults(Array.isArray(task.result) ? task.result : []);
          setLoading(false);
        }
      } catch { /* ignore */ }
    }, 3000);
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/tiktok/tasks?limit=100`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setHistory(json.data || []);
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch latest on tab change
  useEffect(() => {
    if (tab === "history") {
      stopPolling(); setResults([]); setTaskStatus("idle"); setHistPage(1);
      fetchHistory();
      return;
    }
    stopPolling();
    setResults([]);
    setTaskStatus("idle");
    setErrorMsg("");
    setPage(1);

    (async () => {
      try {
        // Check if there's a running/pending task
        const latestRes = await fetch(`${API}/tiktok/task/latest?scan_type=${scanType}`);
        if (latestRes.ok) {
          const latestJson = await latestRes.json();
          const task = latestJson?.data;
          if (task) {
            if (task.status === "pending" || task.status === "running") {
              setTaskStatus(task.status);
              setLoading(true);
              startPolling(scanType);
              return;
            } else if (task.status === "error") {
              setTaskStatus("error");
              setErrorMsg(task.error_message || "Task bị lỗi");
            }
          }
        }

        // Fetch latest success
        const res = await fetch(`${API}/tiktok/task/latest?scan_type=${scanType}&status=success`);
        if (res.ok) {
          const json = await res.json();
          if (json?.data?.result) {
            setTaskStatus("success");
            setResults(scanType === "relations" ? (json.data.result.friends_detail || []) : (json.data.result || []));
          }
        }
      } catch { /* ignore */ }
    })();

    return () => stopPolling();
  }, [scanType, startPolling, fetchHistory]);

  // ===== SUBMIT =====
  const handleScan = async () => {
    if (loading) return;
    let body: any = { scan_type: scanType, scan_account: "tool_bot_01" };

    switch (scanType) {
      case "top_posts":
        if (!keyword.trim()) { setErrorMsg("Vui lòng nhập keyword"); return; }
        body.keyword = keyword;
        body.limit = limit;
        body.deep_scan = deepScan;
        body.sort_by = "engagement";
        body.delay_range = [2000, 4000];
        body.batch_size = 10;
        body.batch_delay = 8000;
        break;
      case "users":
        if (!keyword.trim()) { setErrorMsg("Vui lòng nhập keyword"); return; }
        body.keyword = keyword;
        body.limit = limit;
        body.deep_scan = deepScan;
        body.delay_range = [2500, 5000];
        body.batch_size = 5;
        body.batch_delay = 8000;
        break;
      case "video_comments":
        if (!videoUrl.trim()) { setErrorMsg("Vui lòng nhập URL video"); return; }
        body.video_url = videoUrl;
        body.limit_comments = commentLimit;
        body.deep_scan_profile = deepScan;
        body.delay_range = [2000, 4000];
        body.batch_size = 20;
        body.batch_delay = 10000;
        break;
      case "relations":
        if (!targetUsername.trim()) { setErrorMsg("Vui lòng nhập username"); return; }
        body.target_username = targetUsername;
        body.followers_limit = 1000;
        body.following_limit = 1000;
        body.friends_limit = followersLimit;
        body.calculate_friends = true;
        body.delay_range = [3000, 6000];
        body.batch_size = 10;
        body.batch_delay = 12000;
        break;
    }

    try {
      stopPolling();
      setLoading(true);
      setResults([]);
      setTaskStatus("pending");
      setErrorMsg("");

      const res = await fetch(`${API}/tiktok/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) { setTaskStatus("error"); setErrorMsg(data.message); setLoading(false); return; }

      setTaskStatus("running");
      startPolling(scanType);
    } catch (err: any) {
      setTaskStatus("error");
      setErrorMsg(err?.message || "Không thể tạo task");
      setLoading(false);
    }
  };

  // Pagination
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
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ background: page <= 1 ? "transparent" : "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, padding: "3px 10px", color: page <= 1 ? "#475569" : "#60a5fa", cursor: page <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
          <span style={{ minWidth: 60, textAlign: "center" }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ background: page >= totalPages ? "transparent" : "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, padding: "3px 10px", color: page >= totalPages ? "#475569" : "#60a5fa", cursor: page >= totalPages ? "default" : "pointer", fontSize: 12 }}>▶</button>
        </div>
      </div>
    );
  };

  // ===== STATUS BADGE =====
  const StatusBadge = () => {
    if (taskStatus === "idle") return null;
    const cfg = {
      pending: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "rgba(251,191,36,0.3)", text: "⏳ Đang chờ worker xử lý..." },
      running: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "rgba(59,130,246,0.3)", text: "🔄 Đang cào dữ liệu..." },
      success: { bg: "rgba(34,197,94,0.15)", color: "#4ade80", border: "rgba(34,197,94,0.3)", text: `✅ Hoàn thành — ${results.length} kết quả` },
      error: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "rgba(239,68,68,0.3)", text: `❌ Lỗi: ${errorMsg}` },
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
        <h1>🎵 TikTok Crawler</h1>
        <p>Quét video, người dùng, comment và bạn bè từ TikTok</p>
      </div>

      {/* Tabs */}
      <div className="tool-tabs">
        {TABS.map((t) => (
          <Link key={t.key} href={`/tools/tiktok/${t.key}`} className={`tool-tab ${tab === t.key ? "active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>

      {/* ===== HISTORY TAB ===== */}
      {tab === "history" && (
        <div>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "#F1F5F9" }}>📜 Lịch sử quét — {history.length} tasks</h2>

          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={histSearch} onChange={e => { setHistSearch(e.target.value); setHistPage(1); }}
              placeholder="🔍 Tìm theo keyword, URL..."
              style={{ flex: 1, minWidth: 180, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#F1F5F9", fontSize: 13, outline: "none" }}
            />
            <select
              value={histTypeFilter} onChange={e => { setHistTypeFilter(e.target.value); setHistPage(1); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#CBD5E1", fontSize: 13 }}
            >
              <option value="">Tất cả loại</option>
              <option value="top_posts">top_posts</option>
              <option value="users">users</option>
              <option value="video_comments">video_comments</option>
              <option value="relations">relations</option>
            </select>
            <select
              value={histStatusFilter} onChange={e => { setHistStatusFilter(e.target.value); setHistPage(1); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#CBD5E1", fontSize: 13 }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="success">✅ Success</option>
              <option value="error">❌ Error</option>
              <option value="running">🔄 Running</option>
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
                const input = (t.input?.keyword || t.input?.video_url || t.input?.target_username || "").toLowerCase();
                if (!input.includes(s) && !(t.scan_type || "").toLowerCase().includes(s)) return false;
              }
              return true;
            });
            const totalHistPages = Math.max(1, Math.ceil(filtered.length / histPerPage));
            return filtered.length === 0 ? (
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
              {filtered.slice((histPage - 1) * histPerPage, histPage * histPerPage).map((task: any) => (
                    <tr key={task._id} style={{ background: "rgba(15,23,42,0.5)" }}>
                      <td style={{ padding: "10px 12px", borderRadius: "8px 0 0 8px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: "rgba(139,92,246,0.15)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.2)" }}>
                          {task.scan_type}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#CBD5E1", fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.input?.keyword || task.input?.video_url || task.input?.target_username || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                          background: task.status === "success" ? "rgba(34,197,94,0.15)" : task.status === "error" ? "rgba(239,68,68,0.15)" : task.status === "running" ? "rgba(59,130,246,0.15)" : "rgba(251,191,36,0.15)",
                          color: task.status === "success" ? "#4ade80" : task.status === "error" ? "#f87171" : task.status === "running" ? "#60a5fa" : "#fbbf24",
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
                          <button onClick={() => {
                            const r = task.scan_type === "relations" ? (task.result?.friends_detail || []) : (Array.isArray(task.result) ? task.result : [task.result]);
                            setResults(r); setPage(1); setTaskStatus("success"); setHistScanType(task.scan_type || "");
                            setTimeout(() => histResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                          }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 12 }}>
                            👁 Xem
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* History pagination */}
              {filtered.length > histPerPage && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 13, color: "#94A3B8" }}>
                  <span>{(histPage - 1) * histPerPage + 1}–{Math.min(histPage * histPerPage, filtered.length)} / {filtered.length}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button disabled={histPage <= 1} onClick={() => setHistPage(p => p - 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.2)", background: histPage <= 1 ? "transparent" : "rgba(139,92,246,0.1)", color: histPage <= 1 ? "#475569" : "#A78BFA", cursor: histPage <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
                    <span>{histPage} / {totalHistPages}</span>
                    <button disabled={histPage >= totalHistPages} onClick={() => setHistPage(p => p + 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.2)", background: histPage >= totalHistPages ? "transparent" : "rgba(139,92,246,0.1)", color: histPage >= totalHistPages ? "#475569" : "#A78BFA", cursor: histPage >= totalHistPages ? "default" : "pointer", fontSize: 12 }}>▶</button>
                  </div>
                </div>
              )}
            </>
          );
          })()}

          {/* Show results below when user clicks Xem */}
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

              {/* Render table for any result type */}
              <table className="result-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {results.length > 0 && Object.keys(results[0]).filter(k => typeof results[0][k] !== "object").slice(0, 6).map(k => <th key={k}>{k}</th>)}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedResults.map((item: any, i: number) => (
                    <tr key={i}>
                      <td>{(page - 1) * pageSize + i + 1}</td>
                      {Object.keys(results[0]).filter(k => typeof results[0][k] !== "object").slice(0, 6).map(k => (
                        <td key={k} style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{String(item[k] ?? "—")}</td>
                      ))}
                      <td><button onClick={() => setSelectedRow(item)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 11 }}>👁</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationBar />
            </div>
          )}
        </div>
      )}

      {/* Two-column layout */}
      {tab !== "history" && (
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 24, alignItems: "start" }}>
        {/* LEFT: Form */}
        <div className="tool-form" style={{ position: "sticky", top: 80 }}>
          {/* TOP POSTS */}
          {tab === "top_posts" && (
            <>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#F1F5F9" }}>Quét top bài viết theo từ khóa</h3>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>Dựa trên lượt xem và tương tác cao nhất</p>
              <div className="form-group">
                <label>Keyword <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="VD: skincare, đồ ăn vặt, review" onKeyDown={e => e.key === "Enter" && handleScan()} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Số lượng</label>
                  <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} min={1} max={100} />
                </div>
                <div className="form-group">
                  <label>Quét sâu (lượt thích, comment)</label>
                  <select value={String(deepScan)} onChange={e => setDeepScan(e.target.value === "true")}>
                    <option value="true">Có</option>
                    <option value="false">Không</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* USERS */}
          {tab === "accounts" && (
            <>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#F1F5F9" }}>Quét tài khoản theo từ khóa</h3>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>Tìm KOL / creator theo ngành</p>
              <div className="form-group">
                <label>Keyword <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="VD: beauty blogger, fitness coach" onKeyDown={e => e.key === "Enter" && handleScan()} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Số lượng</label>
                  <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} min={1} max={100} />
                </div>
                <div className="form-group">
                  <label>Quét sâu profile</label>
                  <select value={String(deepScan)} onChange={e => setDeepScan(e.target.value === "true")}>
                    <option value="true">Có</option>
                    <option value="false">Không</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* VIDEO COMMENTS */}
          {tab === "video_comments" && (
            <>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#F1F5F9" }}>Quét bình luận video</h3>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>Lấy comment từ 1 video TikTok</p>
              <div className="form-group">
                <label>URL Video TikTok <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.tiktok.com/@user/video/123456" onKeyDown={e => e.key === "Enter" && handleScan()} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Số comment</label>
                  <input type="number" value={commentLimit} onChange={e => setCommentLimit(Number(e.target.value))} min={1} max={500} />
                </div>
                <div className="form-group">
                  <label>Quét profile commenter</label>
                  <select value={String(deepScan)} onChange={e => setDeepScan(e.target.value === "true")}>
                    <option value="true">Có</option>
                    <option value="false">Không</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* RELATIONS */}
          {tab === "friends" && (
            <>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#F1F5F9" }}>Quét bạn bè tài khoản</h3>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>Following + Follower → tìm bạn chung</p>
              <div className="form-group">
                <label>Username mục tiêu <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={targetUsername} onChange={e => setTargetUsername(e.target.value)} placeholder="VD: flowerknowsglobal (không cần @)" onKeyDown={e => e.key === "Enter" && handleScan()} />
              </div>
              <div className="form-group">
                <label>Số bạn bè muốn lấy</label>
                <input type="number" value={followersLimit} onChange={e => setFollowersLimit(Number(e.target.value))} min={1} max={1000} />
              </div>
            </>
          )}

          <button className="btn-submit" onClick={handleScan} disabled={loading}>
            {loading
              ? taskStatus === "pending" ? "⏳ Đang chờ worker..." : "🔄 Đang quét..."
              : "🔍 Bắt đầu quét"
            }
          </button>

          {errorMsg && taskStatus !== "error" && (
            <p style={{ marginTop: 8, fontSize: 13, color: "#f87171" }}>⚠️ {errorMsg}</p>
          )}
        </div>

        {/* RIGHT: Results */}
        <div>
          <StatusBadge />

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 12, color: "#94A3B8" }}>
              <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.1)", borderTop: "3px solid #3B82F6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p>Tự động cập nhật mỗi 3 giây...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
            </div>
          )}

          {/* Empty state */}
          {!loading && results.length === 0 && taskStatus !== "error" && (
            <div style={{ textAlign: "center", padding: "3rem", color: "#64748B" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎵</div>
              <p>Nhập thông tin bên trái và bấm &quot;Bắt đầu quét&quot;</p>
            </div>
          )}

          {/* Results */}
          {!loading && results.length > 0 && (
            <div className="results-section">
              {/* Header with export */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ margin: 0 }}>Kết quả: {results.length} mục</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => exportCSV(results, scanType)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ CSV</button>
                  <button onClick={() => exportJSON(results, scanType)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ JSON</button>
                </div>
              </div>

              {/* Dynamic table/cards based on scan type */}

              {/* ===== TOP POSTS — Card grid with thumbnails ===== */}
              {scanType === "top_posts" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                  {pagedResults.map((item: any, i: number) => (
                    <div key={i} onClick={() => setSelectedRow(item)} style={{
                      background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12,
                      overflow: "hidden", cursor: "pointer", transition: "all 0.2s",
                    }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                       onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
                      {/* Thumbnail */}
                      {item.thumbnail ? (
                        <div style={{ width: "100%", aspectRatio: "9/16", maxHeight: 280, overflow: "hidden", background: "#0F172A" }}>
                          <img src={item.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </div>
                      ) : (
                        <div style={{ width: "100%", height: 120, background: "linear-gradient(135deg, #1E293B, #0F172A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🎵</div>
                      )}
                      <div style={{ padding: "10px 12px" }}>
                        {/* Author */}
                        {item.author_username && (
                          <div style={{ fontSize: 12, color: "#8B5CF6", marginBottom: 4 }}>@{item.author_username}</div>
                        )}
                        {/* Caption */}
                        {item.caption && (
                          <div style={{ fontSize: 12, color: "#CBD5E1", marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>{item.caption}</div>
                        )}
                        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>#{(page - 1) * pageSize + i + 1} • {item.keyword || "—"}</div>
                        {/* Stats */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, marginBottom: 6 }}>
                          {item.view_count != null && <span title="Views">👁 {Number(item.view_count).toLocaleString()}</span>}
                          {item.like_count != null && <span title="Likes" style={{ color: "#f87171" }}>❤️ {Number(item.like_count).toLocaleString()}</span>}
                          {item.comment_count != null && <span title="Comments" style={{ color: "#60a5fa" }}>💬 {Number(item.comment_count).toLocaleString()}</span>}
                          {item.share_count != null && <span title="Shares" style={{ color: "#34d399" }}>↗️ {Number(item.share_count).toLocaleString()}</span>}
                          {item.view_count == null && item.like_count == null && <span style={{ color: "#475569", fontStyle: "italic" }}>Bật &quot;Quét sâu&quot; để xem stats</span>}
                        </div>
                        {item.video_url && (
                          <a href={item.video_url} target="_blank" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: "#3B82F6", textDecoration: "none" }}>🔗 Xem trên TikTok</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ===== USERS — Table with avatar ===== */}
              {scanType === "users" && (
                <table className="result-table">
                  <thead>
                    <tr><th>#</th><th></th><th>Username</th><th>Tên</th><th>Followers</th><th>Following</th><th>Bio</th><th></th></tr>
                  </thead>
                  <tbody>
                    {pagedResults.map((item: any, i: number) => (
                      <tr key={i}>
                        <td>{(page - 1) * pageSize + i + 1}</td>
                        <td>
                          {item.avatar ? (
                            <img src={item.avatar} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).src = ""; (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(139,92,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
                          )}
                        </td>
                        <td style={{ color: "#8B5CF6" }}>@{item.username || item.tiktok_id || "—"}</td>
                        <td style={{ fontWeight: 600, color: "#F1F5F9", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.display_name || "—"}</td>
                        <td>{(item.follower_count ?? 0).toLocaleString()}</td>
                        <td>{(item.following_count ?? 0).toLocaleString()}</td>
                        <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "#94A3B8" }}>{item.bio || "—"}</td>
                        <td><button onClick={() => setSelectedRow(item)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 11 }}>👁</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ===== VIDEO COMMENTS — Table ===== */}
              {scanType === "video_comments" && (
                <table className="result-table">
                  <thead>
                    <tr><th>#</th><th>Tên</th><th>Nội dung</th><th>Likes</th><th>Ngày</th><th></th></tr>
                  </thead>
                  <tbody>
                    {pagedResults.map((item: any, i: number) => (
                      <tr key={i}>
                        <td>{(page - 1) * pageSize + i + 1}</td>
                        <td style={{ color: "#8B5CF6", whiteSpace: "nowrap" }}>
                          {item.profile_url ? <a href={item.profile_url} target="_blank" style={{ color: "#8B5CF6", textDecoration: "none" }}>{item.display_name || "—"}</a> : (item.display_name || "—")}
                        </td>
                        <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#CBD5E1" }}>{item.comment || "—"}</td>
                        <td>{(item.likes ?? 0).toLocaleString()}</td>
                        <td style={{ fontSize: 12, color: "#64748B" }}>{item.date || "—"}</td>
                        <td><button onClick={() => setSelectedRow(item)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 11 }}>👁</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ===== RELATIONS — Table with avatar ===== */}
              {scanType === "relations" && (
                <table className="result-table">
                  <thead>
                    <tr><th>#</th><th></th><th>Username</th><th>Tên</th><th>Followers</th><th>Following</th><th>Bio</th><th></th></tr>
                  </thead>
                  <tbody>
                    {pagedResults.map((item: any, i: number) => (
                      <tr key={i}>
                        <td>{(page - 1) * pageSize + i + 1}</td>
                        <td>
                          {item.avatar ? (
                            <img src={item.avatar} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(139,92,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
                          )}
                        </td>
                        <td style={{ color: "#8B5CF6" }}>@{item.username || item.uniqueId || "—"}</td>
                        <td style={{ fontWeight: 600, color: "#F1F5F9", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.display_name || item.nickname || "—"}</td>
                        <td>{(item.follower_count ?? item.followers ?? 0).toLocaleString()}</td>
                        <td>{(item.following_count ?? item.following ?? 0).toLocaleString()}</td>
                        <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "#94A3B8" }}>{item.bio || item.signature || "—"}</td>
                        <td><button onClick={() => setSelectedRow(item)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 11 }}>👁</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            background: "#1E293B", borderRadius: 16, padding: 28, maxWidth: 650, width: "90%",
            maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(148,163,184,0.15)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#F1F5F9" }}>Chi tiết</h2>
              <button onClick={() => setSelectedRow(null)} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {Object.entries(selectedRow).filter(([, v]) => typeof v !== "object" || v === null).map(([key, val]) => (
                <div key={key} style={{ padding: "8px 12px", background: "rgba(15,23,42,0.5)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>{key}</div>
                  <div style={{ fontSize: 13, color: "#CBD5E1", wordBreak: "break-all" }}>{String(val ?? "—")}</div>
                </div>
              ))}
            </div>

            {/* Nested objects */}
            {Object.entries(selectedRow).filter(([, v]) => typeof v === "object" && v !== null).map(([key, val]) => (
              <div key={key} style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 14, color: "#A78BFA", marginBottom: 8 }}>{key}</h3>
                <pre style={{ background: "rgba(15,23,42,0.5)", borderRadius: 8, padding: 12, fontSize: 12, color: "#94A3B8", overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(val, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
