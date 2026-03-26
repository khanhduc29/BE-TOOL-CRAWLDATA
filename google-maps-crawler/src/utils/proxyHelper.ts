/**
 * Proxy Helper — Fetch a random active proxy from the backend API.
 * Used by Google Maps crawler.
 */

const API_BASE = (process.env.API_BASE_URL || "http://localhost:3000") + "/api";

export interface ProxyData {
  host: string;
  port: number;
  username: string;
  password: string;
  protocol: string;
  country?: string;
  city?: string;
}

export interface PlaywrightProxy {
  server: string;
  username?: string;
  password?: string;
}

/**
 * Gọi backend API để lấy 1 proxy active ngẫu nhiên.
 */
export async function fetchRandomProxy(): Promise<ProxyData | null> {
  try {
    const res = await fetch(`${API_BASE}/proxies/random`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();

    if (data.success && data.data) {
      const proxy = data.data as ProxyData;
      console.log(`[PROXY] ✅ Got proxy: ${proxy.host}:${proxy.port} (${proxy.country || "?"})`);
      return proxy;
    } else {
      console.log("[PROXY] ⚠️ No active proxy available — running without proxy");
      return null;
    }
  } catch (err: any) {
    console.log(`[PROXY] ⚠️ Failed to fetch proxy: ${err.message} — running without proxy`);
    return null;
  }
}

/**
 * Chuyển proxy data thành format Playwright proxy config.
 */
export function getPlaywrightProxy(proxyData: ProxyData | null): PlaywrightProxy | undefined {
  if (!proxyData) return undefined;

  const protocol = proxyData.protocol || "http";
  const server = `${protocol}://${proxyData.host}:${proxyData.port}`;

  const config: PlaywrightProxy = { server };

  if (proxyData.username) config.username = proxyData.username;
  if (proxyData.password) config.password = proxyData.password;

  console.log(`[PROXY] 🔧 Playwright proxy config: ${server}`);
  return config;
}
