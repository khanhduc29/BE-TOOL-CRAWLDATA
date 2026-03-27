"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

const API = "/api/proxy";

interface User {
  _id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// Pages that don't require auth
const PUBLIC_PATHS = ["/", "/login", "/register"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check token on mount
  const checkAuth = useCallback(async () => {
    const savedToken = localStorage.getItem("auth_token");
    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      const data = await res.json();

      if (data.success && data.data) {
        setUser(data.data);
        setToken(savedToken);
      } else {
        // Token invalid
        localStorage.removeItem("auth_token");
      }
    } catch {
      localStorage.removeItem("auth_token");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isLoading) return;
    if (!user && !PUBLIC_PATHS.includes(pathname)) {
      router.replace("/login");
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        setUser(data.data.user);
        setToken(data.data.token);
        localStorage.setItem("auth_token", data.data.token);
        router.push("/dashboard");
        return { success: true };
      }
      return { success: false, message: data.message || "Đăng nhập thất bại" };
    } catch {
      return { success: false, message: "Lỗi kết nối server" };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        setUser(data.data.user);
        setToken(data.data.token);
        localStorage.setItem("auth_token", data.data.token);
        router.push("/dashboard");
        return { success: true };
      }
      return { success: false, message: data.message || "Đăng ký thất bại" };
    } catch {
      return { success: false, message: "Lỗi kết nối server" };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_token");
    router.push("/login");
  };

  // Show nothing while checking auth (prevent flash)
  if (isLoading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", background: "#0B0F1A", color: "#94A3B8", fontSize: 16,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          Đang tải...
        </div>
      </div>
    );
  }

  // If on a protected page and not logged in, show nothing (redirect happening)
  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
