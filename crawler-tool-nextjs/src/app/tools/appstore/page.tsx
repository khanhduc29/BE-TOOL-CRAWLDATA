"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API_BE = "/api/proxy";

type AppResult = {
  trackId: number; trackName: string; artworkUrl100: string;
  artistName: string; averageUserRating: number; userRatingCount: number;
  primaryGenreName: string; formattedPrice: string; description: string;
};

type ReviewResult = {
  title: string; content: string; rating: number;
  userName: string; date: string; voteCount: string; appVersion: string;
};

function dl(c: string, f: string, t: string) {
  const b = new Blob([c], { type: t }); const u = URL.createObjectURL(b);
  const a = document.createElement("a"); a.href = u; a.download = f; a.click(); URL.revokeObjectURL(u);
}
function exportCSV(arr: any[], name: string) {
  if (!arr.length) return;
  const h = Object.keys(arr[0]).filter(k => typeof arr[0][k] !== "object");
  const rows = arr.map(i => h.map(k => `"${String(i[k] ?? "").replace(/"/g, '""')}"`));
  dl(h.join(",") + "\n" + rows.map(r => r.join(",")).join("\n"), `appstore-${name}-${Date.now()}.csv`, "text/csv;charset=utf-8");
}
function exportJSON(arr: any[], name: string) {
  dl(JSON.stringify(arr, null, 2), `appstore-${name}-${Date.now()}.json`, "application/json");
}

export default function AppStoreToolPage() {
  const [tab, setTab] = useState<"search" | "reviews" | "history">("search");
  const [loading, setLoading] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("vn");
  const [limit, setLimit] = useState(30);
  const [apps, setApps] = useState<AppResult[]>([]);

  const [reviewAppId, setReviewAppId] = useState("");
  const [maxPages, setMaxPages] = useState(10);
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
  const histPerPage = 10;
  const histResultRef = useRef<HTMLDivElement>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BE}/appstore/tasks?limit=100`);
      if (res.ok) { const j = await res.json(); if (j.success) setHistory(j.data || []); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (tab === "history") fetchHistory(); }, [tab, fetchHistory]);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/appstore/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, country, limit }),
      });
      const data = await res.json();
      setApps(data.apps || []);
      setAppPage(1);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleFetchReviews = async (appId?: string | number) => {
    const targetId = String(appId || reviewAppId);
    if (!targetId.trim()) return;
    setLoading(true); setTab("reviews"); setReviewAppId(targetId);
    try {
      const res = await fetch("/api/appstore/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: targetId, country, max_pages: maxPages }),
      });
      const data = await res.json();
      const allReviews: ReviewResult[] = [];
      if (data.reviews_by_rating) {
        for (const key of [5, 4, 3, 2, 1]) allReviews.push(...(data.reviews_by_rating[key] || []));
      }
      setReviews(allReviews);
      setRevPage(1);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h1>🍎 App Store Crawler</h1>
        <p>Tìm kiếm app và cào reviews từ Apple App Store</p>
      </div>

      <div className="tool-tabs">
        <button className={`tool-tab ${tab === "search" ? "active" : ""}`} onClick={() => setTab("search")}>🔍 Tìm kiếm App</button>
        <button className={`tool-tab ${tab === "reviews" ? "active" : ""}`} onClick={() => setTab("reviews")}>⭐ Cào Reviews</button>
        <button className={`tool-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")} style={tab === "history" ? { background: "linear-gradient(135deg, #F59E0B, #D97706)" } : {}}>📜 Lịch sử</button>
      </div>

      {/* ===== SEARCH ===== */}
      {tab === "search" && (
        <>
          <div className="tool-form">
            <div className="form-row">
              <div className="form-group"><label>Keyword <span style={{ color: "#EF4444" }}>*</span></label><input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="VD: photo editor, vpn, music player" onKeyDown={e => e.key === "Enter" && handleSearch()} /></div>
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
                  <button onClick={() => exportCSV(apps, "search")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.1)", color: "#FBBF24", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ CSV</button>
                  <button onClick={() => exportJSON(apps, "search")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ JSON</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                {apps.slice((appPage - 1) * pageSize, appPage * pageSize).map(app => (
                  <div key={app.trackId} style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16, transition: "all 0.2s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.3)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}>
                    <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                      {app.artworkUrl100 && <img src={app.artworkUrl100} alt="" style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0 }} />}
                      <div style={{ overflow: "hidden" }}>
                        <div style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 14 }}>{app.trackName}</div>
                        <div style={{ fontSize: 12, color: "#94A3B8" }}>{app.artistName}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#64748B", marginBottom: 10 }}>
                      <span>⭐ {app.averageUserRating}</span>
                      <span>💬 {app.userRatingCount?.toLocaleString()}</span>
                      <span>{app.primaryGenreName}</span>
                      <span>{app.formattedPrice}</span>
                    </div>
                    <button onClick={() => handleFetchReviews(app.trackId)} style={{ width: "100%", padding: "6px 0", borderRadius: 8, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.1)", color: "#FBBF24", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⭐ Xem Reviews</button>
                  </div>
                ))}
              </div>
              {apps.length > pageSize && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, fontSize: 13, color: "#94A3B8" }}>
                  <span>{(appPage - 1) * pageSize + 1}–{Math.min(appPage * pageSize, apps.length)} / {apps.length}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button disabled={appPage <= 1} onClick={() => setAppPage(p => p - 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)", background: appPage <= 1 ? "transparent" : "rgba(245,158,11,0.1)", color: appPage <= 1 ? "#475569" : "#FBBF24", cursor: appPage <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
                    <span>{appPage} / {Math.ceil(apps.length / pageSize)}</span>
                    <button disabled={appPage >= Math.ceil(apps.length / pageSize)} onClick={() => setAppPage(p => p + 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)", background: appPage >= Math.ceil(apps.length / pageSize) ? "transparent" : "rgba(245,158,11,0.1)", color: appPage >= Math.ceil(apps.length / pageSize) ? "#475569" : "#FBBF24", cursor: appPage >= Math.ceil(apps.length / pageSize) ? "default" : "pointer", fontSize: 12 }}>▶</button>
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
              <div className="form-group"><label>App ID (Track ID) <span style={{ color: "#EF4444" }}>*</span></label><input value={reviewAppId} onChange={e => setReviewAppId(e.target.value)} placeholder="VD: 389801252" onKeyDown={e => e.key === "Enter" && handleFetchReviews()} /></div>
              <div className="form-group"><label>Số trang (~50 reviews/trang)</label><input type="number" value={maxPages} onChange={e => setMaxPages(Number(e.target.value))} min={1} max={10} /></div>
            </div>
            <button className="btn-submit" onClick={() => handleFetchReviews()} disabled={loading}>{loading ? "⏳ Đang cào..." : "⭐ Cào Reviews"}</button>
          </div>
          {reviews.length > 0 && (
            <div className="results-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2>Reviews: {reviews.length}</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => exportCSV(reviews, "reviews")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.1)", color: "#FBBF24", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ CSV</button>
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
                    {r.title && <div style={{ fontWeight: 600, color: "#F1F5F9", fontSize: 13, marginBottom: 4 }}>{r.title}</div>}
                    <p style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.5, margin: 0 }}>{r.content?.slice(0, 300)}</p>
                    <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "#64748B" }}>
                      {r.appVersion && <span>v{r.appVersion}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {reviews.length > pageSize && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, fontSize: 13, color: "#94A3B8" }}>
                  <span>{(revPage - 1) * pageSize + 1}–{Math.min(revPage * pageSize, reviews.length)} / {reviews.length}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button disabled={revPage <= 1} onClick={() => setRevPage(p => p - 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)", background: revPage <= 1 ? "transparent" : "rgba(245,158,11,0.1)", color: revPage <= 1 ? "#475569" : "#FBBF24", cursor: revPage <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
                    <span>{revPage} / {Math.ceil(reviews.length / pageSize)}</span>
                    <button disabled={revPage >= Math.ceil(reviews.length / pageSize)} onClick={() => setRevPage(p => p + 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)", background: revPage >= Math.ceil(reviews.length / pageSize) ? "transparent" : "rgba(245,158,11,0.1)", color: revPage >= Math.ceil(reviews.length / pageSize) ? "#475569" : "#FBBF24", cursor: revPage >= Math.ceil(reviews.length / pageSize) ? "default" : "pointer", fontSize: 12 }}>▶</button>
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
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#64748B" }}><div style={{ fontSize: 48, marginBottom: 12 }}>📜</div><p>Chưa có lịch sử quét nào</p></div>
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
                  {history.slice((histPage - 1) * histPerPage, histPage * histPerPage).map((task: any) => (
                    <tr key={task._id} style={{ background: "rgba(15,23,42,0.5)" }}>
                      <td style={{ padding: "10px 12px", borderRadius: "8px 0 0 8px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: task.scan_type === "search" ? "rgba(245,158,11,0.15)" : "rgba(168,85,247,0.15)", color: task.scan_type === "search" ? "#FBBF24" : "#A78BFA" }}>
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
                          <button onClick={() => { let res: any[] = []; if (task.scan_type === "reviews" && task.result?.reviews_by_rating) { for (const k of Object.keys(task.result.reviews_by_rating)) res.push(...(task.result.reviews_by_rating[k] || [])); } else { res = Array.isArray(task.result) ? task.result : [task.result]; } setHistResults(res); setHistScanType(task.scan_type); setHistResPage(1); setTimeout(() => histResultRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.1)", color: "#FBBF24", cursor: "pointer", fontSize: 12 }}>👁 Xem</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length > histPerPage && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 13, color: "#94A3B8" }}>
                  <span>{(histPage - 1) * histPerPage + 1}–{Math.min(histPage * histPerPage, history.length)} / {history.length}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button disabled={histPage <= 1} onClick={() => setHistPage(p => p - 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)", background: histPage <= 1 ? "transparent" : "rgba(245,158,11,0.1)", color: histPage <= 1 ? "#475569" : "#FBBF24", cursor: histPage <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
                    <span>{histPage} / {Math.ceil(history.length / histPerPage)}</span>
                    <button disabled={histPage >= Math.ceil(history.length / histPerPage)} onClick={() => setHistPage(p => p + 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)", background: histPage >= Math.ceil(history.length / histPerPage) ? "transparent" : "rgba(245,158,11,0.1)", color: histPage >= Math.ceil(history.length / histPerPage) ? "#475569" : "#FBBF24", cursor: histPage >= Math.ceil(history.length / histPerPage) ? "default" : "pointer", fontSize: 12 }}>▶</button>
                  </div>
                </div>
              )}
            </>
          )}
          {histResults.length > 0 && (
            <div ref={histResultRef} style={{ marginTop: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Kết quả: {histResults.length} {histScanType === "search" ? "app" : "reviews"}</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => exportCSV(histResults, "history")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.1)", color: "#FBBF24", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ CSV</button>
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
                          {(app.artworkUrl100 || app.icon) && <img src={app.artworkUrl100 || app.icon} alt="" style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                          <div style={{ overflow: "hidden" }}>
                            <div style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 14 }}>{app.trackName || app.title || ""}</div>
                            <div style={{ fontSize: 12, color: "#94A3B8" }}>{app.artistName || app.developer || ""}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#64748B" }}>
                          <span>⭐ {app.averageUserRating || app.score || 0}</span>
                          <span>💬 {(app.userRatingCount || app.ratings || 0).toLocaleString()}</span>
                          <span>{app.primaryGenreName || app.genre || ""}</span>
                          <span>{app.formattedPrice || "Free"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {histResults.length > pageSize && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, fontSize: 13, color: "#94A3B8" }}>
                      <span>{(histResPage - 1) * pageSize + 1}–{Math.min(histResPage * pageSize, histResults.length)} / {histResults.length}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button disabled={histResPage <= 1} onClick={() => setHistResPage(p => p - 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)", background: histResPage <= 1 ? "transparent" : "rgba(245,158,11,0.1)", color: histResPage <= 1 ? "#475569" : "#FBBF24", cursor: histResPage <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
                        <span>{histResPage} / {Math.ceil(histResults.length / pageSize)}</span>
                        <button disabled={histResPage >= Math.ceil(histResults.length / pageSize)} onClick={() => setHistResPage(p => p + 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)", background: histResPage >= Math.ceil(histResults.length / pageSize) ? "transparent" : "rgba(245,158,11,0.1)", color: histResPage >= Math.ceil(histResults.length / pageSize) ? "#475569" : "#FBBF24", cursor: histResPage >= Math.ceil(histResults.length / pageSize) ? "default" : "pointer", fontSize: 12 }}>▶</button>
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
                        {r.title && <div style={{ fontWeight: 600, color: "#F1F5F9", fontSize: 13, marginBottom: 4 }}>{r.title}</div>}
                        <p style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.5, margin: 0 }}>{(r.content || "").slice(0, 300)}</p>
                        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "#64748B" }}>
                          {r.appVersion && <span>v{r.appVersion}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {histResults.length > pageSize && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, fontSize: 13, color: "#94A3B8" }}>
                      <span>{(histResPage - 1) * pageSize + 1}–{Math.min(histResPage * pageSize, histResults.length)} / {histResults.length}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button disabled={histResPage <= 1} onClick={() => setHistResPage(p => p - 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)", background: histResPage <= 1 ? "transparent" : "rgba(245,158,11,0.1)", color: histResPage <= 1 ? "#475569" : "#FBBF24", cursor: histResPage <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
                        <span>{histResPage} / {Math.ceil(histResults.length / pageSize)}</span>
                        <button disabled={histResPage >= Math.ceil(histResults.length / pageSize)} onClick={() => setHistResPage(p => p + 1)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)", background: histResPage >= Math.ceil(histResults.length / pageSize) ? "transparent" : "rgba(245,158,11,0.1)", color: histResPage >= Math.ceil(histResults.length / pageSize) ? "#475569" : "#FBBF24", cursor: histResPage >= Math.ceil(histResults.length / pageSize) ? "default" : "pointer", fontSize: 12 }}>▶</button>
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
