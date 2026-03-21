"""
Export cookies từ Chrome browser (đã login X.com) 
→ Tạo file twitter_session.json cho Playwright crawler dùng.

Cách dùng:
1. Đóng hết Chrome (quan trọng!)
2. Chạy: python export_cookies.py
3. File twitter_session.json sẽ được tạo
4. Bật lại Twitter crawler — nó sẽ dùng session này, không cần login lại
"""

import os
import sys
import json
import shutil
import sqlite3
import tempfile

# ===== TÌM CHROME PROFILE =====
def find_chrome_cookies_db():
    """Tìm file Cookies của Chrome"""
    paths = [
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cookies"),
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data\Profile 1\Cookies"),
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data\Default\Network\Cookies"),
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data\Profile 1\Network\Cookies"),
    ]
    for p in paths:
        if os.path.exists(p):
            print(f"[OK] Found Chrome cookies: {p}")
            return p
    return None


def export_twitter_cookies():
    """Export cookies cho domain x.com và twitter.com từ Chrome"""
    
    db_path = find_chrome_cookies_db()
    if not db_path:
        print("[ERROR] Không tìm thấy file Cookies của Chrome!")
        print("Thử cách thủ công: xem hướng dẫn bên dưới")
        return False

    # Copy DB vì Chrome lock file khi đang chạy
    tmp_db = os.path.join(tempfile.gettempdir(), "chrome_cookies_tmp.db")
    try:
        shutil.copy2(db_path, tmp_db)
    except PermissionError:
        print("[ERROR] Chrome đang chạy! Hãy đóng Chrome hoàn toàn rồi chạy lại script.")
        print("(Đóng cả Chrome ở system tray)")
        return False

    conn = sqlite3.connect(tmp_db)
    cursor = conn.cursor()

    # Query cookies cho x.com và twitter.com
    cursor.execute("""
        SELECT host_key, name, value, path, expires_utc, is_secure, is_httponly, samesite
        FROM cookies 
        WHERE host_key LIKE '%x.com%' OR host_key LIKE '%twitter.com%'
    """)
    
    rows = cursor.fetchall()
    conn.close()
    os.remove(tmp_db)

    if not rows:
        print("[WARNING] Không tìm thấy cookies cho x.com/twitter.com trong Chrome!")
        print("Có thể Chrome dùng encrypted cookies (Windows 10+).")
        print("\n→ Dùng cách thủ công: xem hướng dẫn bên dưới")
        return False

    # Convert sang Playwright storage_state format
    cookies = []
    for host_key, name, value, path, expires_utc, is_secure, is_httponly, samesite in rows:
        if not value:  # Skip encrypted cookies
            continue
        cookie = {
            "name": name,
            "value": value,
            "domain": host_key,
            "path": path or "/",
            "expires": expires_utc / 1000000 - 11644473600 if expires_utc else -1,
            "httpOnly": bool(is_httponly),
            "secure": bool(is_secure),
            "sameSite": ["None", "Lax", "Strict"][samesite] if samesite in (0, 1, 2) else "None",
        }
        cookies.append(cookie)

    session = {
        "cookies": cookies,
        "origins": []
    }

    output_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "twitter_session.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(session, f, ensure_ascii=False, indent=2)

    print(f"\n[SUCCESS] Exported {len(cookies)} cookies → {output_file}")
    return True


def print_manual_guide():
    """Hướng dẫn export cookie thủ công bằng DevTools"""
    print("""
╔══════════════════════════════════════════════════════════════╗
║           HƯỚNG DẪN EXPORT COOKIE THỦ CÔNG                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  1. Mở Chrome → vào https://x.com (đã login)                ║
║  2. Nhấn F12 → mở DevTools                                  ║
║  3. Chọn tab Console                                         ║
║  4. Paste đoạn code sau và Enter:                            ║
║                                                              ║
║     copy(document.cookie)                                    ║
║                                                              ║
║  5. Cookie đã copy vào clipboard                             ║
║  6. Chạy lại script này với flag --paste:                    ║
║                                                              ║
║     python export_cookies.py --paste                         ║
║                                                              ║
║  7. Paste cookie string khi được hỏi                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
""")


def from_cookie_string(cookie_str):
    """Parse cookie string (document.cookie format) → session file"""
    cookies = []
    for pair in cookie_str.split(";"):
        pair = pair.strip()
        if "=" not in pair:
            continue
        name, _, value = pair.partition("=")
        cookies.append({
            "name": name.strip(),
            "value": value.strip(),
            "domain": ".x.com",
            "path": "/",
            "expires": -1,
            "httpOnly": False,
            "secure": True,
            "sameSite": "None",
        })

    if not cookies:
        print("[ERROR] Không parse được cookies!")
        return False

    session = {
        "cookies": cookies,
        "origins": []
    }

    output_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "twitter_session.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(session, f, ensure_ascii=False, indent=2)

    print(f"\n[SUCCESS] Exported {len(cookies)} cookies → {output_file}")
    return True


if __name__ == "__main__":
    print("=" * 50)
    print("  TWITTER COOKIE EXPORTER")
    print("=" * 50)

    if "--paste" in sys.argv:
        print("\nPaste cookie string (từ document.cookie) rồi Enter:")
        cookie_str = input("> ").strip()
        if cookie_str:
            from_cookie_string(cookie_str)
        else:
            print("[ERROR] Không có input!")
    else:
        success = export_twitter_cookies()
        if not success:
            print_manual_guide()
