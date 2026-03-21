import time
import random

from core.youtube_api import search_channels, get_channel_details
from core.youtube_social import crawl_channel_social, start_browser


def scan_channels_by_keyword(keyword: str, max_results=20, deep_scan_social=False):

    data = search_channels(keyword, max_results)

    if not data or "items" not in data:
        return []

    results = []

    browser = None
    playwright = None
    page = None

    # =================================
    # START BROWSER
    # =================================
    if deep_scan_social:

        print("Starting Playwright browser")

        playwright, browser = start_browser()

        context = browser.new_context()

        page = context.new_page()

    for item in data["items"]:

        channel_id = item["snippet"]["channelId"]

        detail = get_channel_details(channel_id)

        if not detail or not detail.get("items"):
            continue

        info = detail["items"][0]

        snippet = info["snippet"]
        stats = info["statistics"]

        result = {

            "name": snippet.get("title"),
            "channel_id": channel_id,
            "channel_url": f"https://youtube.com/channel/{channel_id}",
            "custom_url": snippet.get("customUrl"),
            "avatar": snippet.get("thumbnails", {}).get("default", {}).get("url"),
            "subscribers": int(stats.get("subscriberCount", 0)),
            "total_videos": int(stats.get("videoCount", 0)),
            "total_views": int(stats.get("viewCount", 0)),
            "created_at": snippet.get("publishedAt"),
            "description": snippet.get("description"),
            "country": snippet.get("country"),

        }

        # =================================
        # DEEP SCAN
        # =================================
        if deep_scan_social:

            print(f"Crawling social links: {channel_id}")

            try:

                links = crawl_channel_social(page, channel_id)

                result["social_links"] = links

            except Exception as e:

                print(f"Crawl failed {channel_id}: {e}")

                result["social_links"] = []

            time.sleep(random.uniform(1.2, 2.5))

        results.append(result)

    # =================================
    # CLOSE BROWSER
    # =================================
    if browser:

        browser.close()

        playwright.stop()

        print("Browser closed")

    return results