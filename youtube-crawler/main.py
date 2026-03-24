import sys
import os
import time
import random

from flask import json

os.environ["PYTHONIOENCODING"] = "utf-8"

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
import requests

from core.channel_service import scan_channels_by_keyword
from core.video_service import scan_videos_by_keyword
from core.comment_service import scan_video_comments

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3000")

MAX_RETRIES = 3
RETRY_DELAYS = [30, 60, 120]  # Exponential backoff


def extract_video_id(url: str):
    import re
    match = re.search(r"v=([^&]+)", url)
    return match.group(1) if match else None


def get_pending_task():
    try:
        params = {}
        worker_id = os.environ.get("WORKER_ID", "")
        if worker_id:
            params["worker_id"] = worker_id
        res = requests.get(f"{API_BASE_URL}/api/youtube/task/pending", params=params)
        data = res.json()
        return data.get("data")
    except Exception as e:
        print("Error fetching task:", e)
        return None


def update_task(task_id, status, result=None, error_message=None):
    try:
        payload = {
            "status": status,
            "result": result,
            "error_message": error_message,
        }

        print(" Updating task with payload:")
        print("   status:", status)
        print("   result length:", len(result) if result else 0)
        print("   error:", error_message)

        res = requests.put(
            f"{API_BASE_URL}/api/youtube/task/{task_id}",
            json=payload,
        )

    except Exception as e:
        print("Error updating task:", e)


def random_delay(min_s=1.0, max_s=3.0):
    """Delay ngẫu nhiên — chống phát hiện bot"""
    delay = random.uniform(min_s, max_s)
    time.sleep(delay)


def process_task(task):
    raw_scan_type = task.get("scan_type")
    scan_type = str(raw_scan_type).strip().lower()

    task_id = task.get("_id")
    input_data = task.get("input", {})

    print("==============================\n")

    # 🔄 RETRY LOOP
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            # 🛡️ Random delay trước mỗi lần crawl
            random_delay(3, 8)

            print(f"Processing task {task_id} (attempt {attempt + 1}/{MAX_RETRIES})")

            if scan_type == "channels":
                print("ENTER CHANNELS BLOCK")
                result = scan_channels_by_keyword(
                    input_data.get("keyword"),
                    max_results=input_data.get("limit", 20),
                    deep_scan_social=input_data.get("deep_scan_social", False)
                )

            elif scan_type == "videos":
                print("ENTER VIDEOS BLOCK")
                result = scan_videos_by_keyword(
                    input_data.get("keyword"),
                    max_results=input_data.get("limit", 20),
                )

            elif scan_type == "video_comments":
                print("ENTER COMMENTS BLOCK")

                video_id = extract_video_id(input_data.get("video_url", ""))

                print("Extracted video_id:", video_id)

                if not video_id:
                    raise Exception("Invalid video URL")

                result = scan_video_comments(
                    video_id,
                    max_results=input_data.get("limit_comments", 50),
                )

            else:
                raise Exception(f"Unsupported scan_type: {scan_type}")

            print("Result type:", type(result))
            print("Result length:", len(result) if result else 0)

            if result:
                print("done")

            update_task(task_id, "success", result=result)
            print("Task completed")
            last_error = None
            break  # ✅ Thành công

        except Exception as e:
            last_error = str(e)
            print(f"Task failed (attempt {attempt + 1}/{MAX_RETRIES}):", last_error)

            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                print(f"🔄 Retry {attempt + 2}/{MAX_RETRIES} in {delay}s...")
                time.sleep(delay)

    # Vẫn lỗi → báo error
    if last_error:
        print(f"💀 Task FAILED after {MAX_RETRIES} attempts: {last_error}")
        update_task(task_id, "error", error_message=last_error)


def run_worker():
    print("YouTube Worker Started...")

    while True:
        task = get_pending_task()

        if task:
            process_task(task)
        else:
            print("No pending task — sleeping 50s...")

        time.sleep(50)


if __name__ == "__main__":
    run_worker()