"""
CH Play (Google Play) Worker
- Tìm kiếm app theo keyword qua google-play-scraper
- Cào reviews & phân loại theo số sao
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
# Google Play Scraper
# ─────────────────────────────────────────────────────────────

try:
    from google_play_scraper import search, reviews, Sort, app as gplay_app
    HAS_GPLAY = True
except ImportError:
    HAS_GPLAY = False
    print("[CHPLAY] WARNING: google_play_scraper not installed. Run: pip install google-play-scraper")


def search_apps(keyword, country="vn", lang="vi", limit=50):
    """Tìm kiếm app trên Google Play."""
    if not HAS_GPLAY:
        raise RuntimeError("google_play_scraper not installed")

    results = search(keyword, lang=lang, country=country, n_hits=min(limit, 50))
    apps = []
    for r in results:
        app_id = r.get("appId")
        if not app_id:
            continue
        apps.append({
            "appId": app_id,
            "title": r.get("title", ""),
            "icon": r.get("icon", ""),
            "developer": r.get("developer", ""),
            "score": round(r.get("score", 0) or 0, 1),
            "ratings": r.get("ratings", 0) or 0,
            "genre": r.get("genre", ""),
            "free": r.get("free", True),
            "price": r.get("price", "0"),
            "description": (r.get("description", "")[:200] + "...")
            if len(r.get("description", "") or "") > 200
            else r.get("description", ""),
            "installs": r.get("installs", ""),
        })
    return apps


def fetch_reviews(app_id, country="vn", lang="vi", count=200):
    """Cào reviews từ Google Play Store."""
    if not HAS_GPLAY:
        raise RuntimeError("google_play_scraper not installed")

    all_reviews = []
    try:
        result, token = reviews(
            app_id, lang=lang, country=country,
            sort=Sort.NEWEST, count=min(count, 200),
        )
        all_reviews.extend(result)

        fetched = len(result)
        while token and fetched < count:
            batch_size = min(200, count - fetched)
            result, token = reviews(
                app_id, lang=lang, country=country,
                sort=Sort.NEWEST, count=batch_size,
                continuation_token=token,
            )
            if not result:
                break
            all_reviews.extend(result)
            fetched += len(result)
    except Exception as e:
        print(f"[CHPLAY] Error fetching reviews: {e}")

    # Format reviews
    formatted = []
    for r in all_reviews:
        formatted.append({
            "userName": r.get("userName", "Ẩn danh"),
            "content": r.get("content", ""),
            "rating": r.get("score", 0),
            "date": str(r.get("at", "")),
            "thumbsUpCount": r.get("thumbsUpCount", 0),
            "reviewCreatedVersion": r.get("reviewCreatedVersion", ""),
            "replyContent": r.get("replyContent", ""),
            "replyDate": str(r.get("repliedAt", "")) if r.get("repliedAt") else "",
        })
    return formatted


# ─────────────────────────────────────────────────────────────
# API Client
# ─────────────────────────────────────────────────────────────

def get_pending_task():
    try:
        res = requests.get(f"{API_BASE}/api/chplay/task/pending", timeout=10)
        data = res.json()
        return data.get("data")
    except Exception as e:
        print(f"[CHPLAY] Error fetching task: {e}")
        return None


def update_task(task_id, status, result=None, error_msg=None):
    try:
        payload = {"status": status, "result": result, "error_message": error_msg}
        requests.patch(f"{API_BASE}/api/chplay/task/{task_id}", json=payload, timeout=10)
    except Exception as e:
        print(f"[CHPLAY] Error updating task: {e}")


# ─────────────────────────────────────────────────────────────
# Worker Loop
# ─────────────────────────────────────────────────────────────

def process_task(task):
    task_id = task.get("_id")
    scan_type = str(task.get("scan_type", "")).strip().lower()
    input_data = task.get("input", {})

    print(f"[CHPLAY] Processing task {task_id} | type={scan_type}")

    try:
        if scan_type == "search":
            result = search_apps(
                keyword=input_data.get("keyword", ""),
                country=input_data.get("country", "vn"),
                lang=input_data.get("lang", "vi"),
                limit=input_data.get("limit", 50),
            )
        elif scan_type == "reviews":
            result = fetch_reviews(
                app_id=input_data.get("app_id", ""),
                country=input_data.get("country", "vn"),
                lang=input_data.get("lang", "vi"),
                count=input_data.get("count", 200),
            )
        else:
            raise ValueError(f"Unsupported scan_type: {scan_type}")

        update_task(task_id, "success", result=result)
        print(f"[CHPLAY] Task {task_id} SUCCESS — {len(result) if isinstance(result, list) else 'ok'}")

    except Exception as e:
        tb = traceback.format_exc()
        print(f"[CHPLAY] Task {task_id} ERROR: {e}")
        update_task(task_id, "error", error_msg=str(e))


def run_worker():
    print("[CHPLAY] CH Play Worker Started...")
    poll_interval = int(os.environ.get("POLL_INTERVAL", "30"))

    while True:
        task = get_pending_task()
        if task:
            process_task(task)
        else:
            print(f"[CHPLAY] No pending task — sleep {poll_interval}s")
        time.sleep(poll_interval)


if __name__ == "__main__":
    run_worker()
