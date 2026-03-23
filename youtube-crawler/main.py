
# from core.channel_service import scan_channels_by_keyword
# from core.video_service import scan_videos_by_keyword
# from core.comment_service import scan_video_comments
# from utils.file_saver import save_json, save_csv


# def extract_video_id(url: str):
#     import re
#     match = re.search(r"v=([^&]+)", url)
#     return match.group(1) if match else None


# def run():
#     print("====== YOUTUBE TOOL ======")

#     keyword = input("🔎 Keyword / Video URL: ")
#     data_type = input("📂 Type (channel / video / comment): ").lower()
#     limit_input = input("📊 Limit (default 20): ")

#     limit = int(limit_input) if limit_input.isdigit() else 20

#     # =============================
#     # CHANNEL
#     # =============================
#     if data_type == "channel":
#         data = scan_channels_by_keyword(keyword, max_results=limit)

#         print("\n=== CHANNELS ===")
#         for item in data:
#             print(item)

#         save_json(data, "channels", keyword)
#         save_csv(data, "channels", keyword)

#     # =============================
#     # VIDEO
#     # =============================
#     elif data_type == "video":
#         data = scan_videos_by_keyword(keyword, max_results=limit)

#         print("\n=== VIDEOS ===")
#         for item in data:
#             print(item)

#         save_json(data, "videos", keyword)
#         save_csv(data, "videos", keyword)

#     # =============================
#     # COMMENT
#     # =============================
#     elif data_type == "comment":
#         video_id = extract_video_id(keyword)

#         if not video_id:
#             print("❌ Invalid YouTube video URL")
#             return

#         data = scan_video_comments(video_id, max_results=limit)

#         print("\n=== COMMENTS ===")
#         for item in data:
#             print(item)

#         save_json(data, "comments", video_id)
#         save_csv(data, "comments", video_id)

#     else:
#         print("❌ Invalid type. Choose channel / video / comment")


# if __name__ == "__main__":
#     run()

import sys
import os

from flask import json

os.environ["PYTHONIOENCODING"] = "utf-8"

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
import time
import requests

from core.channel_service import scan_channels_by_keyword
from core.video_service import scan_videos_by_keyword
from core.comment_service import scan_video_comments

# API_BASE_URL = "https://be-tool-crawldata.onrender.com"
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3000")


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

        # print("Update response status:", res.status_code)
        # print("Update response body:", res.text)

    except Exception as e:
        print("Error updating task:", e)


def process_task(task):
    raw_scan_type = task.get("scan_type")
    scan_type = str(raw_scan_type).strip().lower()

    task_id = task.get("_id")
    input_data = task.get("input", {})

    # print("\n==============================")
    # print("Task ID:", task_id)
    # print("Raw scan_type:", raw_scan_type)
    # print("scan_type repr:", repr(raw_scan_type))
    # print("scan_type normalized:", scan_type)
    # print("scan_type type:", type(raw_scan_type))
    # print("Input:", input_data)
    print("==============================\n")

    try:
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
            # print(json.dumps(result[0], ensure_ascii=False, indent=2))

        update_task(task_id, "success", result=result)
        print("Task completed")

    except Exception as e:
        print("Task failed:", str(e))
        update_task(task_id, "error", error_message=str(e))


def run_worker():
    print("YouTube Worker Started...")

    while True:
        task = get_pending_task()

        if task:
            process_task(task)
        else:
            print("No pending task 50sleeping...")

        time.sleep(50)


if __name__ == "__main__":
    run_worker()