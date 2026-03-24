import os
import time
import json
from playwright.async_api import async_playwright
from core.anti_block import get_random_ua


async def create_browser(headless=True, session_file=None):
    playwright = await async_playwright().start()

    browser = await playwright.chromium.launch(
        headless=headless,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
        ],
    )

    # ===== TẠO CONTEXT =====
    random_ua = get_random_ua()
    print(f"[BROWSER] Using User-Agent: {random_ua[:60]}...", flush=True)
    context_kwargs = {
        "user_agent": random_ua,
        "viewport": {"width": 1280, "height": 800},
    }

    # 👉 Check session file: tồn tại, hợp lệ, chưa quá cũ
    use_session = False
    if session_file and os.path.exists(session_file):
        try:
            file_age_days = (time.time() - os.path.getmtime(session_file)) / 86400
            # Kiểm tra JSON hợp lệ
            with open(session_file, "r", encoding="utf-8") as f:
                session_data = json.load(f)

            cookie_count = len(session_data.get("cookies", []))
            print(f"[SESSION] Found {session_file}: {cookie_count} cookies, age={file_age_days:.1f} days", flush=True)

            if file_age_days > 30:
                print(f"[SESSION] WARNING: Session is {file_age_days:.0f} days old — cookies may be expired!", flush=True)

            if cookie_count > 0:
                context_kwargs["storage_state"] = session_file
                use_session = True
            else:
                print("[SESSION] No cookies in session file — skipping", flush=True)

        except (json.JSONDecodeError, KeyError, OSError) as e:
            print(f"[SESSION] ERROR: Invalid session file: {e} — launching without session", flush=True)
    else:
        print(f"[SESSION] No session file at '{session_file}' — launching without login", flush=True)

    if not use_session:
        print("[SESSION] Running WITHOUT session — TikTok may show login wall or CAPTCHA", flush=True)

    context = await browser.new_context(**context_kwargs)

    page = await context.new_page()

    return playwright, browser, context, page
