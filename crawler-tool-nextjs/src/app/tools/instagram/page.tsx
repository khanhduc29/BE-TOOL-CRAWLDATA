"use client";

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

function exportCSV(profiles: any[]) {
  const headers = ["Username","Name","Followers","Following","Posts","Bio","Website","Phone","Email","Facebook","Instagram","TikTok","YouTube","Twitter","LinkedIn"];
  const rows = profiles.map((p: any) => {
    const s = p.website_data?.socials || {};
    const phones = [...new Set([p.phone, ...(p.website_data?.phones || [])].filter(Boolean))];
    const emails = [...new Set([p.email, ...(p.website_data?.emails || [])].filter(Boolean))];
    return [
      `"${p.username ?? ""}"`, `"${(p.name ?? "").replace(/"/g, '""')}"`, p.followers ?? "", p.following ?? "", p.posts ?? "",
      `"${(p.bio ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`, `"${p.website ?? ""}"`,
      `"${phones.join(", ")}"`, `"${emails.join(", ")}"`,
      `"${(s.facebook || []).join(", ")}"`, `"${(s.instagram || []).join(", ")}"`,
      `"${(s.tiktok || []).join(", ")}"`, `"${(s.youtube || []).join(", ")}"`,
      `"${(s.twitter || []).join(", ")}"`, `"${(s.linkedin || []).join(", ")}"`,
    ];
  });
  const csv = headers.join(",") + "\n" + rows.map((r: any) => r.join(",")).join("\n");
  downloadFile(csv, `instagram-profiles.csv`, "text/csv;charset=utf-8");
}

function exportTXT(profiles: any[]) {
  const lines = profiles.map((p: any, i: number) => {
    const phones = [...new Set([p.phone, ...(p.website_data?.phones || [])].filter(Boolean))];
    const emails = [...new Set([p.email, ...(p.website_data?.emails || [])].filter(Boolean))];
    return [
      `${i + 1}. @${p.username} — ${p.name}`,
      `   Followers: ${p.followers ?? "-"} | Following: ${p.following ?? "-"} | Posts: ${p.posts ?? "-"}`,
      `   Bio: ${(p.bio ?? "-").replace(/\n/g, " ")}`,
      `   Website: ${p.website ?? "-"}`,
      `   Phone: ${phones.join(", ") || "-"}`,
      `   Email: ${emails.join(", ") || "-"}`,
      "-".repeat(50),
    ].join("\n");
  });
  downloadFile(lines.join("\n"), `instagram-profiles.txt`, "text/plain;charset=utf-8");
}

type Tab = "scan" | "history" | "results";

export default function InstagramToolPage() {
  // Form
  const [urls, setUrls] = useState("");
  const [scanWebsite, setScanWebsite] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // UI
  const [tab, setTab] = useState<Tab>("scan");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [taskStatus, setTaskStatus] = useState<"idle" | "pending" | "running" | "success" | "error">("idle");
  const [progress, setProgress] = useState({ total: 0, done: 0, success: 0, error: 0 });
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [histPage, setHistPage] = useState(1);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };

  // ===== API =====
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/instagram/tasks?limit=200`);
      const data = await res.json();
      if (data.success) setHistory(data.data || []);
    } catch { /* ignore */ }
  }, []);

  const startPolling = useCallback((requestId: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/instagram/tasks?request_id=${requestId}`);
        const data = await res.json();
        if (!data.success) return;

        const tasks = data.data;
        const total = tasks.length;
        const successTasks = tasks.filter((t: any) => t.status === "success");
        const errorTasks = tasks.filter((t: any) => t.status === "error");
        const done = successTasks.length + errorTasks.length;

        setProgress({ total, done, success: successTasks.length, error: errorTasks.length });

        const successProfiles = successTasks.filter((t: any) => t.result).map((t: any) => t.result);
        if (successProfiles.length > 0) setProfiles(successProfiles);
        if (done > 0) setTaskStatus("running");

        if (done >= total) {
          stopPolling();
          setIsSubmitting(false);
          setTaskStatus(errorTasks.length > 0 && successTasks.length === 0 ? "error" : "success");
          setTab("results");
          fetchHistory();
        }
      } catch { /* ignore */ }
    }, 3000);
  }, [fetchHistory]);

  useEffect(() => {
    fetchHistory();
    // Restore state from latest tasks
    (async () => {
      try {
        const res = await fetch(`${API}/instagram/tasks?limit=50`);
        const data = await res.json();
        if (!data.success || !data.data?.length) return;
        const tasks = data.data;
        const sp = tasks.filter((t: any) => t.status === "success" && t.result).map((t: any) => t.result);
        if (sp.length > 0) { setProfiles(sp); setTaskStatus("success"); }
        const hasPending = tasks.some((t: any) => t.status === "pending");
        if (hasPending) {
          const rid = (tasks[0] as any).request_id;
          if (rid) { setTaskStatus("pending"); setIsSubmitting(true); startPolling(rid); }
        }
      } catch { /* ignore */ }
    })();
    return () => stopPolling();
  }, [fetchHistory, startPolling]);

  const handleScan = async () => {
    const lines = urls.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { setSubmitError("Vui lòng nhập ít nhất 1 link"); return; }

    try {
      stopPolling();
      setIsSubmitting(true);
      setSubmitError("");
      setTaskStatus("pending");
      setProfiles([]);
      setProgress({ total: lines.length, done: 0, success: 0, error: 0 });

      const inputs = lines.map(url => ({ url, scan_website: scanWebsite }));
      const res = await fetch(`${API}/instagram/create-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs }),
      });
      if (!res.ok) throw new Error(`Server trả về lỗi (${res.status})`);

      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Không thể tạo scan");
      const requestId = json.data?._id;
      setTaskStatus("running");
      setUrls("");
      if (requestId) startPolling(requestId);
    } catch (err: any) {
      setTaskStatus("error");
      setSubmitError(err?.message || "Không thể tạo scan");
      setIsSubmitting(false);
    }
  };

  // Pagination helpers
  const paginate = (data: any[], pg: number, ps: number) => data.slice((pg - 1) * ps, pg * ps);
  const totalPages = (data: any[], ps: number) => Math.max(1, Math.ceil(data.length / ps));
  const pagedProfiles = paginate(profiles, page, pageSize);
  const pagedHistory = paginate(history, histPage, pageSize);
  const urlCount = urls.split("\n").map(l => l.trim()).filter(Boolean).length;

  const unique = (arr: (string | null | undefined)[]) => [...new Set(arr.filter(Boolean))];

  const PaginationBar = ({ current, total, totalItems, onChange }: { current: number; total: number; totalItems: number; onChange: (p: number) => void }) => {
    if (totalItems <= 0) return null;
    const start = (current - 1) * pageSize + 1;
    const end = Math.min(current * pageSize, totalItems);
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "#94A3B8" }}>
        <span>{start}–{end} / {totalItems}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); onChange(1); }} style={{ background: "#1E293B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "3px 8px", color: "#CBD5E1", fontSize: 12 }}>
            {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}/trang</option>)}
          </select>
          <button disabled={current <= 1} onClick={() => onChange(current - 1)} style={{ background: current <= 1 ? "transparent" : "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, padding: "3px 10px", color: current <= 1 ? "#475569" : "#60a5fa", cursor: current <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
          <span>{current} / {total}</span>
          <button disabled={current >= total} onClick={() => onChange(current + 1)} style={{ background: current >= total ? "transparent" : "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, padding: "3px 10px", color: current >= total ? "#475569" : "#60a5fa", cursor: current >= total ? "default" : "pointer", fontSize: 12 }}>▶</button>
        </div>
      </div>
    );
  };

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h1>📷 Instagram Crawler</h1>
        <p>Quét thông tin profile Instagram — hỗ trợ nhiều tài khoản cùng lúc</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {([
          { key: "scan", label: "📝 Quét mới", count: null },
          { key: "results", label: "📊 Kết quả", count: profiles.length },
          { key: "history", label: "📜 Lịch sử", count: history.length },
        ] as { key: Tab; label: string; count: number | null }[]).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === "history") fetchHistory(); }} className={`tab-btn ${tab === t.key ? "active" : ""}`}>
            {t.label}{t.count !== null ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {/* ===== SCAN TAB ===== */}
      {tab === "scan" && (
        <div className="tool-form">
          <div className="form-group">
            <label>Nhập link Instagram (mỗi link 1 dòng) <span style={{ color: "#EF4444" }}>*</span></label>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder={"https://instagram.com/username1\nhttps://instagram.com/username2\nhttps://instagram.com/username3"}
              rows={6}
            />
            {urlCount > 0 && (
              <p style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>📋 {urlCount} link được nhập</p>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Quét sâu Website</label>
              <select value={String(scanWebsite)} onChange={(e) => setScanWebsite(e.target.value === "true")}>
                <option value="true">Có (email, phone, socials)</option>
                <option value="false">Không</option>
              </select>
            </div>
          </div>

          <button className="btn-submit" onClick={handleScan} disabled={isSubmitting || urlCount === 0}>
            {isSubmitting
              ? taskStatus === "pending" ? "⏳ Đang gửi yêu cầu..." : `🔄 Đang cào (${progress.done}/${progress.total})...`
              : urlCount > 0 ? `🔍 Quét ${urlCount} tài khoản` : "🔍 Quét"
            }
          </button>

          {submitError && (
            <div style={{ marginTop: 12, padding: "10px 16px", borderRadius: 8, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13 }}>
              ❌ {submitError}
            </div>
          )}

          {/* Progress bar */}
          {(taskStatus === "running" || taskStatus === "pending") && progress.total > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B", marginBottom: 4 }}>
                <span>Tiến độ: {progress.done}/{progress.total}</span>
                <span>{Math.round((progress.done / progress.total) * 100)}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${(progress.done / progress.total) * 100}%`,
                  borderRadius: 3,
                  background: progress.error > 0 ? "linear-gradient(90deg, #4ade80, #fbbf24)" : "linear-gradient(90deg, #4ade80, #22d3ee)",
                  transition: "width 0.5s ease",
                }} />
              </div>
              {progress.error > 0 && <p style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>⚠️ {progress.error} lỗi</p>}
              {progress.success > 0 && <p style={{ fontSize: 11, color: "#4ade80", marginTop: 2 }}>✅ {progress.success} thành công</p>}
            </div>
          )}
        </div>
      )}

      {/* ===== RESULTS TAB ===== */}
      {tab === "results" && (
        <div className="results-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: 0 }}>Kết quả: {profiles.length} profile</h2>
            {profiles.length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => exportCSV(profiles)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  ⬇ CSV
                </button>
                <button onClick={() => exportTXT(profiles)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.1)", color: "#FBBF24", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  ⬇ TXT
                </button>
              </div>
            )}
          </div>

          {profiles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#64748B" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
              <p>Chưa có kết quả. Hãy quét profile từ tab &quot;Quét mới&quot;</p>
            </div>
          ) : (
            <>
              {/* Profile Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {pagedProfiles.map((item: any, idx: number) => {
                  const phones = unique([item.phone, ...(item.website_data?.phones || [])]);
                  const emails = unique([item.email, ...(item.website_data?.emails || [])]);

                  return (
                    <div key={item.username || idx} onClick={() => setSelectedProfile(item)} style={{
                      background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20,
                      cursor: "pointer", transition: "all 0.2s",
                    }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                       onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
                    >
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg, #833AB4, #FD1D1D, #F77737)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📷</div>
                        <div style={{ overflow: "hidden" }}>
                          <div style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name || item.username}</div>
                          <div style={{ fontSize: 13, color: "#8B5CF6" }}>@{item.username}</div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 13 }}>
                        <span><strong style={{ color: "#F1F5F9" }}>{(item.followers ?? 0).toLocaleString()}</strong> <span style={{ color: "#64748B" }}>followers</span></span>
                        <span><strong style={{ color: "#F1F5F9" }}>{(item.following ?? 0).toLocaleString()}</strong> <span style={{ color: "#64748B" }}>following</span></span>
                        <span><strong style={{ color: "#F1F5F9" }}>{(item.posts ?? 0).toLocaleString()}</strong> <span style={{ color: "#64748B" }}>posts</span></span>
                      </div>

                      {/* Bio */}
                      {item.bio && (
                        <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.5, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.bio}</p>
                      )}

                      {/* Quick info */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {item.website && <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}>🌐 Website</span>}
                        {phones.length > 0 && <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "rgba(16,185,129,0.12)", color: "#34d399" }}>📞 {phones.length}</span>}
                        {emails.length > 0 && <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>📧 {emails.length}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <PaginationBar current={page} total={totalPages(profiles, pageSize)} totalItems={profiles.length} onChange={setPage} />
            </>
          )}
        </div>
      )}

      {/* ===== HISTORY TAB ===== */}
      {tab === "history" && (
        <div className="results-section">
          <h2>Lịch sử quét ({history.length})</h2>
          <table className="result-table">
            <thead>
              <tr><th>URL</th><th>Status</th><th>Thời gian</th><th></th></tr>
            </thead>
            <tbody>
              {pagedHistory.map((task: any) => (
                <tr key={task._id}>
                  <td style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.input?.url || "—"}</td>
                  <td>
                    <span style={{
                      padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: task.status === "success" ? "rgba(34,197,94,0.15)" : task.status === "error" ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.15)",
                      color: task.status === "success" ? "#4ade80" : task.status === "error" ? "#f87171" : "#fbbf24",
                    }}>
                      {task.status === "success" ? "✅" : task.status === "error" ? "❌" : "⏳"} {task.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "#64748B" }}>{new Date(task.createdAt).toLocaleString()}</td>
                  <td>
                    {task.status === "success" && task.result && (
                      <button onClick={() => { setProfiles([task.result]); setPage(1); setTab("results"); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.1)", color: "#60a5fa", cursor: "pointer", fontSize: 12 }}>
                        👁 Xem
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar current={histPage} total={totalPages(history, pageSize)} totalItems={history.length} onChange={setHistPage} />
        </div>
      )}

      {/* ===== PROFILE DETAIL MODAL ===== */}
      {selectedProfile && (
        <div onClick={() => setSelectedProfile(null)} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#1E293B", borderRadius: 16, padding: 28, maxWidth: 650, width: "90%",
            maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(148,163,184,0.15)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #833AB4, #FD1D1D, #F77737)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>📷</div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, color: "#F1F5F9" }}>{selectedProfile.name}</h2>
                  <p style={{ margin: 0, fontSize: 14, color: "#8B5CF6" }}>@{selectedProfile.username}</p>
                </div>
              </div>
              <button onClick={() => setSelectedProfile(null)} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 16, padding: "12px 16px", background: "rgba(15,23,42,0.5)", borderRadius: 8, marginBottom: 16, justifyContent: "center" }}>
              {[
                ["Followers", selectedProfile.followers],
                ["Following", selectedProfile.following],
                ["Posts", selectedProfile.posts],
              ].map(([label, val]) => (
                <div key={label as string} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9" }}>{(val as number ?? 0).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Bio */}
            {selectedProfile.bio && (
              <div style={{ padding: "10px 14px", background: "rgba(15,23,42,0.5)", borderRadius: 8, marginBottom: 16, borderLeft: "3px solid #8B5CF6" }}>
                <div style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selectedProfile.bio}</div>
              </div>
            )}

            {/* Contact Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {(() => {
                const phones = unique([selectedProfile.phone, ...(selectedProfile.website_data?.phones || [])]);
                const emails = unique([selectedProfile.email, ...(selectedProfile.website_data?.emails || [])]);
                const items: [string, string][] = [];
                if (selectedProfile.website) items.push(["🌐 Website", selectedProfile.website]);
                phones.forEach(p => items.push(["📞 Phone", p as string]));
                emails.forEach(e => items.push(["📧 Email", e as string]));
                return items.map(([label, value], idx) => (
                  <div key={idx} style={{ padding: "8px 12px", background: "rgba(15,23,42,0.5)", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, color: "#CBD5E1", wordBreak: "break-all" }}>
                      {label === "🌐 Website" ? <a href={value} target="_blank" style={{ color: "#3B82F6" }}>{value}</a> : value}
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Socials */}
            {selectedProfile.website_data?.socials && (() => {
              const socials = selectedProfile.website_data.socials;
              const hasSocials = Object.values(socials).some((v: any) => Array.isArray(v) && v.length > 0);
              if (!hasSocials) return null;
              return (
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 15, color: "#A78BFA", marginBottom: 8 }}>🔗 Social Links</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {Object.entries(socials).filter(([, v]: any) => Array.isArray(v) && v.length > 0).map(([key, urls]: any) =>
                      urls.map((url: string, idx: number) => (
                        <a key={`${key}-${idx}`} href={url} target="_blank" style={{
                          padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: "rgba(139,92,246,0.15)", color: "#C4B5FD", border: "1px solid rgba(139,92,246,0.3)",
                          textDecoration: "none",
                        }}>
                          {key === "facebook" ? "📘" : key === "instagram" ? "📷" : key === "tiktok" ? "🎵" :
                           key === "youtube" ? "▶️" : key === "twitter" ? "🐦" : key === "linkedin" ? "💼" : "🔗"} {key}
                        </a>
                      ))
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
