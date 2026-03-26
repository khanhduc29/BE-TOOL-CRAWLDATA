import re
from urllib.parse import urlparse, parse_qs, unquote
from playwright.sync_api import sync_playwright
from crawler.proxy_helper import fetch_random_proxy, get_playwright_proxy


def clean_number(text):
    if not text:
        return None

    text = text.lower().replace(",", "").strip()

    if "k" in text:
        return int(float(text.replace("k", "")) * 1000)

    if "m" in text:
        return int(float(text.replace("m", "")) * 1000000)

    try:
        return int(text)
    except:
        return text


def decode_instagram_url(url):

    if not url:
        return None

    if "l.instagram.com" not in url:
        return url

    parsed = urlparse(url)
    query = parse_qs(parsed.query)

    if "u" in query:
        return unquote(query["u"][0])

    return url


def clean_url(url):

    if not url:
        return None

    parsed = urlparse(url)

    return f"{parsed.scheme}://{parsed.netloc}"


def extract_phone(text):

    raw_phones = re.findall(
        r"\+?\d[\d\s\-]{8,}",
        text
    )

    phones = []

    for p in raw_phones:

        digits = re.sub(r"\D", "", p)

        if 9 <= len(digits) <= 15:
            phones.append(p.strip())

    phones = list(set(phones))

    return phones[0] if phones else None


def extract_email(text):

    emails = re.findall(
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        text
    )

    emails = list(set(emails))

    return emails[0] if emails else None


def crawl_instagram_profile(url):

    # 🌐 Fetch random proxy
    proxy_data = fetch_random_proxy()
    proxy_config = get_playwright_proxy(proxy_data)

    with sync_playwright() as p:

        launch_kwargs = {
            "user_data_dir": "./insta_session",
            "headless": True,
        }
        if proxy_config:
            launch_kwargs["proxy"] = proxy_config

        context = p.chromium.launch_persistent_context(**launch_kwargs)

        page = context.new_page()

        page.goto(url, timeout=10000)
        page.wait_for_timeout(1000)

        result = {}

        # username
        result["username"] = url.rstrip("/").split("/")[-1]
        print("[CRAWLER] Username:", result["username"])
        header_text = page.inner_text("header")
        print("[CRAWLER] Header loaded")
        
        # avatar
        try:
            avatar = page.locator('header img').first.get_attribute("src")
            result["avatar"] = avatar
            print("[CRAWLER] Avatar found")
        except:
            result["avatar"] = None
            print("[CRAWLER] Avatar not found")
        
        
        # name (line thứ 2 sau username)
        lines = [x.strip() for x in header_text.split("\n") if x.strip()]

        if len(lines) >= 2:
            result["name"] = lines[1]
        else:
            result["name"] = None

        # stats — thử parse từ header text trước (Instagram thường đổi DOM)
        result["posts"] = None
        result["followers"] = None
        result["following"] = None

        # Cách 1: Parse từ header_text: "X posts", "Y followers", "Z following"
        try:
            posts_match = re.search(r"([\d,\.]+[KkMm]?)\s+posts?", header_text)
            followers_match = re.search(r"([\d,\.]+[KkMm]?)\s+followers?", header_text)
            following_match = re.search(r"([\d,\.]+[KkMm]?)\s+following", header_text)

            if posts_match:
                result["posts"] = clean_number(posts_match.group(1))
            if followers_match:
                result["followers"] = clean_number(followers_match.group(1))
            if following_match:
                result["following"] = clean_number(following_match.group(1))

            print("[CRAWLER] Stats (from text):", result["posts"], result["followers"], result["following"])
        except Exception as e:
            print("[CRAWLER] Stats text parse error:", e)

        # Cách 2: Fallback tới CSS selectors nếu cách 1 không lấy được
        if result["followers"] is None:
            try:
                posts_text = page.locator('li:has-text("posts")').inner_text()
                followers_text = page.locator('a[href*="followers"]').inner_text()
                following_text = page.locator('a[href*="following"]').inner_text()

                posts = re.search(r"\d[\d,]*", posts_text)
                followers = re.search(r"\d[\d,]*", followers_text)
                following = re.search(r"\d[\d,]*", following_text)

                result["posts"] = clean_number(posts.group()) if posts else result["posts"]
                result["followers"] = clean_number(followers.group()) if followers else result["followers"]
                result["following"] = clean_number(following.group()) if following else result["following"]

                print("[CRAWLER] Stats (from selectors):", result["posts"], result["followers"], result["following"])
            except Exception as e:
                print("[CRAWLER] Stats selector error:", e)

        # bio block
        try:

            bio_text = header_text

            result["bio"] = bio_text
            print("[CRAWLER] Bio found")

        except Exception as e:
            print("[CRAWLER] Bio error:", e)
            result["bio"] = None

        # website
        try:

            link = page.locator('a[href*="l.instagram.com"]').first.get_attribute("href")

            decoded = decode_instagram_url(link)

            result["website"] = clean_url(decoded)
            print("[CRAWLER] Website found:", result["website"])

        except Exception as e:
            print("[CRAWLER] Website error:", e)
            result["website"] = None

        # email
        result["email"] = extract_email(header_text)
        if result["email"]:
            print("[CRAWLER] Email:", result["email"])

        # phone
        result["phone"] = extract_phone(header_text)
        if result["phone"]:
            print("[CRAWLER] Phone:", result["phone"])

        context.close()

        return result