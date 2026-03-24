import os
import time
import json
import asyncio
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

    # 👉 Check session file
    use_session = False
    if session_file and os.path.exists(session_file):
        try:
            file_age_days = (time.time() - os.path.getmtime(session_file)) / 86400
            with open(session_file, "r", encoding="utf-8") as f:
                session_data = json.load(f)

            cookie_count = len(session_data.get("cookies", []))
            print(f"[SESSION] Found {session_file}: {cookie_count} cookies, age={file_age_days:.1f} days", flush=True)

            if file_age_days > 30:
                print(f"[SESSION] WARNING: Session is {file_age_days:.0f} days old!", flush=True)

            if cookie_count > 0:
                context_kwargs["storage_state"] = session_file
                use_session = True
            else:
                print("[SESSION] No cookies in session file", flush=True)

        except (json.JSONDecodeError, KeyError, OSError) as e:
            print(f"[SESSION] ERROR: Invalid session file: {e}", flush=True)
    else:
        print(f"[SESSION] No session file at '{session_file}'", flush=True)

    context = await browser.new_context(**context_kwargs)
    page = await context.new_page()

    # 🔥 Auto-login nếu chưa có session
    if not use_session:
        logged_in = await auto_login(page, context, session_file)
        if logged_in:
            print("[SESSION] ✅ Auto-login thành công!", flush=True)
        else:
            print("[SESSION] ⚠️ Auto-login thất bại — có thể gặp login wall", flush=True)

    return playwright, browser, context, page


async def auto_login(page, context, session_file=None):
    """
    Tự động đăng nhập X.com bằng credentials từ environment variables.
    """
    # ===== DEBUG: CHECK ENV =====
    username = os.environ.get("TWITTER_USERNAME", "")
    password = os.environ.get("TWITTER_PASSWORD", "")
    email = os.environ.get("TWITTER_EMAIL", "")

    print(f"[LOGIN] ENV check: TWITTER_USERNAME={repr(username)}", flush=True)
    print(f"[LOGIN] ENV check: TWITTER_PASSWORD={'***set***' if password else 'EMPTY'}", flush=True)
    print(f"[LOGIN] ENV check: TWITTER_EMAIL={repr(email)}", flush=True)

    if not password:
        print("[LOGIN] ❌ Missing password — skip auto-login", flush=True)
        return False

    # Ưu tiên dùng email để đăng nhập, tránh bước xác minh email phụ
    login_id = email if email else username
    if not login_id:
        print("[LOGIN] ❌ Missing email and username — skip auto-login", flush=True)
        return False

    print(f"[LOGIN] 🚀 Starting auto-login with: {login_id}...", flush=True)

    try:
        # ========== NAVIGATE TO LOGIN ==========
        print("[LOGIN] Navigating to login page...", flush=True)
        await page.goto("https://x.com/i/flow/login", wait_until="domcontentloaded", timeout=30000)

        # Chờ page render hoàn toàn
        print("[LOGIN] Waiting 6s for page to fully render...", flush=True)
        await asyncio.sleep(6)

        # ========== STEP 1: NHẬP EMAIL/USERNAME ==========
        print(f"[LOGIN] STEP 1: Looking for login input (using {'email' if email else 'username'})...", flush=True)

        username_input = None
        selectors_tried = []

        for selector in [
            'input[autocomplete="username"]',
            'input[name="text"]',
            'input[type="text"]',
            'input[data-testid="ocfEnterTextTextInput"]',
        ]:
            selectors_tried.append(selector)
            try:
                el = await page.wait_for_selector(selector, timeout=5000, state="visible")
                if el:
                    username_input = el
                    print(f"[LOGIN] ✅ Found login input: {selector}", flush=True)
                    break
            except Exception:
                print(f"[LOGIN]   ❌ Selector not found: {selector}", flush=True)
                continue

        if not username_input:
            print(f"[LOGIN] ❌ Cannot find login input. Tried: {selectors_tried}", flush=True)
            try:
                await page.screenshot(path="login_fail_step1.png")
            except Exception:
                pass
            return False

        # Click và gõ từ từ (giống người thật)
        await username_input.click()
        await asyncio.sleep(0.5)

        # Clear input trước
        await username_input.fill("")
        await asyncio.sleep(0.3)

        # Gõ email/username từng ký tự
        print(f"[LOGIN] Typing: {login_id}", flush=True)
        for char in login_id:
            await username_input.type(char, delay=80)

        await asyncio.sleep(1.5)

        # ===== CLICK NEXT =====
        print("[LOGIN] Looking for Next button...", flush=True)
        clicked_next = False

        # Thử click button bằng text content
        all_buttons = await page.query_selector_all('button')
        for btn in all_buttons:
            try:
                text = (await btn.inner_text()).strip()
                if text.lower() in ("next", "tiếp theo", "далее", "siguiente", "suivant"):
                    await btn.click()
                    clicked_next = True
                    print(f"[LOGIN] ✅ Clicked button: '{text}'", flush=True)
                    break
            except Exception:
                continue

        if not clicked_next:
            # Fallback: Enter key
            print("[LOGIN] Next button not found by text, pressing Enter", flush=True)
            await page.keyboard.press("Enter")

        # Chờ transition
        print("[LOGIN] Waiting 5s for next step...", flush=True)
        await asyncio.sleep(5)

        # ========== STEP 1.5: EMAIL VERIFICATION (nếu X yêu cầu) ==========
        print("[LOGIN] STEP 1.5: Checking for email verification...", flush=True)

        email_input = None
        try:
            email_input = await page.wait_for_selector(
                'input[data-testid="ocfEnterTextTextInput"]',
                timeout=3000,
                state="visible"
            )
        except Exception:
            pass

        if email_input:
            print("[LOGIN] ⚠️ X requires email/phone verification!", flush=True)
            if email:
                await email_input.click()
                await asyncio.sleep(0.3)

                print(f"[LOGIN] Typing email: {email}", flush=True)
                for char in email:
                    await email_input.type(char, delay=30)

                await asyncio.sleep(1)

                verify_btn = await page.query_selector('button[data-testid="ocfEnterTextNextButton"]')
                if verify_btn:
                    await verify_btn.click()
                    print("[LOGIN] ✅ Clicked verify button", flush=True)
                else:
                    await page.keyboard.press("Enter")
                    print("[LOGIN] Verify button not found, pressed Enter", flush=True)

                await asyncio.sleep(5)
            else:
                print("[LOGIN] ❌ No TWITTER_EMAIL set — cannot verify", flush=True)
                return False
        else:
            print("[LOGIN] No email verification required — good!", flush=True)

        # ========== STEP 2: NHẬP PASSWORD ==========
        print("[LOGIN] STEP 2: Looking for password input...", flush=True)

        password_input = None
        for selector in ['input[name="password"]', 'input[type="password"]']:
            try:
                el = await page.wait_for_selector(selector, timeout=8000, state="visible")
                if el:
                    password_input = el
                    print(f"[LOGIN] ✅ Found password input: {selector}", flush=True)
                    break
            except Exception:
                print(f"[LOGIN]   ❌ Selector not found: {selector}", flush=True)
                continue

        if not password_input:
            print("[LOGIN] ❌ Cannot find password input", flush=True)
            try:
                await page.screenshot(path="login_fail_step2.png")
            except Exception:
                pass
            return False

        await password_input.click()
        await asyncio.sleep(0.5)

        print("[LOGIN] Typing password...", flush=True)
        for char in password:
            await password_input.type(char, delay=50)

        await asyncio.sleep(1.5)

        # ===== CLICK LOG IN =====
        print("[LOGIN] Looking for Log in button...", flush=True)
        login_btn = await page.query_selector('button[data-testid="LoginForm_Login_Button"]')
        if login_btn:
            await login_btn.click()
            print("[LOGIN] ✅ Clicked Log in button", flush=True)
        else:
            # Fallback: tìm button có text "Log in"
            all_buttons = await page.query_selector_all('button')
            clicked = False
            for btn in all_buttons:
                try:
                    text = (await btn.inner_text()).strip()
                    if text.lower() in ("log in", "đăng nhập", "войти"):
                        await btn.click()
                        clicked = True
                        print(f"[LOGIN] ✅ Clicked button: '{text}'", flush=True)
                        break
                except Exception:
                    continue
            if not clicked:
                print("[LOGIN] Log in button not found, pressing Enter", flush=True)
                await page.keyboard.press("Enter")

        # ========== STEP 3: CHỜ LOGIN HOÀN TẤT ==========
        print("[LOGIN] STEP 3: Waiting for login redirect...", flush=True)
        await asyncio.sleep(8)

        # Kiểm tra URL — thử 8 lần, mỗi lần 2s
        for attempt in range(8):
            current_url = page.url
            print(f"[LOGIN] Check #{attempt + 1}: URL = {current_url}", flush=True)

            # Login thành công nếu URL ở /home hoặc không còn /login, /flow
            if "/home" in current_url:
                print("[LOGIN] ✅✅✅ LOGIN THÀNH CÔNG!", flush=True)
                await _save_session(context, session_file)
                return True

            if "x.com" in current_url and "/login" not in current_url and "/flow" not in current_url:
                print(f"[LOGIN] ✅ Login OK (redirected to: {current_url})", flush=True)
                await _save_session(context, session_file)
                return True

            await asyncio.sleep(2)

        # ===== FAIL =====
        final_url = page.url
        print(f"[LOGIN] ❌ Login FAILED after all retries. Final URL: {final_url}", flush=True)
        try:
            await page.screenshot(path="login_fail_final.png")
            print("[LOGIN] Saved screenshot: login_fail_final.png", flush=True)
        except Exception:
            pass

        return False

    except Exception as e:
        print(f"[LOGIN] ❌ AUTO-LOGIN ERROR: {type(e).__name__}: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return False


async def _save_session(context, session_file):
    """Save browser cookies/storage to session file"""
    if not session_file:
        return
    try:
        storage = await context.storage_state()
        with open(session_file, "w", encoding="utf-8") as f:
            json.dump(storage, f, ensure_ascii=False, indent=2)
        cookie_count = len(storage.get("cookies", []))
        print(f"[LOGIN] 💾 Session saved: {session_file} ({cookie_count} cookies)", flush=True)
    except Exception as e:
        print(f"[LOGIN] ⚠️ Failed to save session: {e}", flush=True)
