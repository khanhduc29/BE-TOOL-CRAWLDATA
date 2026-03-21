import os as _os
import datetime as _dt

# ====== FILE LOG HELPER ======
_LOG_DIR = _os.path.dirname(_os.path.abspath(__file__)) if '__file__' in dir() else _os.getcwd()
_LOG_FILE = _os.path.join(_LOG_DIR, "tiktok_debug.log")

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
from api.tiktok_api import fetch_pending_task, update_task_status
from dispatch.scan_dispatcher import dispatch_scan

logger = setup_logger()
SESSION_FILE = "tiktok_session.json"

CRAWL_TIMEOUT = 15 * 60      # 15 phút / task
POLL_INTERVAL = 50           # 50 giây kiểm tra 1 lần


async def main():
    logger.info("🚀 TIKTOK CRAWLER WORKER START (LOOP MODE)")
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

                # 🔥 CHỈ MỞ BROWSER KHI CÓ TASK
                if not browser:
                    logger.info("🌐 Launch browser for task")
                    _flog("LAUNCH BROWSER")
                    playwright, browser, context, _ = await create_browser(
                        headless=False,
                        session_file=SESSION_FILE
                    )
                    _flog("BROWSER LAUNCHED OK")

                # ✅ TẠO PAGE MỚI CHO TASK
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

            except asyncio.TimeoutError:
                logger.error("⏰ TASK TIMEOUT")
                _flog(f"TIMEOUT — task_id={task_id}")
                if task_id:
                    update_task_status(task_id, "error", {"error": "timeout"})

            except BaseException as e:
                tb = traceback.format_exc()
                logger.error(f"❌ TASK FAILED: {type(e).__name__}: {e}")
                logger.error(f"📋 TRACEBACK:\n{tb}")
                _flog(f"EXCEPTION ({type(e).__name__}): {e}")
                _flog(f"TRACEBACK:\n{tb}")
                if task_id:
                    update_task_status(task_id, "error", {
                        "error": f"{type(e).__name__}: {e}",
                        "traceback": tb
                    })
                # Re-raise SystemExit/KeyboardInterrupt to allow clean shutdown
                if isinstance(e, (SystemExit, KeyboardInterrupt)):
                    raise

            finally:
                _flog(f"FINALLY block — task_id={task_id}")
                # ✅ ĐÓNG PAGE SAU MỖI TASK
                if page:
                    try:
                        await page.close()
                    except Exception:
                        pass

                # 🔥 ĐÓNG BROWSER SAU TASK (giải phóng RAM)
                if context:
                    try:
                        await context.close()
                    except Exception:
                        pass

                if browser:
                    try:
                        await browser.close()
                    except Exception:
                        pass

                if playwright:
                    try:
                        await playwright.stop()
                    except Exception:
                        pass

                browser = None
                context = None
                playwright = None

                # nghỉ nhịp ngắn trước vòng tiếp theo
                await asyncio.sleep(2)

    finally:
        logger.info("🛑 WORKER STOP")
        _flog("WORKER STOP")


if __name__ == "__main__":
    asyncio.run(main())