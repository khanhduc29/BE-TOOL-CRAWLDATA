"use client";

import { authFetch } from "@/utils/authFetch";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const API = "/api/proxy";

type User = {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export default function UsersManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("");
  const [saving, setSaving] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API}/auth/users`);
      const json = await res.json();
      if (json.success) {
        setUsers(json.data || []);
        setError("");
      } else {
        setError(json.message || "Không thể tải danh sách users");
      }
    } catch {
      setError("Không thể kết nối server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // === Actions ===
  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Bạn chắc chắn muốn xóa user "${userName}"?`)) return;
    try {
      const res = await authFetch(`${API}/auth/users/${userId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchUsers();
      } else {
        alert(json.message);
      }
    } catch {
      alert("Lỗi khi xóa user");
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    try {
      const res = await authFetch(`${API}/auth/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json();
      if (json.success) {
        fetchUsers();
      } else {
        alert(json.message);
      }
    } catch {
      alert("Lỗi khi cập nhật role");
    }
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditPassword("");
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      // Update info
      const body: Record<string, string> = {};
      if (editName !== editUser.name) body.name = editName;
      if (editEmail !== editUser.email) body.email = editEmail;
      if (editPassword) body.password = editPassword;

      if (Object.keys(body).length > 0) {
        await authFetch(`${API}/auth/users/${editUser._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      // Update role if changed
      if (editRole !== editUser.role) {
        await authFetch(`${API}/auth/users/${editUser._id}/role`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: editRole }),
        });
      }

      setEditUser(null);
      fetchUsers();
    } catch {
      alert("Lỗi khi cập nhật");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName || !newEmail || !newPassword) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }
    setCreating(true);
    try {
      const res = await authFetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword }),
      });
      const json = await res.json();
      if (json.success) {
        // If role is admin, update it
        if (newRole === "admin" && json.data?.user?._id) {
          await authFetch(`${API}/auth/users/${json.data.user._id}/role`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "admin" }),
          });
        }
        setShowCreate(false);
        setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("user");
        fetchUsers();
      } else {
        alert(json.message);
      }
    } catch {
      alert("Lỗi khi tạo user");
    } finally {
      setCreating(false);
    }
  };

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="tool-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Settings Nav */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { href: "/settings/accounts", label: "🔐 Tài khoản" },
          { href: "/settings/proxies", label: "🌐 Proxy" },
          { href: "/settings/workers", label: "💻 Workers" },
          { href: "/settings/users", label: "👥 Quản lý Users", active: true },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "8px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600,
              textDecoration: "none", transition: "all 0.2s",
              background: item.active ? "linear-gradient(135deg, #3B82F6, #8B5CF6)" : "rgba(30,41,59,0.8)",
              color: item.active ? "#fff" : "#94A3B8",
              border: `1px solid ${item.active ? "transparent" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: "#F1F5F9" }}>👥 Quản lý Users</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Quản lý tài khoản người dùng hệ thống</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
              background: "linear-gradient(135deg, #10B981, #059669)", color: "#fff", border: "none",
              boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
            }}
          >
            ➕ Thêm User
          </button>
        )}
      </div>

      {/* Access denied for non-admin */}
      {!isAdmin && (
        <div style={{
          padding: "40px", textAlign: "center", background: "rgba(239,68,68,0.1)",
          borderRadius: 16, border: "1px solid rgba(239,68,68,0.2)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h2 style={{ color: "#f87171", margin: 0 }}>Chỉ Admin mới có quyền truy cập</h2>
          <p style={{ color: "#94A3B8", marginTop: 8 }}>Vui lòng liên hệ admin để được cấp quyền.</p>
        </div>
      )}

      {/* Error */}
      {error && isAdmin && (
        <div style={{
          padding: 16, marginBottom: 16, borderRadius: 10,
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5",
        }}>
          ❌ {error}
        </div>
      )}

      {/* Users Table */}
      {isAdmin && !loading && (
        <div style={{
          background: "rgba(15,23,42,0.6)", borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
        }}>
          {/* Stats bar */}
          <div style={{
            display: "flex", gap: 20, padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(15,23,42,0.3)",
          }}>
            {[
              { label: "Tổng", value: users.length, color: "#60A5FA" },
              { label: "Admin", value: users.filter(u => u.role === "admin").length, color: "#F59E0B" },
              { label: "User", value: users.filter(u => u.role === "user").length, color: "#4ADE80" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#64748B" }}>{s.label}:</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "#64748B" }}>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>User</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Email</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Role</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Ngày tạo</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", display: "flex",
                        alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700,
                        background: u.role === "admin"
                          ? "linear-gradient(135deg, #F59E0B, #D97706)"
                          : "linear-gradient(135deg, #3B82F6, #2563EB)",
                        color: "#fff",
                      }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#F1F5F9", fontSize: 14 }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: "#475569" }}>
                          {u._id === currentUser?._id ? "👈 Bạn" : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#94A3B8", fontSize: 13 }}>{u.email}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: u.role === "admin" ? "rgba(245,158,11,0.15)" : "rgba(74,222,128,0.1)",
                      color: u.role === "admin" ? "#F59E0B" : "#4ADE80",
                      border: `1px solid ${u.role === "admin" ? "rgba(245,158,11,0.3)" : "rgba(74,222,128,0.2)"}`,
                    }}>
                      {u.role === "admin" ? "👑 Admin" : "👤 User"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "#64748B", fontSize: 12 }}>
                    {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button
                        onClick={() => openEdit(u)}
                        style={{
                          padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                          background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#60A5FA",
                        }}
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        onClick={() => handleToggleRole(u._id, u.role)}
                        disabled={u._id === currentUser?._id}
                        style={{
                          padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: u._id === currentUser?._id ? "not-allowed" : "pointer",
                          background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
                          color: "#F59E0B", opacity: u._id === currentUser?._id ? 0.4 : 1,
                        }}
                      >
                        {u.role === "admin" ? "⬇ User" : "⬆ Admin"}
                      </button>
                      <button
                        onClick={() => handleDelete(u._id, u.name)}
                        disabled={u._id === currentUser?._id}
                        style={{
                          padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: u._id === currentUser?._id ? "not-allowed" : "pointer",
                          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                          color: "#f87171", opacity: u._id === currentUser?._id ? 0.4 : 1,
                        }}
                      >
                        🗑 Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && loading && (
        <div style={{ textAlign: "center", padding: 60, color: "#64748B" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          Đang tải...
        </div>
      )}

      {/* === EDIT MODAL === */}
      {editUser && (
        <div onClick={() => setEditUser(null)} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#1E293B", borderRadius: 16, padding: 28, width: 420,
            border: "1px solid rgba(148,163,184,0.15)",
          }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#F1F5F9" }}>✏️ Chỉnh sửa User</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Họ tên</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                  background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9", outline: "none",
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Email</label>
                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                  background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9", outline: "none",
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Mật khẩu mới (bỏ trống = không đổi)</label>
                <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="••••••" style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                  background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9", outline: "none",
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Role</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                  background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9",
                }}>
                  <option value="user">👤 User</option>
                  <option value="admin">👑 Admin</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setEditUser(null)} style={{
                padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: "transparent", border: "1px solid rgba(148,163,184,0.3)", color: "#94A3B8",
              }}>
                Hủy
              </button>
              <button onClick={handleSaveEdit} disabled={saving} style={{
                padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", border: "none", color: "#fff",
              }}>
                {saving ? "⏳ Đang lưu..." : "💾 Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === CREATE MODAL === */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#1E293B", borderRadius: 16, padding: 28, width: 420,
            border: "1px solid rgba(148,163,184,0.15)",
          }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#F1F5F9" }}>➕ Tạo User mới</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Họ tên</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nguyễn Văn A" style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                  background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9", outline: "none",
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Email</label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                  background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9", outline: "none",
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Mật khẩu</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                  background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9", outline: "none",
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                  background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9",
                }}>
                  <option value="user">👤 User</option>
                  <option value="admin">👑 Admin</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowCreate(false)} style={{
                padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: "transparent", border: "1px solid rgba(148,163,184,0.3)", color: "#94A3B8",
              }}>
                Hủy
              </button>
              <button onClick={handleCreate} disabled={creating} style={{
                padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: "linear-gradient(135deg, #10B981, #059669)", border: "none", color: "#fff",
              }}>
                {creating ? "⏳ Đang tạo..." : "➕ Tạo User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
