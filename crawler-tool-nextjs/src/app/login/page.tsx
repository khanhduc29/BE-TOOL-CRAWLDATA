"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);
    if (!result.success) {
      setError(result.message || "Đăng nhập thất bại");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "calc(100vh - 64px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "linear-gradient(145deg, #1A1F35 0%, #111827 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "2.5rem",
        boxShadow: "0 4px 40px rgba(0,0,0,0.4)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
          <h1 style={{
            fontSize: 24, fontWeight: 700,
            background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>Đăng nhập</h1>
          <p style={{ color: "#94A3B8", fontSize: 14, marginTop: 4 }}>
            Đăng nhập để sử dụng CrawlerTool
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
            background: "rgba(239,68,68,0.12)", color: "#f87171",
            border: "1px solid rgba(239,68,68,0.25)",
          }}>❌ {error}</div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                background: "#1E293B", border: "1px solid rgba(255,255,255,0.1)",
                color: "#F1F5F9", outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                background: "#1E293B", border: "1px solid rgba(255,255,255,0.1)",
                color: "#F1F5F9", outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "12px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
              opacity: loading ? 0.6 : 1, transition: "all 0.2s",
            }}
          >
            {loading ? "⏳ Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        {/* Register link */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#94A3B8" }}>
          Chưa có tài khoản?{" "}
          <Link href="/register" style={{
            color: "#818CF8", fontWeight: 600, textDecoration: "none",
          }}>Đăng ký ngay</Link>
        </div>
      </div>
    </div>
  );
}
