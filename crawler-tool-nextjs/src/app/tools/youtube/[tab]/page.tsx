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
  dl(headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n"), `youtube-${st}-${Date.now()}.csv`, "text/csv;charset=utf-8");
}
function exportJSON(results: any[], st: string) {
  dl(JSON.stringify(results, null, 2), `youtube-${st}-${Date.now()}.json`, "application/json");
}

// ===== SOCIAL LINK PARSER =====
function parseSocialLinks(links: any[]): { platform: string; url: string; icon: string }[] {
  if (!Array.isArray(links)) return [];
  const platformMap: Record<string, { name: string; icon: string }> = {
    "instagram.com": { name: "Instagram", icon: "📷" },
    "facebook.com": { name: "Facebook", icon: "📘" },
    "x.com": { name: "X (Twitter)", icon: "🐦" },
    "twitter.com": { name: "Twitter", icon: "🐦" },
    "tiktok.com": { name: "TikTok", icon: "🎵" },
    "linkedin.com": { name: "LinkedIn", icon: "💼" },
    "threads.net": { name: "Threads", icon: "🧵" },
  };
  return links.map((link: any) => {
    let realUrl = link.url || "";
    // Extract real URL from YouTube redirect
    try {
      const u = new URL(realUrl);
      const q = u.searchParams.get("q");
      if (q) realUrl = q;
    } catch { /* ignore */ }
    // Detect platform
    let platform = "Website";
    let icon = "🔗";
    try {
      const host = new URL(realUrl).hostname.replace("www.", "");
      for (const [domain, info] of Object.entries(platformMap)) {
        if (host.includes(domain)) { platform = info.name; icon = info.icon; break; }
      }
    } catch { /* ignore */ }
    return { platform, url: realUrl, icon };
  }).filter(l => l.url && !l.url.includes("youtube.com"));
}

const TABS = [
  { key: "channels", label: "📺 Kênh", scanType: "channels" },
  { key: "videos", label: "🎬 Video", scanType: "videos" },
  { key: "comments", label: "💬 Bình luận", scanType: "video_comments" },
  { key: "jobs", label: "📋 Lịch sử", scanType: "all" },
];

export default function YouTubeToolPage() {
  const params = useParams();
  const tab = (params.tab as string) || "channels";
  const currentTab = TABS.find(t => t.key === tab) || TABS[0];
  const scanType = currentTab.scanType;

  // Form
  const [keyword, setKeyword] = useState("");
  const [limit, setLimit] = useState(20);
  const [deepScanSocial, setDeepScanSocial] = useState(true);
  const [videoUrl, setVideoUrl] = useState("");
  const [commentLimit, setCommentLimit] = useState(100);
  const [region, setRegion] = useState("VN");

  // Jobs tab
  const [jobsList, setJobsList] = useState<any[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsLimit, setJobsLimit] = useState(20);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [jobsSearch, setJobsSearch] = useState("");
  const [jobsStatusFilter, setJobsStatusFilter] = useState("");
  const [jobsTypeFilter, setJobsTypeFilter] = useState("");

  // Settings — multi API key management
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [taskStatus, setTaskStatus] = useState<"idle" | "pending" | "running" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };

  const startPolling = useCallback((st: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/youtube/task/latest?scan_type=${st}`);
        if (!res.ok) return;
        const json = await res.json();
        const task = json?.data;
        if (!task) return;
        if (task.status === "running") setTaskStatus("running");
        else if (task.status === "success") {
          stopPolling(); setTaskStatus("success"); setResults(task.result || []); setLoading(false); setPage(1);
        } else if (task.status === "error") {
          stopPolling(); setTaskStatus("error"); setErrorMsg(task.error_message || "Task bị lỗi"); setLoading(false);
        }
      } catch { /* ignore */ }
    }, 3000);
  }, []);

  // Load API keys on mount
  const loadApiKeys = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api-keys?service=youtube`);
      if (res.ok) {
        const json = await res.json();
        setApiKeys(json.data || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadApiKeys(); }, [loadApiKeys]);

  const addApiKey = async () => {
    if (!newKeyValue.trim()) return;
    setKeySaving(true);
    try {
      await fetch(`${API}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: "youtube", key: newKeyValue.trim(), label: newKeyLabel.trim() }),
      });
      setNewKeyValue(""); setNewKeyLabel("");
      await loadApiKeys();
    } catch { /* ignore */ } finally { setKeySaving(false); }
  };

  const deleteApiKey = async (id: string) => {
    if (!confirm("Xóa API key này?")) return;
    try {
      await fetch(`${API}/api-keys/${id}`, { method: "DELETE" });
      await loadApiKeys();
    } catch { /* ignore */ }
  };

  const toggleKeyStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      await fetch(`${API}/api-keys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      await loadApiKeys();
    } catch { /* ignore */ }
  };

  const resetExhaustedKeys = async () => {
    try {
      await fetch(`${API}/api-keys/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: "youtube" }),
      });
      await loadApiKeys();
    } catch { /* ignore */ }
  };

  // Load jobs history
  const loadJobs = useCallback(async (pg = 1, lim = 20) => {
    setJobsLoading(true);
    try {
      const skip = (pg - 1) * lim;
      const res = await fetch(`${API}/youtube/tasks?limit=${lim}&skip=${skip}`);
      if (res.ok) {
        const json = await res.json();
        setJobsList(json.data || []);
        setJobsTotal(json.total || 0);
      }
    } catch { /* ignore */ } finally { setJobsLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "jobs") {
      loadJobs(jobsPage, jobsLimit);
      return;
    }
    stopPolling(); setResults([]); setTaskStatus("idle"); setErrorMsg(""); setPage(1);
    (async () => {
      try {
        const latestRes = await fetch(`${API}/youtube/task/latest?scan_type=${scanType}`);
        if (latestRes.ok) {
          const lj = await latestRes.json();
          const task = lj?.data;
          if (task) {
            if (task.status === "pending" || task.status === "running") {
              setTaskStatus(task.status); setLoading(true); startPolling(scanType); return;
            } else if (task.status === "error") {
              setTaskStatus("error"); setErrorMsg(task.error_message || "Task bị lỗi");
            }
          }
        }
        const res = await fetch(`${API}/youtube/task/latest?scan_type=${scanType}&status=success`);
        if (res.ok) {
          const json = await res.json();
          if (json?.data?.result) { setTaskStatus("success"); setResults(json.data.result || []); }
        }
      } catch { /* ignore */ }
    })();
    return () => stopPolling();
  }, [scanType, startPolling, tab, loadJobs]);

  // ===== SUBMIT =====
  const handleScan = async () => {
    if (loading) return;
    let body: any = { scan_type: scanType, scan_account: "tool_bot_01" };
    switch (scanType) {
      case "channels":
        if (!keyword.trim()) { setErrorMsg("Vui lòng nhập keyword"); return; }
        body.keyword = keyword; body.limit = limit; body.deep_scan_social = deepScanSocial;
        break;
      case "videos":
        if (!keyword.trim()) { setErrorMsg("Vui lòng nhập keyword"); return; }
        body.keyword = keyword; body.limit = limit; body.region = region;
        break;
      case "video_comments":
        if (!videoUrl.trim()) { setErrorMsg("Vui lòng nhập URL video"); return; }
        body.video_url = videoUrl; body.limit_comments = commentLimit;
        break;
    }
    try {
      stopPolling(); setLoading(true); setResults([]); setTaskStatus("pending"); setErrorMsg("");
      const res = await fetch(`${API}/youtube/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) { setTaskStatus("error"); setErrorMsg(data.message); setLoading(false); return; }
      setTaskStatus("running"); startPolling(scanType);
    } catch (err: any) {
      setTaskStatus("error"); setErrorMsg(err?.message || "Lỗi"); setLoading(false);
    }
  };

  // Pagination
  const paginate = (data: any[], pg: number) => data.slice((pg - 1) * pageSize, pg * pageSize);
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const pagedResults = paginate(results, page);

  const fmt = (n: any) => n != null ? Number(n).toLocaleString() : "—";

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
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ background: page <= 1 ? "transparent" : "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "3px 10px", color: page <= 1 ? "#475569" : "#EF4444", cursor: page <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
          <span style={{ minWidth: 60, textAlign: "center" }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ background: page >= totalPages ? "transparent" : "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "3px 10px", color: page >= totalPages ? "#475569" : "#EF4444", cursor: page >= totalPages ? "default" : "pointer", fontSize: 12 }}>▶</button>
        </div>
      </div>
    );
  };

  const StatusBadge = () => {
    if (taskStatus === "idle") return null;
    const cfg = {
      pending: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "rgba(251,191,36,0.3)", text: "⏳ Đang chờ worker..." },
      running: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "rgba(239,68,68,0.3)", text: "🔄 Đang cào dữ liệu..." },
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1>▶️ YouTube Crawler</h1>
            <p>Quét kênh, video và bình luận từ YouTube</p>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.2)", background: showSettings ? "rgba(239,68,68,0.15)" : "rgba(30,41,59,0.6)", color: showSettings ? "#fca5a5" : "#94A3B8", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>
            ⚙️ Cài đặt
          </button>
        </div>
      </div>

      {/* Settings Panel — Multi API Key Management */}
      {showSettings && (
        <div style={{ padding: 16, marginBottom: 16, borderRadius: 12, background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: "#F1F5F9" }}>🔑 Quản lý YouTube API Keys ({apiKeys.filter(k => k.status === "active").length} active / {apiKeys.length} total)</h3>
            {apiKeys.some(k => k.status === "exhausted") && (
              <button onClick={resetExhaustedKeys} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.1)", color: "#fbbf24", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>🔄 Reset key hết quota</button>
            )}
          </div>

          {/* Key list */}
          {apiKeys.length > 0 && (
            <table className="result-table" style={{ marginBottom: 12 }}>
              <thead>
                <tr><th>#</th><th>Label</th><th>Key</th><th>Status</th><th>Sử dụng</th><th>Lần cuối</th><th>Lỗi</th><th>Hành động</th></tr>
              </thead>
              <tbody>
                {apiKeys.map((k: any, i: number) => {
                  const statusColors: Record<string, { bg: string; color: string }> = {
                    active: { bg: "rgba(34,197,94,0.15)", color: "#4ade80" },
                    exhausted: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
                    error: { bg: "rgba(239,68,68,0.15)", color: "#f87171" },
                    disabled: { bg: "rgba(100,116,139,0.15)", color: "#94A3B8" },
                  };
                  const sc = statusColors[k.status] || statusColors.disabled;
                  return (
                    <tr key={k._id}>
                      <td>{i + 1}</td>
                      <td style={{ fontSize: 12, color: "#F1F5F9" }}>{k.label || "—"}</td>
                      <td style={{ fontSize: 11, fontFamily: "monospace", color: "#64748B" }}>{k.key_masked}</td>
                      <td><span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, background: sc.bg, color: sc.color }}>{k.status}</span></td>
                      <td style={{ fontSize: 11, color: "#94A3B8", textAlign: "center" }}>{k.usage_count}</td>
                      <td style={{ fontSize: 11, color: "#64748B", whiteSpace: "nowrap" }}>{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "—"}</td>
                      <td style={{ fontSize: 10, color: "#f87171", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={k.last_error}>{k.last_error || "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => toggleKeyStatus(k._id, k.status)} style={{ padding: "2px 8px", borderRadius: 4, border: "none", background: k.status === "active" ? "rgba(251,191,36,0.15)" : "rgba(34,197,94,0.15)", color: k.status === "active" ? "#fbbf24" : "#4ade80", cursor: "pointer", fontSize: 10 }}>
                            {k.status === "active" ? "Tắt" : "Bật"}
                          </button>
                          <button onClick={() => deleteApiKey(k._id)} style={{ padding: "2px 8px", borderRadius: 4, border: "none", background: "rgba(239,68,68,0.15)", color: "#f87171", cursor: "pointer", fontSize: 10 }}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {apiKeys.length === 0 && (
            <div style={{ textAlign: "center", padding: "1rem", color: "#64748B", fontSize: 13 }}>Chưa có API key nào. Thêm key bên dưới.</div>
          )}

          {/* Add new key */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input value={newKeyLabel} onChange={e => setNewKeyLabel(e.target.value)} placeholder="Label (VD: Key 1)" style={{ width: 120, padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.8)", color: "#F1F5F9", fontSize: 12 }} />
            <input value={newKeyValue} onChange={e => setNewKeyValue(e.target.value)} placeholder="Nhập API Key..." style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.8)", color: "#F1F5F9", fontSize: 12 }} />
            <button onClick={addApiKey} disabled={keySaving || !newKeyValue.trim()} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #EF4444, #DC2626)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
              {keySaving ? "⏳" : "➕"} Thêm key
            </button>
          </div>
          <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#64748B" }}>
            💡 Hệ thống tự động luân phiên giữa các key (LRU). Key hết quota sẽ bị đánh dấu và bỏ qua.
            Lấy key tại{" "}
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa" }}>Google Cloud Console</a>.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="tool-tabs">
        {TABS.map(t => (
          <Link key={t.key} href={`/tools/youtube/${t.key}`} className={`tool-tab ${tab === t.key ? "active" : ""}`} style={tab === t.key ? { background: "linear-gradient(135deg, #EF4444, #DC2626)" } : {}}>
            {t.label}
          </Link>
        ))}
      </div>

      {/* JOBS TAB — full width */}
      {tab === "jobs" && (
        <div style={{ padding: "0 4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: "#F1F5F9" }}>📋 Lịch sử Jobs ({jobsTotal})</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={jobsLimit} onChange={e => { const l = Number(e.target.value); setJobsLimit(l); setJobsPage(1); loadJobs(1, l); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(148,163,184,0.3)", background: "rgba(15,23,42,0.8)", color: "#F1F5F9", fontSize: 12 }}>
                <option value={10}>10 / trang</option>
                <option value={20}>20 / trang</option>
                <option value={50}>50 / trang</option>
                <option value={100}>100 / trang</option>
              </select>
              <button onClick={() => {
                if (!jobsList.length) return;
                const rows = jobsList.map(j => ({ id: j._id, scan_type: j.scan_type, status: j.status, worker: j.assigned_worker || "", result_count: Array.isArray(j.result) ? j.result.length : 0, created: j.createdAt, updated: j.updatedAt, error: j.error_message || "" }));
                exportCSV(rows, "jobs-history");
              }} disabled={!jobsList.length} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)", color: "#4ade80", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>📥 CSV</button>
              <button onClick={() => {
                if (!jobsList.length) return;
                exportJSON(jobsList, "jobs-history");
              }} disabled={!jobsList.length} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.1)", color: "#60a5fa", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>📥 JSON</button>
              <button onClick={() => loadJobs(jobsPage, jobsLimit)} disabled={jobsLoading} style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#EF4444", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {jobsLoading ? "⏳" : "🔄"} Refresh
              </button>
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input value={jobsSearch} onChange={e => { setJobsSearch(e.target.value); }}
              placeholder="🔍 Tìm theo keyword, URL..." style={{ flex: 1, minWidth: 180, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#F1F5F9", fontSize: 13, outline: "none" }} />
            <select value={jobsTypeFilter} onChange={e => setJobsTypeFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#CBD5E1", fontSize: 13 }}>
              <option value="">Tất cả loại</option>
              <option value="channels">channels</option>
              <option value="videos">videos</option>
              <option value="video_comments">video_comments</option>
            </select>
            <select value={jobsStatusFilter} onChange={e => setJobsStatusFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#CBD5E1", fontSize: 13 }}>
              <option value="">Tất cả trạng thái</option>
              <option value="success">✅ Success</option>
              <option value="error">❌ Error</option>
              <option value="running">🔄 Running</option>
              <option value="pending">⏳ Pending</option>
            </select>
            {(jobsSearch || jobsTypeFilter || jobsStatusFilter) && (
              <button onClick={() => { setJobsSearch(""); setJobsTypeFilter(""); setJobsStatusFilter(""); }}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#f87171", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                ✕ Xóa bộ lọc
              </button>
            )}
          </div>

          {(() => {
            const filteredJobs = jobsList.filter(j => {
              if (jobsStatusFilter && j.status !== jobsStatusFilter) return false;
              if (jobsTypeFilter && j.scan_type !== jobsTypeFilter) return false;
              if (jobsSearch) {
                const s = jobsSearch.toLowerCase();
                const input = (j.input?.keyword || j.input?.video_url || j.assigned_worker || "").toLowerCase();
                if (!input.includes(s) && !(j.scan_type || "").toLowerCase().includes(s) && !(j._id || "").toLowerCase().includes(s)) return false;
              }
              return true;
            });
            return (
              <>
          {jobsLoading ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#64748B" }}>⏳ Đang tải...</div>
          ) : (
            <table className="result-table">
              <thead>
                <tr><th>#</th><th>ID</th><th>Scan Type</th><th>Status</th><th>Worker</th><th>Kết quả</th><th>Ngày tạo</th></tr>
              </thead>
              <tbody>
                {filteredJobs.map((job: any, i: number) => (
                  <tr key={job._id || i} onClick={() => setSelectedJob(job)} style={{ cursor: "pointer" }} title="Bấm để xem chi tiết">
                    <td>{(jobsPage - 1) * jobsLimit + i + 1}</td>
                    <td style={{ fontSize: 11, fontFamily: "monospace", color: "#64748B" }}>{job._id?.slice(-8)}</td>
                    <td><span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "rgba(239,68,68,0.1)", color: "#fca5a5" }}>{job.scan_type}</span></td>
                    <td>
                      <span style={{
                        padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: job.status === "success" ? "rgba(34,197,94,0.15)" : job.status === "error" ? "rgba(239,68,68,0.15)" : job.status === "running" ? "rgba(59,130,246,0.15)" : "rgba(251,191,36,0.15)",
                        color: job.status === "success" ? "#4ade80" : job.status === "error" ? "#f87171" : job.status === "running" ? "#60a5fa" : "#fbbf24",
                      }}>{job.status}</span>
                    </td>
                    <td style={{ fontSize: 11, color: "#94A3B8" }}>{job.assigned_worker || "—"}</td>
                    <td>{Array.isArray(job.result) ? job.result.length : (job.result ? "✓" : "—")}</td>
                    <td style={{ fontSize: 12, color: "#64748B", whiteSpace: "nowrap" }}>{job.createdAt ? new Date(job.createdAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
                {filteredJobs.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#64748B" }}>Không tìm thấy kết quả</td></tr>
                )}
              </tbody>
            </table>
          )}
              </>
            );
          })()}
          {/* Pagination */}
          {jobsTotal > jobsLimit && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
              <button disabled={jobsPage <= 1} onClick={() => { const p = jobsPage - 1; setJobsPage(p); loadJobs(p, jobsLimit); }} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.2)", background: jobsPage <= 1 ? "rgba(30,41,59,0.3)" : "rgba(30,41,59,0.8)", color: jobsPage <= 1 ? "#475569" : "#F1F5F9", cursor: jobsPage <= 1 ? "not-allowed" : "pointer", fontSize: 13 }}>← Trước</button>
              <span style={{ fontSize: 13, color: "#94A3B8" }}>Trang {jobsPage} / {Math.ceil(jobsTotal / jobsLimit)}</span>
              <button disabled={jobsPage >= Math.ceil(jobsTotal / jobsLimit)} onClick={() => { const p = jobsPage + 1; setJobsPage(p); loadJobs(p, jobsLimit); }} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.2)", background: jobsPage >= Math.ceil(jobsTotal / jobsLimit) ? "rgba(30,41,59,0.3)" : "rgba(30,41,59,0.8)", color: jobsPage >= Math.ceil(jobsTotal / jobsLimit) ? "#475569" : "#F1F5F9", cursor: jobsPage >= Math.ceil(jobsTotal / jobsLimit) ? "not-allowed" : "pointer", fontSize: 13 }}>Sau →</button>
            </div>
          )}
        </div>
      )}

      {/* JOB DETAIL MODAL */}
      {selectedJob && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSelectedJob(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1E293B", borderRadius: 16, padding: 24, maxWidth: 800, width: "90%", maxHeight: "85vh", overflow: "auto", border: "1px solid rgba(148,163,184,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#F1F5F9", fontSize: 16 }}>📋 Chi tiết Job</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {Array.isArray(selectedJob.result) && selectedJob.result.length > 0 && (
                  <>
                    <button onClick={() => exportCSV(selectedJob.result, `job-${selectedJob._id?.slice(-8)}`)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)", color: "#4ade80", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>📥 CSV</button>
                    <button onClick={() => exportJSON(selectedJob.result, `job-${selectedJob._id?.slice(-8)}`)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.1)", color: "#60a5fa", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>📥 JSON</button>
                  </>
                )}
                <button onClick={() => setSelectedJob(null)} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 20 }}>✕</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(15,23,42,0.6)" }}>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>ID</div>
                <div style={{ fontSize: 12, color: "#F1F5F9", fontFamily: "monospace" }}>{selectedJob._id}</div>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(15,23,42,0.6)" }}>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Scan Type</div>
                <div style={{ fontSize: 12, color: "#fca5a5" }}>{selectedJob.scan_type}</div>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(15,23,42,0.6)" }}>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Status</div>
                <div style={{ fontSize: 12, color: selectedJob.status === "success" ? "#4ade80" : selectedJob.status === "error" ? "#f87171" : "#fbbf24" }}>{selectedJob.status}</div>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(15,23,42,0.6)" }}>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Worker</div>
                <div style={{ fontSize: 12, color: "#F1F5F9" }}>{selectedJob.assigned_worker || "—"}</div>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(15,23,42,0.6)" }}>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Ngày tạo</div>
                <div style={{ fontSize: 12, color: "#F1F5F9" }}>{selectedJob.createdAt ? new Date(selectedJob.createdAt).toLocaleString() : "—"}</div>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(15,23,42,0.6)" }}>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Cập nhật</div>
                <div style={{ fontSize: 12, color: "#F1F5F9" }}>{selectedJob.updatedAt ? new Date(selectedJob.updatedAt).toLocaleString() : "—"}</div>
              </div>
            </div>
            {selectedJob.input && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>📥 Input</div>
                <pre style={{ background: "rgba(15,23,42,0.8)", padding: 12, borderRadius: 8, fontSize: 11, color: "#94A3B8", overflow: "auto", maxHeight: 120 }}>{JSON.stringify(selectedJob.input, null, 2)}</pre>
              </div>
            )}
            {selectedJob.error_message && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#f87171", marginBottom: 4 }}>❌ Lỗi</div>
                <pre style={{ background: "rgba(239,68,68,0.1)", padding: 12, borderRadius: 8, fontSize: 11, color: "#fca5a5", overflow: "auto" }}>{selectedJob.error_message}</pre>
              </div>
            )}
            {Array.isArray(selectedJob.result) && selectedJob.result.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>📊 Kết quả ({selectedJob.result.length} items)</div>
                <div style={{ maxHeight: 350, overflow: "auto", borderRadius: 8, border: "1px solid rgba(148,163,184,0.1)" }}>
                  <table className="result-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        {Object.keys(selectedJob.result[0]).filter(k => k !== "_id" && k !== "__v").slice(0, 6).map(k => <th key={k}>{k}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedJob.result.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          {Object.keys(selectedJob.result[0]).filter(k => k !== "_id" && k !== "__v").slice(0, 6).map(k => (
                            <td key={k} style={{ fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {typeof item[k] === "object" ? JSON.stringify(item[k]) : String(item[k] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2-col layout */}
      {tab !== "jobs" && (
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 24, alignItems: "start" }}>
        {/* LEFT: Form */}
        <div className="tool-form" style={{ position: "sticky", top: 80 }}>
          {/* CHANNELS */}
          {tab === "channels" && (
            <>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#F1F5F9" }}>Quét kênh YouTube</h3>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>Tìm kênh theo từ khóa, lấy thông tin subscribers, views, socials</p>
              <div className="form-group">
                <label>Keyword <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="VD: cooking, tech review, gaming" onKeyDown={e => e.key === "Enter" && handleScan()} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Số lượng</label>
                  <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} min={1} max={200} />
                </div>
                <div className="form-group">
                  <label>Quét social links</label>
                  <select value={String(deepScanSocial)} onChange={e => setDeepScanSocial(e.target.value === "true")}>
                    <option value="true">Có</option>
                    <option value="false">Không</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* VIDEOS */}
          {tab === "videos" && (
            <>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#F1F5F9" }}>Quét video YouTube</h3>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>Tìm video theo keyword, lấy views, likes, tags</p>
              <div className="form-group">
                <label>Keyword <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="VD: hướng dẫn nấu ăn, react video" onKeyDown={e => e.key === "Enter" && handleScan()} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Số lượng</label>
                  <input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} min={1} max={200} />
                </div>
                <div className="form-group">
                  <label>Khu vực</label>
                  <select value={region} onChange={e => setRegion(e.target.value)}>
                    <option value="VN">Việt Nam</option>
                    <option value="US">Mỹ</option>
                    <option value="JP">Nhật Bản</option>
                    <option value="KR">Hàn Quốc</option>
                    <option value="">Tất cả</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* VIDEO COMMENTS */}
          {tab === "comments" && (
            <>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#F1F5F9" }}>Quét bình luận video</h3>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>Lấy comment từ 1 video YouTube</p>
              <div className="form-group">
                <label>URL Video <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=xxx" onKeyDown={e => e.key === "Enter" && handleScan()} />
              </div>
              <div className="form-group">
                <label>Số comment</label>
                <input type="number" value={commentLimit} onChange={e => setCommentLimit(Number(e.target.value))} min={1} max={1000} />
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
          <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 12, color: "#94A3B8" }}>
              <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.1)", borderTop: "3px solid #EF4444", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p>Tự động cập nhật mỗi 3 giây...</p>
            </div>
          )}

          {!loading && results.length === 0 && taskStatus !== "error" && (
            <div style={{ textAlign: "center", padding: "3rem", color: "#64748B" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>▶️</div>
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

              {/* ===== CHANNELS — Cards ===== */}
              {scanType === "channels" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                  {pagedResults.map((ch: any, i: number) => (
                    <div key={ch.channel_id || i} onClick={() => setSelectedRow(ch)} style={{
                      background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16,
                      cursor: "pointer", transition: "all 0.2s",
                    }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                       onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                        {ch.avatar ? (
                          <img src={ch.avatar} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📺</div>
                        )}
                        <div style={{ overflow: "hidden" }}>
                          <div style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ch.name}</div>
                          {ch.custom_url && <div style={{ fontSize: 12, color: "#EF4444" }}>{ch.custom_url}</div>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 8 }}>
                        <span><strong style={{ color: "#F1F5F9" }}>{fmt(ch.subscribers)}</strong> <span style={{ color: "#64748B" }}>subs</span></span>
                        <span><strong style={{ color: "#F1F5F9" }}>{fmt(ch.total_videos)}</strong> <span style={{ color: "#64748B" }}>videos</span></span>
                        <span><strong style={{ color: "#F1F5F9" }}>{fmt(ch.total_views)}</strong> <span style={{ color: "#64748B" }}>views</span></span>
                      </div>
                      {ch.description && (
                        <p style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.4, margin: "0 0 8px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ch.description}</p>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {ch.country && <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}>🌍 {ch.country}</span>}
                        {(() => {
                          const socials = parseSocialLinks(ch.social_links);
                          return socials.map((s, idx) => (
                            <a key={idx} href={s.url} target="_blank" onClick={e => e.stopPropagation()} style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, background: "rgba(139,92,246,0.12)", color: "#A78BFA", textDecoration: "none" }}>
                              {s.icon} {s.platform}
                            </a>
                          ));
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ===== VIDEOS — Cards with thumbnail ===== */}
              {scanType === "videos" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                  {pagedResults.map((v: any, i: number) => (
                    <div key={v.video_id || i} onClick={() => setSelectedRow(v)} style={{
                      background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12,
                      overflow: "hidden", cursor: "pointer", transition: "all 0.2s",
                    }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                       onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
                      {v.thumbnail ? (
                        <div style={{ width: "100%", aspectRatio: "16/9", overflow: "hidden", background: "#0F172A", position: "relative" }}>
                          <img src={v.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          {v.duration_seconds && (
                            <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.8)", color: "#fff", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                              {v.duration_seconds >= 3600 ? `${Math.floor(v.duration_seconds / 3600)}:${String(Math.floor((v.duration_seconds % 3600) / 60)).padStart(2, "0")}:${String(v.duration_seconds % 60).padStart(2, "0")}` : `${Math.floor(v.duration_seconds / 60)}:${String(v.duration_seconds % 60).padStart(2, "0")}`}
                            </span>
                          )}
                          {v.video_type === "short" && (
                            <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(239,68,68,0.9)", color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>SHORT</span>
                          )}
                        </div>
                      ) : (
                        <div style={{ width: "100%", height: 100, background: "linear-gradient(135deg, #1E293B, #0F172A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🎬</div>
                      )}
                      <div style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 600, color: "#F1F5F9", fontSize: 13, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>{v.title || "—"}</div>
                        <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 6 }}>{v.channel_name || "—"}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12 }}>
                          <span>👁 {fmt(v.views)}</span>
                          <span style={{ color: "#f87171" }}>❤️ {fmt(v.likes)}</span>
                          <span style={{ color: "#60a5fa" }}>💬 {fmt(v.comments)}</span>
                        </div>
                        {v.engagement_rate != null && (
                          <div style={{ marginTop: 4, fontSize: 11, color: "#64748B" }}>📊 Engagement: {v.engagement_rate}%</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ===== COMMENTS — Table ===== */}
              {scanType === "video_comments" && (
                <table className="result-table">
                  <thead>
                    <tr><th>#</th><th>Tác giả</th><th>Nội dung</th><th>Likes</th><th>Intent</th><th>Ngày</th><th></th></tr>
                  </thead>
                  <tbody>
                    {pagedResults.map((c: any, i: number) => (
                      <tr key={i}>
                        <td>{(page - 1) * pageSize + i + 1}</td>
                        <td style={{ color: "#EF4444", whiteSpace: "nowrap", fontWeight: 600 }}>{c.author || "—"}</td>
                        <td style={{ maxWidth: 350, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#CBD5E1" }}>{c.content || "—"}</td>
                        <td>{fmt(c.likes)}</td>
                        <td>
                          <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: c.intent === "positive" ? "rgba(34,197,94,0.15)" : c.intent === "negative" ? "rgba(239,68,68,0.15)" : "rgba(148,163,184,0.15)",
                            color: c.intent === "positive" ? "#4ade80" : c.intent === "negative" ? "#f87171" : "#94A3B8",
                          }}>{c.intent || "—"}</span>
                        </td>
                        <td style={{ fontSize: 12, color: "#64748B", whiteSpace: "nowrap" }}>{c.published_at ? new Date(c.published_at).toLocaleDateString() : "—"}</td>
                        <td><button onClick={() => setSelectedRow(c)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#EF4444", cursor: "pointer", fontSize: 11 }}>👁</button></td>
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
            background: "#1E293B", borderRadius: 16, padding: 28, maxWidth: 700, width: "90%",
            maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(148,163,184,0.15)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "#F1F5F9" }}>Chi tiết</h2>
              <button onClick={() => setSelectedRow(null)} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Flat fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {Object.entries(selectedRow).filter(([, v]) => typeof v !== "object" || v === null).map(([key, val]) => (
                <div key={key} style={{ padding: "8px 12px", background: "rgba(15,23,42,0.5)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>{key}</div>
                  <div style={{ fontSize: 13, color: "#CBD5E1", wordBreak: "break-all" }}>
                    {typeof val === "string" && (val.startsWith("http") ? <a href={val} target="_blank" style={{ color: "#3B82F6" }}>{val}</a> : val) || String(val ?? "—")}
                  </div>
                </div>
              ))}
            </div>

            {/* Nested objects (social_links, tags) */}
            {Object.entries(selectedRow).filter(([, v]) => typeof v === "object" && v !== null).map(([key, val]) => (
              <div key={key} style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 14, color: "#EF4444", marginBottom: 8 }}>{key}</h3>
                {key === "social_links" && Array.isArray(val) ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {parseSocialLinks(val as any[]).map((s, idx) => (
                      <a key={idx} href={s.url} target="_blank" style={{
                        padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                        background: "rgba(139,92,246,0.15)", color: "#C4B5FD", border: "1px solid rgba(139,92,246,0.3)",
                        textDecoration: "none", display: "flex", alignItems: "center", gap: 6,
                      }}>
                        {s.icon} {s.platform}
                      </a>
                    ))}
                    {parseSocialLinks(val as any[]).length === 0 && <span style={{ color: "#64748B", fontSize: 13 }}>Không có social links</span>}
                  </div>
                ) : Array.isArray(val) ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(val as any[]).map((item: any, idx: number) => (
                      <span key={idx} style={{ padding: "3px 10px", borderRadius: 16, fontSize: 12, background: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
                        {typeof item === "string" ? (item.startsWith("http") ? <a href={item} target="_blank" style={{ color: "#fca5a5", textDecoration: "none" }}>{item}</a> : item) : JSON.stringify(item)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <pre style={{ background: "rgba(15,23,42,0.5)", borderRadius: 8, padding: 12, fontSize: 12, color: "#94A3B8", overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(val, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
