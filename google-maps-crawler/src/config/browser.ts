import { chromium, BrowserContext, Browser } from "playwright";
import { fetchRandomProxy, getPlaywrightProxy } from "../utils/proxyHelper";

let currentBrowser: Browser | null = null;
let currentProxyServer: string | undefined = undefined;

/**
 * Tạo browser context mới (hỗ trợ parallel)
 * Dùng launch() thay vì launchPersistentContext() 
 * để nhiều task có thể chạy song song
 */
export async function createBrowser(): Promise<BrowserContext> {

  // Nếu chưa có browser → khởi tạo
  if (!currentBrowser || !currentBrowser.isConnected()) {

    // 🌐 Fetch random proxy from backend
    const proxyData = await fetchRandomProxy();
    const proxyConfig = getPlaywrightProxy(proxyData);

    const MAX_RETRY = 3;

    for (let i = 1; i <= MAX_RETRY; i++) {
      try {
        // Lần 1-2: thử với proxy, lần 3: không proxy
        const useProxy = proxyConfig && i <= 2;

        if (useProxy) {
          console.log(`🌐 Launch browser with proxy (attempt ${i})`);
        } else {
          console.log(`🌐 Launch browser WITHOUT proxy (attempt ${i})`);
        }

        currentBrowser = await chromium.launch({
          headless: false,
          ...(useProxy ? { proxy: proxyConfig } : {}),
          args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-extensions",
          ],
        });

        currentProxyServer = useProxy ? proxyConfig!.server : undefined;
        console.log(`✅ Browser launched${currentProxyServer ? ` (proxy: ${currentProxyServer})` : " (no proxy)"}`);

        // Test: thử navigate nhanh để verify proxy hoạt động
        if (useProxy) {
          const testCtx = await currentBrowser.newContext();
          const testPage = await testCtx.newPage();
          try {
            await testPage.goto("https://www.google.com", { timeout: 15000, waitUntil: "domcontentloaded" });
            console.log(`✅ Proxy test OK`);
            await testCtx.close();
          } catch (proxyErr: any) {
            console.log(`⚠️ Proxy test FAILED: ${proxyErr.message} — will retry without proxy`);
            await testCtx.close();
            await currentBrowser.close();
            currentBrowser = null;
            continue; // Retry → next attempt sẽ không dùng proxy
          }
        }

        break;

      } catch (err: any) {
        console.error(`❌ Browser launch failed (attempt ${i})`, err.message);

        if (i === MAX_RETRY) {
          throw new Error("Cannot launch browser after " + MAX_RETRY + " attempts");
        }

        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  // Tạo context mới cho mỗi task
  const context = await currentBrowser!.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "UTC",
  });

  return context;
}

/**
 * Đóng toàn bộ browser
 */
export async function closeBrowser() {
  if (!currentBrowser) return;

  try {
    console.log("🧹 Closing browser...");
    await currentBrowser.close();
  } catch {
    console.log("⚠️ Browser close error");
  }

  currentBrowser = null;
  currentProxyServer = undefined;
}