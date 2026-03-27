"use client";

import { authFetch } from "@/utils/authFetch";

import { useState, useEffect, useCallback, useRef } from "react";

const API_BE = "/api/proxy";

type AppResult = {
  appId: string;
  title: string;
  icon: string;
  developer: string;
  score: number;
  ratings: number;
  genre: string;
  free: boolean;
  description: string;
  installs: string;
};

type ReviewResult = {
  userName: string;
  content: string;
  rating: number;
  date: string;
  thumbsUpCount: number;
  reviewCreatedVersion: string;
};

function dl(c: string, f: string, t: string) {
  const b = new Blob([c], { type: t }); const u = URL.createObjectURL(b);
  const a = document.createElement("a"); a.href = u; a.download = f; a.click(); URL.revokeObjectURL(u);
}
function exportCSV(arr: any[], name: string) {
  if (!arr.length) return;
  const h = Object.keys(arr[0]).filter(k => typeof arr[0][k] !== "object");
  const rows = arr.map(i => h.map(k => `"${String(i[k] ?? "").replace(/"/g, '""')}"`));
  dl(h.join(",") + "\n" + rows.map(r => r.join(",")).join("\n"), `chplay-${name}-${Date.now()}.csv`, "text/csv;charset=utf-8");
}
function exportJSON(arr: any[], name: string) {
  dl(JSON.stringify(arr, null, 2), `chplay-${name}-${Date.now()}.json`, "application/json");
}

export default function CHPlayToolPage() {
  const [tab, setTab] = useState<"search" | "reviews" | "history">("search");
  const [loading, setLoading] = useState(false);

  // Search state
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("vn");
  const [limit, setLimit] = useState(30);
  const [apps, setApps] = useState<AppResult[]>([]);

  // Reviews state
  const [reviewAppId, setReviewAppId] = useState("");
  const [reviewCount, setReviewCount] = useState(200);
  const [reviews, setReviews] = useState<ReviewResult[]>([]);

  // Pagination
  const [appPage, setAppPage] = useState(1);
  const [revPage, setRevPage] = useState(1);
  const pageSize = 20;

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [histPage, setHistPage] = useState(1);
  const [histResults, setHistResults] = useState<any[]>([]);
  const [histScanType, setHistScanType] = useState<string>("");
  const [histResPage, setHistResPage] = useState(1);
  const [histSearch, setHistSearch] = useState("");
  const [histStatusFilter, setHistStatusFilter] = useState("");
  const [histTypeFilter, setHistTypeFilter] = useState("");
  const histPerPage = 10;
  const histResultRef = useRef<HTMLDivElement>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BE}/chplay/tasks?limit=100`);
      if (res.ok) { const j = await res.json(); if (j.success) setHistory(j.data || []); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (tab === "history") fetchHistory(); }, [tab, fetchHistory]);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    try {
      const res = await authFetch("/api/chplay/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, country, limit }),
      });
      const data = await res.json();
      setApps(data.apps || []);
      setAppPage(1);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleFetchReviews = async (appId?: string) => {
    const targetId = appId || reviewAppId;
    if (!targetId.trim()) return;
    setLoading(true); setTab("reviews"); setReviewAppId(targetId);
    try {
      const res = await authFetch("/api/chplay/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: targetId, country, count: reviewCount }),
      });
      const data = await res.json();
      const allReviews: ReviewResult[] = [];
      if (data.reviews_by_rating) {
        for (const key of ["5", "4", "3", "2", "1"]) allReviews.push(...(data.reviews_by_rating[key] || []));
      }
      setReviews(allReviews);
      setRevPage(1);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h1>🛒 CH Play (Google Play) Crawler</h1>
        <p>Tìm kiếm app và cào reviews từ Google Play Store</p>
      </div>

      <div className="tool-tabs">
        <button className={`tool-tab ${tab === "search" ? "active" : ""}`} onClick={() => setTab("search")}>🔍 Tìm kiếm App</button>
        <button className={`tool-tab ${tab === "reviews" ? "active" : ""}`} onClick={() => setTab("reviews")}>⭐ Cào Reviews</button>
        <button className={`tool-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")} style={tab === "history" ? { background: "linear-gradient(135deg, #10B981, #059669)" } : {}}>📜 Lịch sử</button>
      </div>

      {/* ===== SEARCH ===== */}
      {tab === "search" && (
        <>
          <div className="tool-form">
            <div className="form-row">
              <div className="form-group"><label>Keyword <span style={{ color: "#EF4444" }}>*</span></label><input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="VD: game offline, vpn, photo editor" onKeyDown={e => e.key === "Enter" && handleSearch()} /></div>
              <div className="form-group"><label>Quốc gia</label><select value={country} onChange={e => setCountry(e.target.value)}><option value="vn">Việt Nam</option><option value="us">United States</option><option value="jp">Japan</option><option value="kr">Korea</option><option value="th">Thailand</option></select></div>
              <div className="form-group"><label>Số lượng</label><input type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} min={1} max={50} /></div>
            </div>
            <button className="btn-submit" onClick={handleSearch} disabled={loading}>{loading ? "⏳ Đang tìm..." : "🔍 Tìm kiếm"}</button>
          </div>
          {apps.length > 0 && (
            <div className="results-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2>Kết quả: {apps.length} app</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => exportCSV(apps, "search")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ CSV</button>
                  <button onClick={() => exportJSON(apps, "search")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ JSON</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                {apps.slice((appPage - 1) * pageSize, appPage * pageSize).map(app => (
                  <div key={app.appId} style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16, transition: "all 0.2s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(16,185,129,0.3)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}>
                    <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                      {app.icon && <img src={app.icon} alt="" style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                      <div style={{ overflow: "hidden" }}>
                        <div style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 14 }}>{app.title}</div>
                        <div style={{ fontSize: 12, color: "#94A3B8" }}>{app.developer}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#64748B", marginBottom: 10 }}>
                      <span>⭐ {app.score}</span>
                      <span>💬 {app.ratings?.toLocaleString()}</span>
                      <span>{app.genre}</span>
                      <span>{app.installs}</span>
                    </div>
                    <button onClick={() => handleFetchReviews(app.appId)} style={{ width: "100%", padding: "6px 0", borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⭐ Xem Reviews</button>
                  </div>
                ))}
              </div>
              {apps.length > pageSize && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, fontSize: 13, color: "#94A3B8" }}>
                  <span>{(appPage - 1) * pageSize + 1}–{Math.min(appPage * pageSize, apps.length)} / {apps.length}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button disabled={appPage <= 1} onClick={() => setAppPage(p => p - 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.2)", background: appPage <= 1 ? "transparent" : "rgba(16,185,129,0.1)", color: appPage <= 1 ? "#475569" : "#34D399", cursor: appPage <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
                    <span>{appPage} / {Math.ceil(apps.length / pageSize)}</span>
                    <button disabled={appPage >= Math.ceil(apps.length / pageSize)} onClick={() => setAppPage(p => p + 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.2)", background: appPage >= Math.ceil(apps.length / pageSize) ? "transparent" : "rgba(16,185,129,0.1)", color: appPage >= Math.ceil(apps.length / pageSize) ? "#475569" : "#34D399", cursor: appPage >= Math.ceil(apps.length / pageSize) ? "default" : "pointer", fontSize: 12 }}>▶</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== REVIEWS ===== */}
      {tab === "reviews" && (
        <>
          <div className="tool-form">
            <div className="form-row">
              <div className="form-group"><label>App ID (Package Name) <span style={{ color: "#EF4444" }}>*</span></label><input value={reviewAppId} onChange={e => setReviewAppId(e.target.value)} placeholder="VD: com.facebook.katana" onKeyDown={e => e.key === "Enter" && handleFetchReviews()} /></div>
              <div className="form-group"><label>Số reviews</label><input type="number" value={reviewCount} onChange={e => setReviewCount(Number(e.target.value))} min={1} max={1000} /></div>
            </div>
            <button className="btn-submit" onClick={() => handleFetchReviews()} disabled={loading}>{loading ? "⏳ Đang cào..." : "⭐ Cào Reviews"}</button>
          </div>
          {reviews.length > 0 && (
            <div className="results-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2>Reviews: {reviews.length}</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => exportCSV(reviews, "reviews")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ CSV</button>
                  <button onClick={() => exportJSON(reviews, "reviews")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ JSON</button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reviews.slice((revPage - 1) * pageSize, revPage * pageSize).map((r, i) => (
                  <div key={i} style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: "#F1F5F9", fontSize: 13 }}>{r.userName}</span>
                      <span style={{ fontSize: 12, color: "#64748B" }}>{r.date?.slice(0, 10)}</span>
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>{"⭐".repeat(r.rating)}</div>
                    <p style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.5, margin: 0 }}>{r.content?.slice(0, 300)}</p>
                    <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "#64748B" }}>
                      {r.thumbsUpCount > 0 && <span>👍 {r.thumbsUpCount}</span>}
                      {r.reviewCreatedVersion && <span>v{r.reviewCreatedVersion}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {reviews.length > pageSize && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, fontSize: 13, color: "#94A3B8" }}>
                  <span>{(revPage - 1) * pageSize + 1}–{Math.min(revPage * pageSize, reviews.length)} / {reviews.length}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button disabled={revPage <= 1} onClick={() => setRevPage(p => p - 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.2)", background: revPage <= 1 ? "transparent" : "rgba(16,185,129,0.1)", color: revPage <= 1 ? "#475569" : "#34D399", cursor: revPage <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
                    <span>{revPage} / {Math.ceil(reviews.length / pageSize)}</span>
                    <button disabled={revPage >= Math.ceil(reviews.length / pageSize)} onClick={() => setRevPage(p => p + 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.2)", background: revPage >= Math.ceil(reviews.length / pageSize) ? "transparent" : "rgba(16,185,129,0.1)", color: revPage >= Math.ceil(reviews.length / pageSize) ? "#475569" : "#34D399", cursor: revPage >= Math.ceil(reviews.length / pageSize) ? "default" : "pointer", fontSize: 12 }}>▶</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== HISTORY ===== */}
      {tab === "history" && (
        <div>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "#F1F5F9" }}>📜 Lịch sử quét — {history.length} tasks</h2>

          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input value={histSearch} onChange={e => { setHistSearch(e.target.value); setHistPage(1); }}
              placeholder="🔍 Tìm theo keyword, app ID..." style={{ flex: 1, minWidth: 180, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#F1F5F9", fontSize: 13, outline: "none" }} />
            <select value={histTypeFilter} onChange={e => { setHistTypeFilter(e.target.value); setHistPage(1); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#CBD5E1", fontSize: 13 }}>
              <option value="">Tất cả loại</option>
              <option value="search">search</option>
              <option value="reviews">reviews</option>
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
                const input = (t.input?.keyword || t.input?.app_id || "").toLowerCase();
                if (!input.includes(s) && !(t.scan_type || "").toLowerCase().includes(s)) return false;
              }
              return true;
            });
            const totalHistPages = Math.max(1, Math.ceil(filtered.length / histPerPage));
            return filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#64748B" }}><div style={{ fontSize: 48, marginBottom: 12 }}>📜</div><p>Không tìm thấy kết quả</p></div>
          ) : (
            <>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px", fontSize: 14 }}>
                <thead><tr style={{ fontSize: 12, color: "#64748B", textTransform: "uppercase" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Loại</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Input</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Trạng thái</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Kết quả</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Thời gian</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Thao tác</th>
                </tr></thead>
                <tbody>
                  {filtered.slice((histPage - 1) * histPerPage, histPage * histPerPage).map((task: any) => (
                    <tr key={task._id} style={{ background: "rgba(15,23,42,0.5)" }}>
                      <td style={{ padding: "10px 12px", borderRadius: "8px 0 0 8px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: task.scan_type === "search" ? "rgba(16,185,129,0.15)" : "rgba(234,179,8,0.15)", color: task.scan_type === "search" ? "#34D399" : "#FBBF24", border: `1px solid ${task.scan_type === "search" ? "rgba(16,185,129,0.2)" : "rgba(234,179,8,0.2)"}` }}>
                          {task.scan_type === "search" ? "🔍" : "⭐"} {task.scan_type}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#CBD5E1", fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.input?.keyword || task.input?.app_id || "—"}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: task.status === "success" ? "rgba(34,197,94,0.15)" : task.status === "error" ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.15)", color: task.status === "success" ? "#4ade80" : task.status === "error" ? "#f87171" : "#fbbf24" }}>
                          {task.status === "success" ? "✅" : task.status === "error" ? "❌" : "⏳"} {task.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", color: "#94A3B8" }}>
                        {Array.isArray(task.result) ? task.result.length : task.result?.total_reviews ?? 0} mục
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#64748B" }}>{new Date(task.createdAt).toLocaleString()}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center", borderRadius: "0 8px 8px 0" }}>
                        {task.result && (
                          <button onClick={() => { let res: any[] = []; if (task.scan_type === "reviews" && task.result?.reviews_by_rating) { for (const k of Object.keys(task.result.reviews_by_rating)) res.push(...(task.result.reviews_by_rating[k] || [])); } else { res = Array.isArray(task.result) ? task.result : [task.result]; } setHistResults(res); setHistScanType(task.scan_type); setHistResPage(1); setTimeout(() => histResultRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", cursor: "pointer", fontSize: 12 }}>👁 Xem</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > histPerPage && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 13, color: "#94A3B8" }}>
                  <span>{(histPage - 1) * histPerPage + 1}–{Math.min(histPage * histPerPage, filtered.length)} / {filtered.length}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button disabled={histPage <= 1} onClick={() => setHistPage(p => p - 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.2)", background: histPage <= 1 ? "transparent" : "rgba(16,185,129,0.1)", color: histPage <= 1 ? "#475569" : "#34D399", cursor: histPage <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
                    <span>{histPage} / {totalHistPages}</span>
                    <button disabled={histPage >= totalHistPages} onClick={() => setHistPage(p => p + 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.2)", background: histPage >= totalHistPages ? "transparent" : "rgba(16,185,129,0.1)", color: histPage >= totalHistPages ? "#475569" : "#34D399", cursor: histPage >= totalHistPages ? "default" : "pointer", fontSize: 12 }}>▶</button>
                  </div>
                </div>
              )}
            </>
          );
          })()}
          {histResults.length > 0 && (
            <div ref={histResultRef} style={{ marginTop: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Kết quả: {histResults.length} {histScanType === "search" ? "app" : "reviews"}</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => exportCSV(histResults, "history")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ CSV</button>
                  <button onClick={() => exportJSON(histResults, "history")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ JSON</button>
                  <button onClick={() => setHistResults([])} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94A3B8", cursor: "pointer", fontSize: 12 }}>✕ Đóng</button>
                </div>
              </div>
              {histScanType === "search" ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                    {histResults.slice((histResPage - 1) * pageSize, histResPage * pageSize).map((app: any, i: number) => (
                      <div key={i} style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
                        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                          {app.icon && <img src={app.icon} alt="" style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                          <div style={{ overflow: "hidden" }}>
                            <div style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 14 }}>{app.title || app.trackName || ""}</div>
                            <div style={{ fontSize: 12, color: "#94A3B8" }}>{app.developer || app.artistName || ""}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#64748B" }}>
                          <span>⭐ {app.score || app.averageUserRating || 0}</span>
                          <span>💬 {(app.ratings || app.userRatingCount || 0).toLocaleString()}</span>
                          <span>{app.genre || app.primaryGenreName || ""}</span>
                          {app.installs && <span>{app.installs}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {histResults.length > pageSize && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, fontSize: 13, color: "#94A3B8" }}>
                      <span>{(histResPage - 1) * pageSize + 1}–{Math.min(histResPage * pageSize, histResults.length)} / {histResults.length}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button disabled={histResPage <= 1} onClick={() => setHistResPage(p => p - 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.2)", background: histResPage <= 1 ? "transparent" : "rgba(16,185,129,0.1)", color: histResPage <= 1 ? "#475569" : "#34D399", cursor: histResPage <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
                        <span>{histResPage} / {Math.ceil(histResults.length / pageSize)}</span>
                        <button disabled={histResPage >= Math.ceil(histResults.length / pageSize)} onClick={() => setHistResPage(p => p + 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.2)", background: histResPage >= Math.ceil(histResults.length / pageSize) ? "transparent" : "rgba(16,185,129,0.1)", color: histResPage >= Math.ceil(histResults.length / pageSize) ? "#475569" : "#34D399", cursor: histResPage >= Math.ceil(histResults.length / pageSize) ? "default" : "pointer", fontSize: 12 }}>▶</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {histResults.slice((histResPage - 1) * pageSize, histResPage * pageSize).map((r: any, i: number) => (
                      <div key={i} style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, color: "#F1F5F9", fontSize: 13 }}>{r.userName}</span>
                          <span style={{ fontSize: 12, color: "#64748B" }}>{r.date ? String(r.date).slice(0, 10) : ""}</span>
                        </div>
                        <div style={{ fontSize: 13, marginBottom: 4 }}>{"⭐".repeat(r.rating || 0)}</div>
                        <p style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.5, margin: 0 }}>{(r.content || "").slice(0, 300)}</p>
                        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "#64748B" }}>
                          {r.thumbsUpCount > 0 && <span>👍 {r.thumbsUpCount}</span>}
                          {r.reviewCreatedVersion && <span>v{r.reviewCreatedVersion}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {histResults.length > pageSize && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, fontSize: 13, color: "#94A3B8" }}>
                      <span>{(histResPage - 1) * pageSize + 1}–{Math.min(histResPage * pageSize, histResults.length)} / {histResults.length}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button disabled={histResPage <= 1} onClick={() => setHistResPage(p => p - 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.2)", background: histResPage <= 1 ? "transparent" : "rgba(16,185,129,0.1)", color: histResPage <= 1 ? "#475569" : "#34D399", cursor: histResPage <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
                        <span>{histResPage} / {Math.ceil(histResults.length / pageSize)}</span>
                        <button disabled={histResPage >= Math.ceil(histResults.length / pageSize)} onClick={() => setHistResPage(p => p + 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.2)", background: histResPage >= Math.ceil(histResults.length / pageSize) ? "transparent" : "rgba(16,185,129,0.1)", color: histResPage >= Math.ceil(histResults.length / pageSize) ? "#475569" : "#34D399", cursor: histResPage >= Math.ceil(histResults.length / pageSize) ? "default" : "pointer", fontSize: 12 }}>▶</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
