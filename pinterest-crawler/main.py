
import time
import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

from core.pinterest_api import (
    get_pending_tasks,
    update_task_success,
    update_task_error
)

from core.pinterest_crawler import crawl_pinterest, crawl_pinterest_profile


def log(msg):
    print(f"[WORKER] {msg}", flush=True)


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

        try:
            if scan_type == "profile":
                # Profile crawl: lấy pins từ profile URL
                profile_url = input_data.get("profile_url", "")
                limit = input_data.get("limit", 20)

                if not profile_url:
                    raise ValueError("Thiếu profile_url trong input")

                log(f"Profile URL: {profile_url}")
                log(f"Limit: {limit}")

                results = crawl_pinterest_profile(profile_url, limit)

            else:
                # Keyword search (default)
                keyword = input_data.get("keyword", "")
                limit = input_data.get("limit", 20)

                if not keyword:
                    raise ValueError("Thiếu keyword trong input")

                log(f"Keyword: {keyword}")
                log(f"Limit: {limit}")

                results = crawl_pinterest(keyword, limit)

            log(f"Crawl finished. Pins collected: {len(results)}")

            update_task_success(task_id, results)

            log(f"Task marked SUCCESS: {task_id}")

        except Exception as e:

            log(f"Task ERROR: {str(e)}")

            update_task_error(task_id, str(e))


if __name__ == "__main__":
    worker()