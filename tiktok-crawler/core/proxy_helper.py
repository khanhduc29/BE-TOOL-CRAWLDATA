"""
Proxy Helper — Fetch a random active proxy from the backend API.
Shared utility for all Python-based crawlers.
"""
import os
import requests

API_BASE = os.environ.get("API_BASE_URL", "http://localhost:3000")


def fetch_random_proxy():
    """
    Gọi backend API để lấy 1 proxy active ngẫu nhiên.
    Returns dict { host, port, username, password, protocol } hoặc None.
    """
    try:
        url = f"{API_BASE}/api/proxies/random"
        res = requests.get(url, timeout=5)
        res.raise_for_status()
        data = res.json()

        if data.get("success") and data.get("data"):
            proxy = data["data"]
            print(f"[PROXY] ✅ Got proxy: {proxy['host']}:{proxy['port']} ({proxy.get('country', '?')})", flush=True)
            return proxy
        else:
            print("[PROXY] ⚠️ No active proxy available — running without proxy", flush=True)
            return None

    except Exception as e:
        print(f"[PROXY] ⚠️ Failed to fetch proxy: {e} — running without proxy", flush=True)
        return None


def get_playwright_proxy(proxy_data):
    """
    Chuyển proxy data thành format Playwright proxy config.
    Returns dict cho browser.launch(proxy=...) hoặc None.
    """
    if not proxy_data:
        return None

    protocol = proxy_data.get("protocol", "http")
    server = f"{protocol}://{proxy_data['host']}:{proxy_data['port']}"

    proxy_config = {"server": server}

    if proxy_data.get("username"):
        proxy_config["username"] = proxy_data["username"]
    if proxy_data.get("password"):
        proxy_config["password"] = proxy_data["password"]

    print(f"[PROXY] 🔧 Playwright proxy config: {server}", flush=True)
    return proxy_config


def get_requests_proxy(proxy_data):
    """
    Chuyển proxy data thành format requests library proxies dict.
    Returns dict cho requests.get(proxies=...) hoặc None.
    """
    if not proxy_data:
        return None

    protocol = proxy_data.get("protocol", "http")

    if proxy_data.get("username"):
        proxy_url = f"{protocol}://{proxy_data['username']}:{proxy_data['password']}@{proxy_data['host']}:{proxy_data['port']}"
    else:
        proxy_url = f"{protocol}://{proxy_data['host']}:{proxy_data['port']}"

    proxies = {
        "http": proxy_url,
        "https": proxy_url,
    }

    print(f"[PROXY] 🔧 Requests proxy config: {proxy_data['host']}:{proxy_data['port']}", flush=True)
    return proxies
