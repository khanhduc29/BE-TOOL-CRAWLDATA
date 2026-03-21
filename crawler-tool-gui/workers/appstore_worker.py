"""
App Store Worker
- Tìm kiếm app theo keyword qua iTunes Search API
- Cào reviews qua Apple RSS Feed
- Standalone worker: poll API backend for tasks
"""

import sys
import os
import time
import json
import requests
import traceback

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

API_BASE = os.environ.get("API_BASE_URL", "http://localhost:3000")


# ─────────────────────────────────────────────────────────────
# App Store APIs
# ─────────────────────────────────────────────────────────────

def search_apps(keyword, country="vn", limit=50):
    """Tìm kiếm app trên App Store qua iTunes Search API."""
    url = "https://itunes.apple.com/search"
    params = {
        "term": keyword,
        "entity": "software",
        "country": country,
        "limit": min(limit, 50),
    }
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    results = resp.json().get("results", [])

    apps = []
    for r in results:
        apps.append({
            "trackId": r.get("trackId"),
            "trackName": r.get("trackName", ""),
            "bundleId": r.get("bundleId", ""),
            "artworkUrl100": r.get("artworkUrl100", ""),
            "artworkUrl60": r.get("artworkUrl60", ""),
            "artistName": r.get("artistName", ""),
            "averageUserRating": round(r.get("averageUserRating", 0), 1),
            "userRatingCount": r.get("userRatingCount", 0),
            "primaryGenreName": r.get("primaryGenreName", ""),
            "price": r.get("price", 0),
            "formattedPrice": r.get("formattedPrice", "Free"),
            "description": (r.get("description", "")[:200] + "...")
            if len(r.get("description", "")) > 200
            else r.get("description", ""),
        })
    return apps


def fetch_reviews_rss(app_id, country="us", max_pages=10):
    """Cào reviews qua Apple RSS Feed."""
    all_reviews = []

    for page in range(1, max_pages + 1):
        url = (
            f"https://itunes.apple.com/{country}/rss/customerreviews"
            f"/page={page}/id={app_id}/sortBy=mostRecent/json"
        )
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code != 200:
                break

            data = resp.json()
            entries = data.get("feed", {}).get("entry", [])
            if not entries:
                break

            for e in entries:
                if "im:rating" not in e:
                    continue
                rating = int(e.get("im:rating", {}).get("label", "0"))
                review = {
                    "title": e.get("title", {}).get("label", ""),
                    "content": e.get("content", {}).get("label", ""),
                    "rating": rating,
                    "userName": e.get("author", {}).get("name", {}).get("label", "Unknown"),
                    "date": e.get("updated", {}).get("label", ""),
                    "voteCount": e.get("im:voteCount", {}).get("label", "0"),
                    "voteSum": e.get("im:voteSum", {}).get("label", "0"),
                    "appVersion": e.get("im:version", {}).get("label", ""),
                }
                all_reviews.append(review)
        except Exception:
            break

    return all_reviews


# ─────────────────────────────────────────────────────────────
# API Client
# ─────────────────────────────────────────────────────────────

def get_pending_task():
    try:
        res = requests.get(f"{API_BASE}/api/appstore/task/pending", timeout=10)
        data = res.json()
        return data.get("data")
    except Exception as e:
        print(f"[APPSTORE] Error fetching task: {e}")
        return None


def update_task(task_id, status, result=None, error_msg=None):
    try:
        payload = {"status": status, "result": result, "error_message": error_msg}
        requests.patch(f"{API_BASE}/api/appstore/task/{task_id}", json=payload, timeout=10)
    except Exception as e:
        print(f"[APPSTORE] Error updating task: {e}")


# ─────────────────────────────────────────────────────────────
# Worker Loop
# ─────────────────────────────────────────────────────────────

def process_task(task):
    task_id = task.get("_id")
    scan_type = str(task.get("scan_type", "")).strip().lower()
    input_data = task.get("input", {})

    print(f"[APPSTORE] Processing task {task_id} | type={scan_type}")

    try:
        if scan_type == "search":
            result = search_apps(
                keyword=input_data.get("keyword", ""),
                country=input_data.get("country", "vn"),
                limit=input_data.get("limit", 50),
            )
        elif scan_type == "reviews":
            app_id = input_data.get("app_id", "")
            country = input_data.get("country", "vn")
            max_pages = input_data.get("max_pages", 10)

            result = fetch_reviews_rss(app_id, country=country, max_pages=max_pages)

            # Fallback to US if no results
            if not result and country != "us":
                result = fetch_reviews_rss(app_id, country="us", max_pages=max_pages)

        else:
            raise ValueError(f"Unsupported scan_type: {scan_type}")

        update_task(task_id, "success", result=result)
        print(f"[APPSTORE] Task {task_id} SUCCESS — {len(result) if isinstance(result, list) else 'ok'}")

    except Exception as e:
        tb = traceback.format_exc()
        print(f"[APPSTORE] Task {task_id} ERROR: {e}")
        update_task(task_id, "error", error_msg=str(e))


def run_worker():
    print("[APPSTORE] App Store Worker Started...")
    poll_interval = int(os.environ.get("POLL_INTERVAL", "30"))

    while True:
        task = get_pending_task()
        if task:
            process_task(task)
        else:
            print(f"[APPSTORE] No pending task — sleep {poll_interval}s")
        time.sleep(poll_interval)


if __name__ == "__main__":
    run_worker()
