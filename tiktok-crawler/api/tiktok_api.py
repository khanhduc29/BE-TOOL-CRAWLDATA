import os
import requests
API_BASE = os.environ.get("API_BASE_URL", "http://localhost:3000") + "/api/tiktok"
WORKER_ID = os.environ.get("WORKER_ID", "")

# API_BASE = "https://be-tool-crawldata.onrender.com/api/tiktok"


def fetch_pending_task():
    params = {}
    if WORKER_ID:
        params["worker_id"] = WORKER_ID
    res = requests.get(f"{API_BASE}/task/pending", params=params, timeout=10)
    res.raise_for_status()
    data = res.json()

    # Không có task
    if not data:
        return None

    # Nếu là list → lấy task đầu tiên
    if isinstance(data, list):
        return data[0] if data else None

    # Nếu có wrapper { data: {...} }
    if isinstance(data, dict) and "data" in data:
        return data["data"]

    # Nếu là object task
    return data

def update_task_status(task_id, status, result=None):
    payload = {"status": status}
    if result is not None:
        payload["result"] = result
        # Nếu là error, gửi error_message riêng cho backend
        if status == "error" and isinstance(result, dict) and "error" in result:
            payload["error_message"] = result["error"]

    print(f"[UPDATE] task={task_id} status={status} has_result={result is not None}", flush=True)

    try:
        resp = requests.patch(
            f"{API_BASE}/task/{task_id}",
            json=payload,
            timeout=30
        )
        if resp.status_code != 200:
            print(f"[WARN] PATCH failed: {resp.status_code} -- {resp.text[:200]}", flush=True)
        else:
            print(f"[OK] Task {task_id} updated to {status}", flush=True)
    except Exception as e:
        print(f"[ERROR] update_task_status FAILED: {e}", flush=True)