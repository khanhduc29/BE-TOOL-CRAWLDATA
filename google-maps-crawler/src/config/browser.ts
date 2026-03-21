import { chromium, BrowserContext, Browser } from "playwright";

let currentBrowser: Browser | null = null;

/**
 * Tạo browser context mới (hỗ trợ parallel)
 * Dùng launch() thay vì launchPersistentContext() 
 * để nhiều task có thể chạy song song
 */
export async function createBrowser(): Promise<BrowserContext> {

  // Nếu chưa có browser → khởi tạo
  if (!currentBrowser || !currentBrowser.isConnected()) {

    const MAX_RETRY = 3;

    for (let i = 1; i <= MAX_RETRY; i++) {
      try {
        console.log(`🌐 Launch browser (attempt ${i})`);

        currentBrowser = await chromium.launch({
          headless: false,
          args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-extensions",
          ],
        });

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
}