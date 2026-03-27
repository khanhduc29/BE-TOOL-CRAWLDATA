"""
Captcha Solver — Giải captcha TikTok bằng audio + AssemblyAI

Flow:
1. Detect captcha trên page
2. Click vào nút "Audio"
3. Tải audio file (MP3) từ HTML
4. Gọi AssemblyAI API transcribe audio → text
5. Điền text vào input → submit
"""

import os
import asyncio
import tempfile
import assemblyai as aai
from core.logger import setup_logger

logger = setup_logger()

# ===== CONFIG =====
ASSEMBLY_KEY = os.environ.get("ASSEMBLY_KEY", "cc9076bb512c480f994633855cfa46b4")
MAX_CAPTCHA_ATTEMPTS = 3

# Selectors cho TikTok captcha (có thể thay đổi theo version)
CAPTCHA_SELECTORS = [
    "#captcha-verify-container",
    ".captcha_verify_container",
    "[class*='captcha']",
    "#tiktok-verify-ele",
    ".verify-wrap",
]

AUDIO_BUTTON_SELECTORS = [
    "text=Audio",
    "text=audio",
    "[class*='audio']",
    "button:has-text('Audio')",
    ".captcha-audio-btn",
]

AUDIO_ELEMENT_SELECTORS = [
    "audio source",
    "audio[src]",
    "source[src*='.mp3']",
    "source[type='audio/mpeg']",
    "[class*='captcha'] audio",
]

CAPTCHA_INPUT_SELECTORS = [
    "input[type='text']",
    "[class*='captcha'] input",
    ".captcha_verify_container input",
    "#captcha-verify-container input",
]

CAPTCHA_SUBMIT_SELECTORS = [
    "button:has-text('Verify')",
    "button:has-text('Submit')",
    "button:has-text('Xác minh')",
    "[class*='verify'] button",
    "[class*='captcha'] button[type='submit']",
    ".captcha_verify_container button",
]


async def detect_captcha(page) -> bool:
    """Kiểm tra page có captcha hay không"""
    for selector in CAPTCHA_SELECTORS:
        try:
            el = page.locator(selector)
            if await el.count() > 0:
                # Double check: element phải visible
                if await el.first.is_visible():
                    logger.info(f"🔒 CAPTCHA DETECTED (selector: {selector})")
                    return True
        except Exception:
            continue

    # Fallback: kiểm tra HTML content
    try:
        html = (await page.content()).lower()
        if "captcha" in html and ("verify" in html or "puzzle" in html):
            logger.info("🔒 CAPTCHA DETECTED (HTML content)")
            return True
    except Exception:
        pass

    return False


async def _click_audio_button(page) -> bool:
    """Click vào nút Audio trong captcha dialog"""
    for selector in AUDIO_BUTTON_SELECTORS:
        try:
            el = page.locator(selector)
            if await el.count() > 0 and await el.first.is_visible():
                await el.first.click()
                logger.info(f"🔊 Clicked Audio button (selector: {selector})")
                await page.wait_for_timeout(2000)
                return True
        except Exception:
            continue

    logger.warning("⚠️ Could not find Audio button")
    return False


async def _get_audio_url(page) -> str | None:
    """Lấy URL audio từ HTML element"""
    # Thử tìm audio element
    for selector in AUDIO_ELEMENT_SELECTORS:
        try:
            el = page.locator(selector)
            if await el.count() > 0:
                src = await el.first.get_attribute("src")
                if src:
                    logger.info(f"🎵 Found audio URL: {src[:80]}...")
                    return src
        except Exception:
            continue

    # Fallback: intercept network requests để tìm MP3
    logger.warning("⚠️ No audio element found — trying to find audio URL from page content")

    try:
        html = await page.content()
        import re
        # Tìm URL MP3 trong HTML
        mp3_urls = re.findall(r'https?://[^\s"\'<>]+\.mp3[^\s"\'<>]*', html)
        if mp3_urls:
            logger.info(f"🎵 Found MP3 URL from HTML: {mp3_urls[0][:80]}...")
            return mp3_urls[0]

        # Tìm URL audio trong data attributes hoặc src
        audio_urls = re.findall(r'src=["\']([^"\']*(?:audio|captcha|verify)[^"\']*)["\']', html, re.IGNORECASE)
        if audio_urls:
            url = audio_urls[0]
            if not url.startswith("http"):
                url = f"https://www.tiktok.com{url}" if url.startswith("/") else url
            logger.info(f"🎵 Found audio URL from src: {url[:80]}...")
            return url
    except Exception as e:
        logger.error(f"❌ Error finding audio URL: {e}")

    return None


async def _download_audio(page, audio_url: str) -> str | None:
    """Tải audio file về temp directory, trả về local file path"""
    try:
        import requests

        # Nếu là relative URL
        if audio_url.startswith("/"):
            audio_url = f"https://www.tiktok.com{audio_url}"

        logger.info(f"⬇️ Downloading audio: {audio_url[:80]}...")
        resp = requests.get(audio_url, timeout=30)
        resp.raise_for_status()

        # Lưu vào temp file
        tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        tmp.write(resp.content)
        tmp.close()

        logger.info(f"💾 Audio saved: {tmp.name} ({len(resp.content)} bytes)")
        return tmp.name

    except Exception as e:
        logger.error(f"❌ Failed to download audio: {e}")
        return None


async def _transcribe_audio(audio_path: str) -> str | None:
    """Gọi AssemblyAI API để transcribe audio → text"""
    if not ASSEMBLY_KEY:
        logger.error("❌ ASSEMBLY_KEY not set! Cannot transcribe audio.")
        return None

    try:
        client = aai.TranscriptConfig = None  # reset
        aai.settings.api_key = ASSEMBLY_KEY
        client = aai.Transcriber()

        logger.info(f"🧠 Transcribing audio: {audio_path}")

        # Chạy transcribe trong thread pool (vì AssemblyAI SDK là sync)
        loop = asyncio.get_event_loop()
        transcript = await loop.run_in_executor(
            None,
            lambda: client.transcribe(audio_path)
        )

        if transcript.status == aai.TranscriptStatus.error:
            logger.error(f"❌ Transcription error: {transcript.error}")
            return None

        text = transcript.text
        logger.info(f"📝 Transcription result: '{text}'")
        return text

    except Exception as e:
        logger.error(f"❌ Transcription failed: {e}")
        return None
    finally:
        # Cleanup temp file
        try:
            os.unlink(audio_path)
        except Exception:
            pass


async def _submit_captcha_text(page, text: str) -> bool:
    """Điền text vào captcha input và submit"""
    # Tìm input field
    input_found = False
    for selector in CAPTCHA_INPUT_SELECTORS:
        try:
            el = page.locator(selector)
            if await el.count() > 0 and await el.first.is_visible():
                await el.first.fill("")
                await el.first.type(text, delay=50)
                logger.info(f"✏️ Filled captcha input: '{text}'")
                input_found = True
                break
        except Exception:
            continue

    if not input_found:
        logger.error("❌ Could not find captcha input field")
        return False

    await page.wait_for_timeout(500)

    # Click submit
    for selector in CAPTCHA_SUBMIT_SELECTORS:
        try:
            el = page.locator(selector)
            if await el.count() > 0 and await el.first.is_visible():
                await el.first.click()
                logger.info(f"🚀 Clicked submit button (selector: {selector})")
                await page.wait_for_timeout(3000)
                return True
        except Exception:
            continue

    # Fallback: thử press Enter
    logger.info("⌨️ No submit button found — pressing Enter")
    await page.keyboard.press("Enter")
    await page.wait_for_timeout(3000)
    return True


async def solve_audio_captcha(page) -> bool:
    """
    Flow giải captcha bằng audio:
    1. Click Audio
    2. Lấy audio URL
    3. Download MP3
    4. Transcribe via AssemblyAI
    5. Điền text + submit
    """
    logger.info("🔓 Starting audio captcha solver...")

    # Step 1: Click Audio button
    if not await _click_audio_button(page):
        logger.error("❌ Failed to click Audio button — cannot solve captcha")
        return False

    # Step 2: Lấy audio URL
    audio_url = await _get_audio_url(page)
    if not audio_url:
        logger.error("❌ Could not find audio URL — cannot solve captcha")
        return False

    # Step 3: Download audio
    audio_path = await _download_audio(page, audio_url)
    if not audio_path:
        logger.error("❌ Failed to download audio — cannot solve captcha")
        return False

    # Step 4: Transcribe
    text = await _transcribe_audio(audio_path)
    if not text:
        logger.error("❌ Transcription failed — cannot solve captcha")
        return False

    # Step 5: Submit
    success = await _submit_captcha_text(page, text)
    if not success:
        logger.error("❌ Failed to submit captcha text")
        return False

    # Verify: kiểm tra captcha đã biến mất chưa
    await page.wait_for_timeout(2000)
    still_captcha = await detect_captcha(page)
    if still_captcha:
        logger.warning("⚠️ Captcha still present after submit — may need retry")
        return False

    logger.info("✅ CAPTCHA SOLVED SUCCESSFULLY!")
    return True


async def handle_captcha_if_present(page) -> bool:
    """
    Wrapper: detect captcha + solve nếu có.
    Trả về True nếu đã giải thành công hoặc không có captcha.
    Trả về False nếu có captcha nhưng không giải được.
    """
    if not await detect_captcha(page):
        return True  # Không có captcha → OK

    logger.info("🔒 Captcha detected — attempting to solve...")

    for attempt in range(1, MAX_CAPTCHA_ATTEMPTS + 1):
        logger.info(f"🔄 Captcha solve attempt {attempt}/{MAX_CAPTCHA_ATTEMPTS}")

        solved = await solve_audio_captcha(page)
        if solved:
            return True

        if attempt < MAX_CAPTCHA_ATTEMPTS:
            logger.info(f"⏳ Waiting before retry...")
            await page.wait_for_timeout(3000)
            # Reload page để lấy captcha mới
            try:
                await page.reload(wait_until="domcontentloaded")
                await page.wait_for_timeout(3000)
            except Exception:
                pass

    logger.error(f"💀 Failed to solve captcha after {MAX_CAPTCHA_ATTEMPTS} attempts")
    return False
