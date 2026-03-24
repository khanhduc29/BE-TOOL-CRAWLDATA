"use client";

import { useState, useEffect, useCallback } from "react";

const API = "/api/proxy";

const TOOLS = [
  { key: "", label: "Tất cả", icon: "📋" },
  { key: "tiktok", label: "TikTok", icon: "🎵", color: "#00F2EA" },
  { key: "twitter", label: "X (Twitter)", icon: "𝕏", color: "#1D9BF0" },
  { key: "instagram", label: "Instagram", icon: "📸", color: "#E1306C" },
  { key: "youtube", label: "YouTube", icon: "▶️", color: "#FF0000" },
  { key: "pinterest", label: "Pinterest", icon: "📌", color: "#E60023" },
  { key: "google-map", label: "Google Maps", icon: "🗺️", color: "#4285F4" },
  { key: "chplay", label: "CH Play", icon: "🛒", color: "#01875F" },
  { key: "appstore", label: "App Store", icon: "🍎", color: "#0D96F6" },
];

type Worker = {
  _id: string;
  worker_id: string;
  tool: string;
  hostname: string;
  status: string;
  last_heartbeat: string;
  tasks_completed: number;
  tasks_error: number;
  config?: { cpu?: number; ram?: number };
  createdAt?: string;
};

export default function WorkersSettingsPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  // Register form
  const [showForm, setShowForm] = useState(false);
  const [formWorkerId, setFormWorkerId] = useState("");
  const [formTool, setFormTool] = useState("tiktok");
  const [formHostname, setFormHostname] = useState("");
  const [registering, setRegistering] = useState(false);

  const flash = (text: string, type: "ok" | "err" = "ok") => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 4000);
  };

  const fetchWorkers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.set("tool", filter);
      const res = await fetch(`${API}/workers/list?${params}`);
      const json = await res.json();
      if (json.success) setWorkers(json.data || []);
    } catch { /* ignore */ }
  }, [filter]);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(fetchWorkers, 10000);
    return () => clearInterval(interval);
  }, [fetchWorkers]);

  const handleRegister = async () => {
    if (!formWorkerId.trim()) { flash("Worker ID là bắt buộc", "err"); return; }
    setRegistering(true);
    try {
      const res = await fetch(`${API}/workers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker_id: formWorkerId.trim(),
          tool: formTool,
          hostname: formHostname.trim() || "manual",
        }),
      });
      const json = await res.json();
      if (json.success) {
        flash("✅ Worker đã được đăng ký!");
        setFormWorkerId(""); setFormHostname(""); setShowForm(false);
        fetchWorkers();
      } else {
        flash(`❌ ${json.message}`, "err");
      }
    } catch (err: any) {
      flash(`❌ ${err?.message}`, "err");
    } finally { setRegistering(false); }
  };

  const handleDelete = async (workerId: string) => {
    if (!confirm(`Xóa worker "${workerId}"?`)) return;
    try {
      const res = await fetch(`${API}/workers/${workerId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) { flash("🗑 Đã xóa worker!"); fetchWorkers(); }
      else flash(`❌ ${json.message}`, "err");
    } catch { flash("❌ Lỗi xóa worker", "err"); }
  };

  const getToolInfo = (key: string) => TOOLS.find(t => t.key === key) || { key, label: key, icon: "🔧", color: "#94A3B8" };

  const isOnline = (w: Worker) => {
    if (w.status !== "online") return false;
    if (!w.last_heartbeat) return false;
    const diff = Date.now() - new Date(w.last_heartbeat).getTime();
    return diff < 90_000; // 90s
  };

  const formatTime = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s trước`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h trước`;
    return d.toLocaleDateString("vi-VN");
  };

  const onlineCount = workers.filter(isOnline).length;

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h1>⚙️ Quản lý Workers</h1>
        <p>Xem, đăng ký, và quản lý các worker đang kết nối với hệ thống</p>
      </div>

      {/* Message */}
      {msg && (
        <div style={{
          padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600,
          background: msgType === "ok" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          color: msgType === "ok" ? "#4ade80" : "#f87171",
          border: `1px solid ${msgType === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
        }}>{msg}</div>
      )}

      {/* Stats bar */}
      <div style={{
        display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap",
      }}>
        <div style={{
          padding: "12px 20px", borderRadius: 12, background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 24 }}>🟢</span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#4ade80" }}>{onlineCount}</div>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>Online</div>
          </div>
        </div>
        <div style={{
          padding: "12px 20px", borderRadius: 12, background: "rgba(148,163,184,0.1)",
          border: "1px solid rgba(148,163,184,0.15)", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 24 }}>📊</span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#CBD5E1" }}>{workers.length}</div>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>Tổng Workers</div>
          </div>
        </div>
      </div>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#94A3B8" }}>Lọc:</span>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ background: "#1E293B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", color: "#CBD5E1", fontSize: 13 }}>
            {TOOLS.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
          </select>
        </div>
        <button onClick={() => { setShowForm(!showForm); setFormWorkerId(""); setFormHostname(""); }} style={{
          padding: "8px 20px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer",
          background: "linear-gradient(135deg, #6366F1, #8B5CF6)", color: "#fff",
        }}>+ Đăng ký Worker</button>
      </div>

      {/* Register form */}
      {showForm && (
        <div className="tool-form" style={{ marginBottom: 20, border: "1px solid rgba(139,92,246,0.3)", borderRadius: 12 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "#A78BFA" }}>➕ Đăng ký Worker mới</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Worker ID <span style={{ color: "#EF4444" }}>*</span></label>
              <input value={formWorkerId} onChange={e => setFormWorkerId(e.target.value)} placeholder="VD: tiktok-server-1" />
            </div>
            <div className="form-group">
              <label>Tool <span style={{ color: "#EF4444" }}>*</span></label>
              <select value={formTool} onChange={e => setFormTool(e.target.value)}>
                {TOOLS.filter(t => t.key).map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Hostname</label>
              <input value={formHostname} onChange={e => setFormHostname(e.target.value)} placeholder="VD: server-01" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={handleRegister} disabled={registering} className="btn-submit" style={{ flex: 1 }}>
              {registering ? "⏳ Đang đăng ký..." : "✅ Đăng ký"}
            </button>
            <button onClick={() => setShowForm(false)} style={{
              padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent", color: "#94A3B8", cursor: "pointer", fontSize: 14,
            }}>Hủy</button>
          </div>
        </div>
      )}

      {/* Workers table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
          <thead>
            <tr style={{ fontSize: 12, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Worker ID</th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Tool</th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>Trạng thái</th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Hostname</th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>Last Heartbeat</th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>Tasks Done</th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>Tasks Error</th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {workers.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#64748B" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚙️</div>
                Chưa có worker nào. Workers tự đăng ký khi kết nối hoặc bấm &quot;Đăng ký Worker&quot;.
              </td></tr>
            )}
            {workers.map(w => {
              const t = getToolInfo(w.tool);
              const online = isOnline(w);
              return (
                <tr key={w._id} style={{ background: "rgba(15,23,42,0.5)", borderRadius: 8 }}>
                  <td style={{ padding: "10px 12px", borderRadius: "8px 0 0 8px", fontWeight: 600, color: "#F1F5F9", fontSize: 14 }}>
                    {w.worker_id}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "4px 10px", borderRadius: 16, fontSize: 13, fontWeight: 600,
                      background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}30`,
                    }}>
                      {t.icon} {t.label}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <span style={{
                      padding: "3px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: online ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      color: online ? "#4ade80" : "#f87171",
                      border: `1px solid ${online ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                    }}>
                      {online ? "🟢 Online" : "🔴 Offline"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94A3B8", fontSize: 13 }}>{w.hostname || "—"}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                    {formatTime(w.last_heartbeat)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center", color: "#4ade80", fontWeight: 600 }}>
                    {w.tasks_completed || 0}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center", color: "#f87171", fontWeight: 600 }}>
                    {w.tasks_error || 0}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center", borderRadius: "0 8px 8px 0" }}>
                    <button onClick={() => handleDelete(w.worker_id)} style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                      border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#f87171",
                    }}>🗑 Xóa</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Info box */}
      <div style={{
        marginTop: 24, padding: 16, borderRadius: 12,
        background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <h4 style={{ margin: "0 0 8px", color: "#A78BFA", fontSize: 14 }}>📋 Hướng dẫn Worker</h4>
        <ul style={{ margin: 0, paddingLeft: 20, color: "#94A3B8", fontSize: 13, lineHeight: 1.8 }}>
          <li>Worker tự đăng ký khi gọi API <code style={{ color: "#60a5fa" }}>/task/pending?worker_id=xxx</code></li>
          <li>Heartbeat timeout: <strong>90 giây</strong> — worker offline nếu không gửi heartbeat</li>
          <li>Trong GUI Desktop: set <code style={{ color: "#60a5fa" }}>worker_id</code> trong config.json</li>
          <li>Khi chạy crawler riêng: set env <code style={{ color: "#60a5fa" }}>WORKER_ID=your-id</code></li>
          <li>Task sẽ được phân theo round-robin cho các worker online</li>
        </ul>
      </div>
    </div>
  );
}
