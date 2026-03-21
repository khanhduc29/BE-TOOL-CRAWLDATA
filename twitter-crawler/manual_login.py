"""
Mở trình duyệt Playwright → Bạn đăng nhập X.com thủ công → Tự động lưu session.
Cách dùng: python manual_login.py
"""
import asyncio
import json
import os
from playwright.async_api import async_playwright

SESSION_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "twitter_session.json")


async def main():
    print("=" * 50)
    print("  TWITTER MANUAL LOGIN")
    print("=" * 50)
    print()
    print("1. Trình duyệt sẽ mở trang X.com")
    print("2. Bạn đăng nhập thủ công (email + password)")
    print("3. Sau khi login xong, nhấn Enter ở đây")
    print("4. Session sẽ được lưu tự động")
    print()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()

        print("[*] Mở X.com/login...")
        await page.goto("https://x.com/i/flow/login", wait_until="domcontentloaded")

        print()
        print(">>> Đăng nhập trên trình duyệt vừa mở <<<")
        print(">>> Sau khi thấy trang Home của X, quay lại đây nhấn ENTER <<<")
        print()

        input("Nhấn ENTER sau khi đã login xong... ")

        # Lưu session
        storage = await context.storage_state()
        with open(SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump(storage, f, ensure_ascii=False, indent=2)

        cookie_count = len(storage.get("cookies", []))
        print(f"\n[SUCCESS] Đã lưu {cookie_count} cookies (bao gồm HttpOnly)")
        print(f"[SUCCESS] File: {SESSION_FILE}")
        print()
        print("Giờ bật lại Twitter crawler — nó sẽ dùng session này!")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
