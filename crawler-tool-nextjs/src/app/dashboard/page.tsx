"use client";

import { useState, useEffect, useCallback } from "react";

const API = "/api/proxy";

const TOOL_ICONS: Record<string, string> = {
  tiktok: "🎵",
  pinterest: "📌",
  instagram: "📷",
  youtube: "▶️",
  twitter: "𝕏",
  "google-map": "🗺️",
  chplay: "🛒",
  appstore: "🍎",
};

const TOOL_COLORS: Record<string, string> = {
  tiktok: "#00F2EA",
  pinterest: "#E60023",
  instagram: "#E1306C",
  youtube: "#FF0000",
  twitter: "#1DA1F2",
  "google-map": "#4285F4",
  chplay: "#01875F",
  appstore: "#0D96F6",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [throughput, setThroughput] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, wRes, tRes, lRes] = await Promise.all([
        fetch(`${API}/dashboard/stats`).then((r) => r.json()).catch(() => null),
        fetch(`${API}/dashboard/workers`).then((r) => r.json()).catch(() => null),
        fetch(`${API}/dashboard/throughput`).then((r) => r.json()).catch(() => null),
        fetch(`${API}/dashboard/logs?limit=50`).then((r) => r.json()).catch(() => null),
      ]);

      if (sRes?.success) setStats(sRes.data);
      if (wRes?.success) setWorkers(wRes.data || []);
      if (tRes?.success) setThroughput(tRes.data || []);
      if (lRes?.success) setLogs(lRes.data || []);
      setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const totals = stats?.totals || { pending: 0, running: 0, success: 0, error: 0 };
  const toolStats = stats?.tools || {};
  const queueStats = stats?.queues || {};

  // Throughput chart
  const maxThroughput = Math.max(1, ...throughput.map((t) => t.count));

  return (
    <div className="tool-page" style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, color: "#F1F5F9" }}>📊 Dashboard</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Theo dõi hệ thống crawler · Cập nhật mỗi 5s</p>
        </div>
        <div style={{ fontSize: 12, color: "#64748B", textAlign: "right" }}>
          <div>Cập nhật: {lastUpdated || "..."}</div>
          <button
            onClick={fetchAll}
            style={{
              marginTop: 4, padding: "4px 12px", borderRadius: 6, fontSize: 12,
              background: "rgba(59,130,246,0.15)", color: "#60A5FA",
              border: "1px solid rgba(59,130,246,0.3)", cursor: "pointer",
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* ===== OVERVIEW CARDS ===== */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Pending", value: totals.pending, color: "#FBBF24", bg: "rgba(251,191,36,0.12)", icon: "⏳" },
          { label: "Running", value: totals.running, color: "#60A5FA", bg: "rgba(96,165,250,0.12)", icon: "🔄" },
          { label: "Success (24h)", value: totals.success, color: "#4ADE80", bg: "rgba(74,222,128,0.12)", icon: "✅" },
          { label: "Error (24h)", value: totals.error, color: "#F87171", bg: "rgba(248,113,113,0.12)", icon: "❌" },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: card.bg, borderRadius: 14, padding: "18px 20px",
              border: `1px solid ${card.color}22`,
            }}
          >
            <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 6 }}>{card.icon} {card.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ===== PER-TOOL STATS TABLE ===== */}
      <div style={{ marginBottom: 24, background: "rgba(15,23,42,0.5)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 style={{ margin: 0, fontSize: 16, color: "#F1F5F9" }}>🔧 Task theo Tool</h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "#64748B" }}>
              <th style={{ padding: "10px 16px", textAlign: "left" }}>Tool</th>
              <th style={{ padding: "10px 16px", textAlign: "center" }}>Pending</th>
              <th style={{ padding: "10px 16px", textAlign: "center" }}>Running</th>
              <th style={{ padding: "10px 16px", textAlign: "center" }}>Success</th>
              <th style={{ padding: "10px 16px", textAlign: "center" }}>Error</th>
              <th style={{ padding: "10px 16px", textAlign: "center" }}>Queue</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(toolStats).map(([tool, s]: [string, any]) => (
              <tr key={tool} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <td style={{ padding: "10px 16px" }}>
                  <span style={{ marginRight: 6 }}>{TOOL_ICONS[tool] || "🔧"}</span>
                  <span style={{ color: TOOL_COLORS[tool] || "#94A3B8", fontWeight: 600, fontSize: 14 }}>
                    {tool}
                  </span>
                </td>
                <td style={{ textAlign: "center", color: "#FBBF24", fontWeight: 700 }}>{s.pending}</td>
                <td style={{ textAlign: "center", color: "#60A5FA", fontWeight: 700 }}>{s.running}</td>
                <td style={{ textAlign: "center", color: "#4ADE80", fontWeight: 700 }}>{s.success}</td>
                <td style={{ textAlign: "center", color: "#F87171", fontWeight: 700 }}>{s.error}</td>
                <td style={{ textAlign: "center", color: "#94A3B8", fontSize: 12 }}>
                  {queueStats[tool] ? `W:${queueStats[tool].waiting} A:${queueStats[tool].active}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Two-column layout: Workers + Throughput */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>

        {/* ===== WORKERS TABLE ===== */}
        <div style={{ background: "rgba(15,23,42,0.5)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <h2 style={{ margin: 0, fontSize: 16, color: "#F1F5F9" }}>💻 Workers ({workers.length})</h2>
          </div>
          {workers.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "#64748B" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔌</div>
              <p>Chưa có worker nào online</p>
              <p style={{ fontSize: 12 }}>Workers sẽ hiện khi bật tool trên CrawlerTool GUI</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#64748B" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Worker</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Status</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>CPU</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>RAM</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Tasks</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ marginRight: 4 }}>{TOOL_ICONS[w.tool] || "🔧"}</span>
                      <span style={{ color: "#CBD5E1", fontSize: 13 }}>{w.tool}</span>
                      <div style={{ fontSize: 10, color: "#475569" }}>{w.hostname}</div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{
                        display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                        background: w.online ? "#4ADE80" : "#EF4444",
                        boxShadow: w.online ? "0 0 6px #4ADE80" : "0 0 6px #EF4444",
                      }} />
                    </td>
                    <td style={{ textAlign: "center", fontSize: 12, color: "#94A3B8" }}>{w.cpu?.toFixed(1)}%</td>
                    <td style={{ textAlign: "center", fontSize: 12, color: "#94A3B8" }}>{w.ram?.toFixed(0)} MB</td>
                    <td style={{ textAlign: "center", fontSize: 12, color: "#60A5FA", fontWeight: 600 }}>{w.tasks_completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ===== THROUGHPUT CHART ===== */}
        <div style={{ background: "rgba(15,23,42,0.5)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <h2 style={{ margin: 0, fontSize: 16, color: "#F1F5F9" }}>📈 Throughput (tasks/phút)</h2>
          </div>
          <div style={{ padding: "16px 20px", height: 200, display: "flex", alignItems: "flex-end", gap: 1 }}>
            {throughput.length === 0 ? (
              <div style={{ width: "100%", textAlign: "center", color: "#64748B", paddingBottom: 60 }}>
                <p>Chưa có dữ liệu throughput</p>
              </div>
            ) : (
              throughput.slice(-30).map((t, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <div
                    style={{
                      width: "100%",
                      minHeight: t.count > 0 ? 4 : 1,
                      height: `${(t.count / maxThroughput) * 100}%`,
                      background: t.count > 0
                        ? "linear-gradient(to top, rgba(96,165,250,0.6), rgba(96,165,250,0.2))"
                        : "rgba(255,255,255,0.03)",
                      borderRadius: "3px 3px 0 0",
                      transition: "height 0.3s",
                    }}
                    title={`${t.label}: ${t.count} tasks`}
                  />
                </div>
              ))
            )}
          </div>
          {throughput.length > 0 && (
            <div style={{ padding: "4px 20px 10px", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569" }}>
              <span>{throughput.slice(-30)[0]?.label}</span>
              <span>{throughput[throughput.length - 1]?.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== LOGS ===== */}
      <div style={{ background: "rgba(15,23,42,0.5)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 style={{ margin: 0, fontSize: 16, color: "#F1F5F9" }}>📋 Logs gần đây</h2>
        </div>
        {logs.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#64748B" }}>
            <p>Chưa có logs</p>
          </div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#64748B", position: "sticky", top: 0, background: "#0F172A" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", width: 130 }}>Thời gian</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", width: 90 }}>Tool</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", width: 60 }}>Level</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const levelColor = log.level === "error" ? "#F87171" : log.level === "warning" ? "#FBBF24" : log.level === "success" ? "#4ADE80" : "#94A3B8";
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                      <td style={{ padding: "6px 12px", fontSize: 11, color: "#475569", fontFamily: "monospace" }}>
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString("vi-VN") : "—"}
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        <span style={{ fontSize: 11, color: TOOL_COLORS[log.tool] || "#94A3B8" }}>
                          {TOOL_ICONS[log.tool] || ""} {log.tool}
                        </span>
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: `${levelColor}15`, color: levelColor, fontWeight: 600 }}>
                          {log.level}
                        </span>
                      </td>
                      <td style={{ padding: "6px 12px", fontSize: 12, color: "#CBD5E1", maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.message}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
