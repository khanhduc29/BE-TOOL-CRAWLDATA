import os as _os
import datetime as _dt

# ====== LOAD .ENV ======
_env_path = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)) if '__file__' in dir() else _os.getcwd(), ".env")
if _os.path.exists(_env_path):
    with open(_env_path, "r", encoding="utf-8") as _ef:
        for _line in _ef:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _, _val = _line.partition("=")
                _os.environ.setdefault(_key.strip(), _val.strip())

# ====== FILE LOG HELPER ======
_LOG_DIR = _os.path.dirname(_os.path.abspath(__file__)) if '__file__' in dir() else _os.getcwd()
_LOG_FILE = _os.path.join(_LOG_DIR, "twitter_debug.log")

def _flog(msg):
    """Ghi log ra file — luôn hoạt động dù terminal bị garbled"""
    try:
        with open(_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{_dt.datetime.now():%H:%M:%S}] {msg}\n")
    except Exception:
        pass

_flog("====== MAIN.PY LOADED ======")

import asyncio
import json
import traceback
from core.browser import create_browser
from core.logger import setup_logger
from core.anti_block import random_delay
from api.twitter_api import fetch_pending_task, update_task_status
from dispatch.scan_dispatcher import dispatch_scan

logger = setup_logger()
SESSION_FILE = "twitter_session.json"

CRAWL_TIMEOUT = 15 * 60      # 15 phút / task
POLL_INTERVAL = 50            # 50 giây kiểm tra 1 lần
MAX_RETRIES = 3               # Retry tối đa 3 lần
RETRY_DELAYS = [30, 60, 120]  # Exponential backoff


async def main():
    logger.info("🚀 TWITTER CRAWLER WORKER START (LOOP MODE)")
    _flog("WORKER START")

    # 🔹 browser objects
    playwright = None
    browser = None
    context = None

    try:
        while True:

            task_id = None
            page = None

            try:
                task = fetch_pending_task()

                if not task:
                    logger.info("😴 No pending task — sleep 50s")
                    await asyncio.sleep(POLL_INTERVAL)
                    continue

                task_id = task.get("_id")
                scan_type = task.get("scan_type")
                input_data = task.get("input")

                if not task_id or not scan_type or not input_data:
                    raise ValueError(f"❌ Invalid task format: {task}")

                logger.info(f"📥 GOT TASK {task_id} | {scan_type}")
                _flog(f"GOT TASK {task_id} | {scan_type}")
                logger.info(json.dumps(input_data, indent=2, ensure_ascii=False))

                update_task_status(task_id, "running")

                # 🔄 RETRY LOOP
                last_error = None
                for attempt in range(MAX_RETRIES):
                    try:
                        # 🛡️ Random delay trước mỗi lần crawl
                        await random_delay(3, 8)

                        # 🔥 MỞ BROWSER MỚI cho mỗi attempt
                        logger.info(f"🌐 Launch browser (attempt {attempt + 1}/{MAX_RETRIES})")
                        _flog(f"LAUNCH BROWSER attempt={attempt + 1}")
                        playwright, browser, context, _ = await create_browser(
                            headless=False,
                            session_file=SESSION_FILE
                        )
                        _flog("BROWSER LAUNCHED OK")

                        page = await context.new_page()
                        _flog("PAGE CREATED")

                        logger.info("🧠 START CRAWL")
                        _flog("START CRAWL")

                        result = await asyncio.wait_for(
                            dispatch_scan(scan_type, page, context, input_data),
                            timeout=CRAWL_TIMEOUT
                        )

                        logger.info("🎉 END CRAWL")
                        _flog(f"CRAWL OK — result count: {len(result) if isinstance(result, list) else 'non-list'}")

                        update_task_status(task_id, "success", result)
                        logger.info("✅ TASK DONE")
                        _flog("TASK DONE — success")
                        last_error = None
                        break  # ✅ Thành công → thoát retry loop

                    except asyncio.TimeoutError:
                        last_error = "timeout"
                        logger.error(f"⏰ TASK TIMEOUT (attempt {attempt + 1}/{MAX_RETRIES})")
                        _flog(f"TIMEOUT attempt={attempt + 1} — task_id={task_id}")

                    except Exception as e:
                        last_error = f"{type(e).__name__}: {e}"
                        tb = traceback.format_exc()
                        logger.error(f"❌ TASK FAILED (attempt {attempt + 1}/{MAX_RETRIES}): {last_error}")
                        logger.error(f"📋 TRACEBACK:\n{tb}")
                        _flog(f"EXCEPTION attempt={attempt + 1} ({type(e).__name__}): {e}")

                    finally:
                        if page:
                            try: await page.close()
                            except Exception: pass
                            page = None
                        if context:
                            try: await context.close()
                            except Exception: pass
                        if browser:
                            try: await browser.close()
                            except Exception: pass
                        if playwright:
                            try: await playwright.stop()
                            except Exception: pass
                        browser = None
                        context = None
                        playwright = None

                    # Đợi backoff trước retry tiếp
                    if attempt < MAX_RETRIES - 1:
                        delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                        logger.info(f"🔄 Retry {attempt + 2}/{MAX_RETRIES} in {delay}s...")
                        _flog(f"RETRY WAIT {delay}s")
                        await asyncio.sleep(delay)

                # Vẫn lỗi sau tất cả retries
                if last_error:
                    logger.error(f"💀 TASK FAILED after {MAX_RETRIES} attempts")
                    _flog(f"FINAL FAIL — {last_error}")
                    update_task_status(task_id, "error", {
                        "error": last_error,
                        "attempts": MAX_RETRIES
                    })

            except BaseException as e:
                tb = traceback.format_exc()
                logger.error(f"❌ UNEXPECTED ERROR: {type(e).__name__}: {e}")
                _flog(f"UNEXPECTED EXCEPTION: {e}")
                if task_id:
                    update_task_status(task_id, "error", {
                        "error": f"{type(e).__name__}: {e}",
                        "traceback": tb
                    })
                if isinstance(e, (SystemExit, KeyboardInterrupt)):
                    raise

            finally:
                _flog(f"FINALLY block — task_id={task_id}")
                if page:
                    try: await page.close()
                    except Exception: pass
                if context:
                    try: await context.close()
                    except Exception: pass
                if browser:
                    try: await browser.close()
                    except Exception: pass
                if playwright:
                    try: await playwright.stop()
                    except Exception: pass
                browser = None
                context = None
                playwright = None

                await asyncio.sleep(2)

    finally:
        logger.info("🛑 WORKER STOP")
        _flog("WORKER STOP")


if __name__ == "__main__":
    asyncio.run(main())
