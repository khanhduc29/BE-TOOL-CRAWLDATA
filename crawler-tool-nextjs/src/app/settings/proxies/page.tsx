"use client";

import { authFetch } from "@/utils/authFetch";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const API = "/api/proxy";

const PROTOCOL_OPTS = [
  { key: "http", label: "HTTP" },
  { key: "https", label: "HTTPS" },
  { key: "socks5", label: "SOCKS5" },
];

const STATUS_OPTS = [
  { key: "active", label: "✅ Active", color: "#4ade80" },
  { key: "inactive", label: "⏸ Inactive", color: "#94A3B8" },
  { key: "dead", label: "💀 Dead", color: "#f87171" },
];

type Proxy = {
  _id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  protocol: string;
  country: string;
  city: string;
  status: string;
  label: string;
  last_checked: string | null;
  response_time_ms: number | null;
  createdAt: string;
};

const emptyForm = {
  host: "",
  port: "",
  username: "",
  password: "",
  protocol: "http",
  country: "",
  city: "",
  label: "",
  status: "active",
};

export default function ProxySettingsPage() {
  const { user } = useAuth();
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");

  const flash = (text: string, type: "ok" | "err" = "ok") => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 4000);
  };

  const fetchProxies = useCallback(async () => {
    try {
      const url = filterStatus
        ? `${API}/proxies?status=${filterStatus}`
        : `${API}/proxies`;
      const res = await authFetch(url);
      const json = await res.json();
      if (json.success) setProxies(json.data);
    } catch {
      /* ignore */
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchProxies();
  }, [fetchProxies]);

  // ===== SINGLE ADD/EDIT =====
  const handleSubmit = async () => {
    if (!form.host.trim() || !form.port) {
      flash("Host và Port là bắt buộc", "err");
      return;
    }
    setLoading(true);
    try {
      const url = editId
        ? `${API}/proxies/${editId}`
        : `${API}/proxies`;
      const method = editId ? "PATCH" : "POST";
      const body = { ...form, port: Number(form.port) };
      if (body.password === "••••••••") delete (body as any).password;

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        flash(editId ? "✅ Cập nhật thành công!" : "✅ Thêm proxy thành công!");
        setForm({ ...emptyForm });
        setEditId(null);
        setShowForm(false);
        fetchProxies();
      } else {
        flash(`❌ ${json.message}`, "err");
      }
    } catch (err: any) {
      flash(`❌ ${err?.message}`, "err");
    } finally {
      setLoading(false);
    }
  };

  // ===== BULK IMPORT =====
  const handleBulkImport = async () => {
    const lines = bulkText
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      flash("Vui lòng paste proxy theo format host:port:user:pass", "err");
      return;
    }

    const parsedProxies = lines
      .map((line) => {
        const parts = line.split(":");
        if (parts.length < 2) return null;
        return {
          host: parts[0],
          port: Number(parts[1]),
          username: parts[2] || "",
          password: parts[3] || "",
          protocol: "http",
          status: "active",
        };
      })
      .filter(Boolean);

    if (parsedProxies.length === 0) {
      flash("Không parse được proxy nào", "err");
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch(`${API}/proxies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxies: parsedProxies }),
      });
      const json = await res.json();
      if (json.success) {
        flash(`✅ Imported ${json.data?.length || 0} proxies!`);
        setBulkText("");
        setShowBulk(false);
        fetchProxies();
      } else {
        flash(`❌ ${json.message}`, "err");
      }
    } catch (err: any) {
      flash(`❌ ${err?.message}`, "err");
    } finally {
      setLoading(false);
    }
  };

  // ===== EDIT =====
  const handleEdit = (p: Proxy) => {
    setForm({
      host: p.host,
      port: String(p.port),
      username: p.username || "",
      password: p.password || "",
      protocol: p.protocol || "http",
      country: p.country || "",
      city: p.city || "",
      label: p.label || "",
      status: p.status || "active",
    });
    setEditId(p._id);
    setShowForm(true);
    setShowBulk(false);
  };

  // ===== DELETE =====
  const handleDelete = async (id: string) => {
    if (!confirm("Xóa proxy này?")) return;
    try {
      const res = await authFetch(`${API}/proxies/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        flash("🗑 Đã xóa!");
        fetchProxies();
      }
    } catch {
      flash("❌ Lỗi xóa", "err");
    }
  };

  // ===== BULK DELETE =====
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Xóa ${selectedIds.size} proxy đã chọn?`)) return;
    try {
      const res = await authFetch(`${API}/proxies/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (json.success) {
        flash(`🗑 Đã xóa ${json.data?.deleted_count || 0} proxies!`);
        setSelectedIds(new Set());
        fetchProxies();
      }
    } catch {
      flash("❌ Lỗi xóa", "err");
    }
  };

  // ===== CHECK PROXY =====
  const handleCheck = async (id: string) => {
    setCheckingId(id);
    try {
      const res = await authFetch(`${API}/proxies/check/${id}`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        flash(
          json.alive
            ? `✅ Proxy working! (${json.response_time_ms}ms)`
            : "💀 Proxy dead!"
        );
        fetchProxies();
      }
    } catch {
      flash("❌ Lỗi check proxy", "err");
    } finally {
      setCheckingId(null);
    }
  };

  // ===== CHECK ALL =====
  const handleCheckAll = async () => {
    setLoading(true);
    let alive = 0;
    let dead = 0;
    for (const p of proxies) {
      setCheckingId(p._id);
      try {
        const res = await authFetch(`${API}/proxies/check/${p._id}`, {
          method: "POST",
        });
        const json = await res.json();
        if (json.alive) alive++;
        else dead++;
      } catch {
        dead++;
      }
    }
    setCheckingId(null);
    flash(`✅ Check xong: ${alive} working, ${dead} dead`);
    fetchProxies();
    setLoading(false);
  };

  const handleCancel = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setShowForm(false);
    setShowBulk(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === proxies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(proxies.map((p) => p._id)));
    }
  };

  const st = (key: string) =>
    STATUS_OPTS.find((s) => s.key === key) || STATUS_OPTS[0];

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h1>🌐 Quản lý Proxy</h1>
        <p>Thêm, sửa, xóa và kiểm tra proxy cho hệ thống crawler</p>
      </div>

      {/* Settings tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          background: "rgba(15,23,42,0.5)",
          padding: 4,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.06)",
          width: "fit-content",
        }}
      >
        {[
          { href: "/settings/accounts", label: "🔐 Tài khoản" },
          { href: "/settings/proxies", label: "🌐 Proxy", active: true },
          { href: "/settings/workers", label: "🤖 Workers" },
          ...(user?.role === "admin" ? [{ href: "/settings/users", label: "👥 Users" }] : []),
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              color: tab.active ? "#fff" : "#94A3B8",
              background: tab.active
                ? "linear-gradient(135deg, #6366F1, #8B5CF6)"
                : "transparent",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
            fontWeight: 600,
            background:
              msgType === "ok"
                ? "rgba(34,197,94,0.15)"
                : "rgba(239,68,68,0.15)",
            color: msgType === "ok" ? "#4ade80" : "#f87171",
            border: `1px solid ${
              msgType === "ok"
                ? "rgba(34,197,94,0.3)"
                : "rgba(239,68,68,0.3)"
            }`,
          }}
        >
          {msg}
        </div>
      )}

      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#94A3B8" }}>Lọc:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              background: "#1E293B",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "6px 12px",
              color: "#CBD5E1",
              fontSize: 13,
            }}
          >
            <option value="">Tất cả</option>
            {STATUS_OPTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 13, color: "#64748B" }}>
            {proxies.length} proxy
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid rgba(239,68,68,0.3)",
                background: "rgba(239,68,68,0.1)",
                color: "#f87171",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              🗑 Xóa {selectedIds.size} đã chọn
            </button>
          )}
          <button
            onClick={handleCheckAll}
            disabled={loading || proxies.length === 0}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(34,197,94,0.3)",
              background: "rgba(34,197,94,0.1)",
              color: "#4ade80",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "⏳ Đang check..." : "🔍 Check All"}
          </button>
          <button
            onClick={() => {
              setShowBulk(!showBulk);
              setShowForm(false);
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(251,191,36,0.3)",
              background: "rgba(251,191,36,0.1)",
              color: "#fbbf24",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            📋 Bulk Import
          </button>
          <button
            onClick={() => {
              handleCancel();
              setShowForm(true);
            }}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              color: "#fff",
            }}
          >
            + Thêm proxy
          </button>
        </div>
      </div>

      {/* ===== BULK IMPORT ===== */}
      {showBulk && (
        <div
          className="tool-form"
          style={{
            marginBottom: 20,
            border: "1px solid rgba(251,191,36,0.3)",
            borderRadius: 12,
          }}
        >
          <h3
            style={{ margin: "0 0 12px", fontSize: 16, color: "#fbbf24" }}
          >
            📋 Bulk Import Proxy
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "#94A3B8",
              margin: "0 0 12px",
              lineHeight: 1.6,
            }}
          >
            Paste mỗi proxy một dòng, theo format:{" "}
            <code
              style={{
                background: "rgba(139,92,246,0.15)",
                padding: "2px 6px",
                borderRadius: 4,
                color: "#A78BFA",
              }}
            >
              host:port:username:password
            </code>
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`31.59.20.176:6754:xnpzlsob:luv6ibvs6622\n23.95.150.145:6114:xnpzlsob:luv6ibvs6622\n198.23.239.134:6540:xnpzlsob:luv6ibvs6622`}
            rows={8}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(15,23,42,0.5)",
              color: "#CBD5E1",
              fontSize: 13,
              fontFamily: "monospace",
              resize: "vertical",
              marginBottom: 12,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleBulkImport}
              disabled={loading}
              className="btn-submit"
              style={{ flex: 1 }}
            >
              {loading ? "⏳ Importing..." : `📥 Import ${bulkText.trim().split("\n").filter(Boolean).length} proxy`}
            </button>
            <button
              onClick={() => {
                setShowBulk(false);
                setBulkText("");
              }}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "#94A3B8",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* ===== ADD/EDIT FORM ===== */}
      {showForm && (
        <div
          className="tool-form"
          style={{
            marginBottom: 20,
            border: "1px solid rgba(139,92,246,0.3)",
            borderRadius: 12,
          }}
        >
          <h3
            style={{ margin: "0 0 16px", fontSize: 16, color: "#A78BFA" }}
          >
            {editId ? "✏️ Sửa proxy" : "➕ Thêm proxy mới"}
          </h3>

          {/* Host + Port + Protocol */}
          <div className="form-row">
            <div className="form-group">
              <label>
                Host / IP <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="31.59.20.176"
              />
            </div>
            <div className="form-group">
              <label>
                Port <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
                placeholder="6754"
                type="number"
              />
            </div>
            <div className="form-group">
              <label>Protocol</label>
              <select
                value={form.protocol}
                onChange={(e) =>
                  setForm({ ...form, protocol: e.target.value })
                }
              >
                {PROTOCOL_OPTS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Username + Password */}
          <div className="form-row">
            <div className="form-group">
              <label>Username</label>
              <input
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value })
                }
                placeholder="xnpzlsob"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Country + City + Status + Label */}
          <div className="form-row">
            <div className="form-group">
              <label>Country</label>
              <input
                value={form.country}
                onChange={(e) =>
                  setForm({ ...form, country: e.target.value })
                }
                placeholder="United Kingdom"
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="London"
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value })
                }
              >
                {STATUS_OPTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Nhãn</label>
              <input
                value={form.label}
                onChange={(e) =>
                  setForm({ ...form, label: e.target.value })
                }
                placeholder="VD: Proxy US, Proxy UK"
              />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-submit"
              style={{ flex: 1 }}
            >
              {loading
                ? "⏳ Đang lưu..."
                : editId
                ? "💾 Cập nhật"
                : "💾 Thêm"}
            </button>
            <button
              onClick={handleCancel}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "#94A3B8",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* ===== PROXY TABLE ===== */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: "0 4px",
          }}
        >
          <thead>
            <tr
              style={{
                fontSize: 12,
                color: "#64748B",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <th style={{ padding: "8px 12px", textAlign: "center", width: 40 }}>
                <input
                  type="checkbox"
                  checked={
                    proxies.length > 0 &&
                    selectedIds.size === proxies.length
                  }
                  onChange={toggleSelectAll}
                  style={{ cursor: "pointer" }}
                />
              </th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>
                Proxy
              </th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>
                Auth
              </th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>
                Protocol
              </th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>
                Status
              </th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>
                Location
              </th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>
                Speed
              </th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>
                Last Check
              </th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {proxies.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "#64748B",
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🌐</div>
                  Chưa có proxy nào. Bấm &quot;Thêm proxy&quot; hoặc
                  &quot;Bulk Import&quot; để bắt đầu.
                </td>
              </tr>
            )}
            {proxies.map((p) => {
              const status = st(p.status);
              return (
                <tr
                  key={p._id}
                  style={{
                    background: "rgba(15,23,42,0.5)",
                    borderRadius: 8,
                    transition: "background 0.2s",
                  }}
                >
                  {/* Checkbox */}
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "center",
                      borderRadius: "8px 0 0 8px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p._id)}
                      onChange={() => toggleSelect(p._id)}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                  {/* Proxy host:port */}
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontWeight: 700,
                        color: "#F1F5F9",
                        fontSize: 14,
                      }}
                    >
                      {p.host}
                    </span>
                    <span
                      style={{
                        color: "#6366F1",
                        fontWeight: 700,
                        marginLeft: 2,
                      }}
                    >
                      :{p.port}
                    </span>
                  </td>
                  {/* Auth */}
                  <td style={{ padding: "10px 12px" }}>
                    {p.username ? (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: "rgba(34,197,94,0.15)",
                          color: "#4ade80",
                          border: "1px solid rgba(34,197,94,0.2)",
                        }}
                      >
                        🔑 {p.username}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#475569" }}>
                        No auth
                      </span>
                    )}
                  </td>
                  {/* Protocol */}
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontWeight: 600,
                        background: "rgba(99,102,241,0.15)",
                        color: "#818CF8",
                        border: "1px solid rgba(99,102,241,0.2)",
                        textTransform: "uppercase",
                      }}
                    >
                      {p.protocol}
                    </span>
                  </td>
                  {/* Status */}
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontWeight: 600,
                        background: `${status.color}15`,
                        color: status.color,
                        border: `1px solid ${status.color}30`,
                      }}
                    >
                      {status.label}
                    </span>
                  </td>
                  {/* Location */}
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "#94A3B8",
                      fontSize: 13,
                    }}
                  >
                    {p.country || p.city
                      ? `${p.city ? p.city + ", " : ""}${p.country}`
                      : "—"}
                  </td>
                  {/* Speed */}
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "center",
                      fontSize: 13,
                      fontFamily: "monospace",
                      color: p.response_time_ms
                        ? p.response_time_ms < 1000
                          ? "#4ade80"
                          : p.response_time_ms < 3000
                          ? "#fbbf24"
                          : "#f87171"
                        : "#475569",
                    }}
                  >
                    {p.response_time_ms
                      ? `${p.response_time_ms}ms`
                      : "—"}
                  </td>
                  {/* Last check */}
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "center",
                      fontSize: 12,
                      color: "#64748B",
                    }}
                  >
                    {p.last_checked
                      ? new Date(p.last_checked).toLocaleString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })
                      : "—"}
                  </td>
                  {/* Actions */}
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "center",
                      borderRadius: "0 8px 8px 0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        justifyContent: "center",
                      }}
                    >
                      <button
                        onClick={() => handleCheck(p._id)}
                        disabled={checkingId === p._id}
                        title="Check proxy"
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: "pointer",
                          border: "1px solid rgba(34,197,94,0.3)",
                          background: "rgba(34,197,94,0.1)",
                          color: "#4ade80",
                          opacity: checkingId === p._id ? 0.5 : 1,
                        }}
                      >
                        {checkingId === p._id ? "⏳" : "🔍"}
                      </button>
                      <button
                        onClick={() => handleEdit(p)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: "pointer",
                          border: "1px solid rgba(59,130,246,0.3)",
                          background: "rgba(59,130,246,0.1)",
                          color: "#60A5FA",
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(p._id)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: "pointer",
                          border: "1px solid rgba(239,68,68,0.3)",
                          background: "rgba(239,68,68,0.1)",
                          color: "#f87171",
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Info box */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 12,
          background: "rgba(15,23,42,0.5)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <h4
          style={{ margin: "0 0 8px", color: "#A78BFA", fontSize: 14 }}
        >
          💡 Hướng dẫn sử dụng proxy
        </h4>
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            color: "#94A3B8",
            fontSize: 13,
            lineHeight: 1.8,
          }}
        >
          <li>
            <strong>Bulk Import:</strong> Paste proxy theo format{" "}
            <code
              style={{
                background: "rgba(139,92,246,0.15)",
                padding: "1px 5px",
                borderRadius: 4,
                color: "#A78BFA",
              }}
            >
              host:port:username:password
            </code>{" "}
            — mỗi dòng 1 proxy
          </li>
          <li>
            <strong>Check proxy:</strong> Bấm 🔍 để kiểm tra proxy có
            hoạt động không (gọi httpbin.org qua proxy)
          </li>
          <li>
            <strong>Proxy sẽ được sử dụng:</strong> Khi crawler chạy, hệ
            thống sẽ tự động chọn ngẫu nhiên 1 proxy active để dùng
          </li>
          <li>
            Proxy hỗ trợ 3 protocol:{" "}
            <strong>HTTP</strong>, <strong>HTTPS</strong>, và{" "}
            <strong>SOCKS5</strong>
          </li>
        </ul>
      </div>
    </div>
  );
}
