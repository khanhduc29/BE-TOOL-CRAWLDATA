
import time
import random
import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

from core.pinterest_api import (
    get_pending_tasks,
    update_task_success,
    update_task_error
)

from core.pinterest_crawler import crawl_pinterest, crawl_pinterest_profile

MAX_RETRIES = 3
RETRY_DELAYS = [30, 60, 120]  # Exponential backoff


def log(msg):
    print(f"[WORKER] {msg}", flush=True)


def random_delay(min_s=1.0, max_s=3.0):
    """Delay ngẫu nhiên — chống phát hiện bot"""
    delay = random.uniform(min_s, max_s)
    time.sleep(delay)


def worker():

    log("Pinterest worker started")

    while True:

        task = get_pending_tasks()

        if not task:
            log("No pending tasks...")
            time.sleep(50)
            continue

        task_id = task["_id"]
        input_data = task.get("input", {})
        scan_type = task.get("scan_type", "search")

        log(f"Running task: {task_id} (scan_type={scan_type})")

        # 🔄 RETRY LOOP
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                # 🛡️ Random delay trước mỗi lần crawl
                random_delay(3, 8)

                if scan_type == "profile":
                    profile_url = input_data.get("profile_url", "")
                    limit = input_data.get("limit", 20)

                    if not profile_url:
                        raise ValueError("Thiếu profile_url trong input")

                    log(f"Profile URL: {profile_url} (attempt {attempt + 1}/{MAX_RETRIES})")
                    log(f"Limit: {limit}")

                    results = crawl_pinterest_profile(profile_url, limit)

                else:
                    keyword = input_data.get("keyword", "")
                    limit = input_data.get("limit", 20)

                    if not keyword:
                        raise ValueError("Thiếu keyword trong input")

                    log(f"Keyword: {keyword} (attempt {attempt + 1}/{MAX_RETRIES})")
                    log(f"Limit: {limit}")

                    results = crawl_pinterest(keyword, limit)

                log(f"Crawl finished. Pins collected: {len(results)}")

                update_task_success(task_id, results)

                log(f"Task marked SUCCESS: {task_id}")
                last_error = None
                break  # ✅ Thành công

            except Exception as e:
                last_error = str(e)
                log(f"Task ERROR (attempt {attempt + 1}/{MAX_RETRIES}): {last_error}")

                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                    log(f"🔄 Retry {attempt + 2}/{MAX_RETRIES} in {delay}s...")
                    time.sleep(delay)

        # Vẫn lỗi → báo error
        if last_error:
            log(f"💀 Task FAILED after {MAX_RETRIES} attempts: {last_error}")
            update_task_error(task_id, last_error)


if __name__ == "__main__":
    worker()