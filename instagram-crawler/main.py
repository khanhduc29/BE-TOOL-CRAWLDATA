# from crawler.instagram_crawler import crawl_instagram_profile
# from crawler.website_crawler import crawl_website


# def run_scan(data):

#     results = []

#     for item in data:

#         url = item["url"]
#         scan_website = item["scan_website"]

#         print("Scanning:", url)

#         profile = crawl_instagram_profile(url)

#         if scan_website and profile.get("website"):

#             print("Scanning website:", profile["website"])

#             website_data = crawl_website(profile["website"])
#             profile["website_data"] = website_data

#         results.append(profile)

#     return results


# if __name__ == "__main__":

#     inputs = [
#         {
#             "url": "https://www.instagram.com/shapesparis/",
#             "scan_website": True
#         }
#     ]

#     data = run_scan(inputs)

#     print(data)

import time
import os
import requests

from crawler.instagram_crawler import crawl_instagram_profile
from crawler.website_crawler import crawl_website


# API_BASE = "https://be-tool-crawldata.onrender.com/api/instagram"
API_BASE = os.environ.get("API_BASE_URL", "http://localhost:3000") + "/api/instagram"


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

        try:

            log(f"Scanning {url}")

            profile = crawl_instagram_profile(url)

            if scan_website and profile.get("website"):

                log(f"Scanning website {profile['website']}")

                website_data = crawl_website(profile["website"])
                profile["website_data"] = website_data

            update_success(task_id, profile)

            log("Task success")

        except Exception as e:

            log(f"Task error {e}")

            update_error(task_id, e)

        time.sleep(5)


if __name__ == "__main__":
    worker()