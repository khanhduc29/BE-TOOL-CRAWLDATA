import time
import os
import random
import requests

from crawler.instagram_crawler import crawl_instagram_profile
from crawler.website_crawler import crawl_website


API_BASE = os.environ.get("API_BASE_URL", "http://localhost:3000") + "/api/instagram"

MAX_RETRIES = 3
RETRY_DELAYS = [30, 60, 120]  # Exponential backoff


def log(msg):
    print("[WORKER]", msg)


def get_pending_tasks():
    print("[WORKER] Fetching tasks...")
    res = requests.get(f"{API_BASE}/pending-tasks?limit=1")
    print("[WORKER] Status:", res.status_code)
    data = res.json()

    if not data["success"]:
        print("[WORKER] Error fetching tasks")
        return None

    tasks = data["data"]

    if not tasks:
        return None

    return tasks[0]


def update_success(task_id, results):
    requests.post(
        f"{API_BASE}/update-success",
        json={
            "task_id": task_id,
            "results": results
        }
    )


def update_error(task_id, error):
    requests.post(
        f"{API_BASE}/update-error",
        json={
            "task_id": task_id,
            "error": str(error)
        }
    )


def random_delay(min_s=1.0, max_s=3.0):
    """Delay ngẫu nhiên (sync) — chống phát hiện bot"""
    delay = random.uniform(min_s, max_s)
    time.sleep(delay)


def worker():

    log("Instagram worker started")

    while True:

        task = get_pending_tasks()

        if not task:
            log("No pending tasks...")
            log("Sleeping 50 seconds before next task check...")
            time.sleep(50)
            continue

        task_id = task["_id"]
        input_data = task["input"]

        url = input_data["url"]
        scan_website = input_data.get("scan_website", False)

        # 🔄 RETRY LOOP
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                # 🛡️ Random delay trước mỗi lần crawl
                random_delay(3, 8)

                log(f"Scanning {url} (attempt {attempt + 1}/{MAX_RETRIES})")

                profile = crawl_instagram_profile(url)

                if scan_website and profile.get("website"):

                    log(f"Scanning website {profile['website']}")

                    website_data = crawl_website(profile["website"])
                    profile["website_data"] = website_data

                update_success(task_id, profile)

                log("Task success")
                last_error = None
                break  # ✅ Thành công

            except Exception as e:
                last_error = str(e)
                log(f"Task error (attempt {attempt + 1}/{MAX_RETRIES}): {e}")

                # Đợi backoff trước retry tiếp
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                    log(f"🔄 Retry {attempt + 2}/{MAX_RETRIES} in {delay}s...")
                    time.sleep(delay)

        # Vẫn lỗi sau tất cả retries → báo error
        if last_error:
            log(f"💀 Task FAILED after {MAX_RETRIES} attempts: {last_error}")
            update_error(task_id, last_error)

        time.sleep(5)


if __name__ == "__main__":
    worker()