"""Quick test: reproduce TikTok crawl error"""
import asyncio
import sys
import traceback

sys.path.insert(0, ".")

from core.browser import create_browser
from crawlers.scan_top_posts import extract_top_videos

SESSION_FILE = "tiktok_session.json"


async def main():
    print("🚀 START TEST CRAWL")

    playwright = None
    browser = None
    context = None
    page = None

    try:
        print("1️⃣ Creating browser...")
        playwright, browser, context, _ = await create_browser(
            headless=False,
            session_file=SESSION_FILE
        )
        print("✅ Browser created")

        page = await context.new_page()
        print("✅ Page created")

        print("2️⃣ Start crawl top_posts for keyword='test'...")
        result = await extract_top_videos(page, "test", 3)
        print(f"✅ RESULT: {len(result)} videos found")
        for v in result:
            print(f"   - {v.get('video_id')} | views={v.get('view_count')}")

    except Exception as e:
        print(f"\n❌ CRAWL ERROR: {e}")
        print(f"📋 TRACEBACK:\n{traceback.format_exc()}")

    finally:
        if page:
            try: await page.close()
            except: pass
        if context:
            try: await context.close()
            except: pass
        if browser:
            try: await browser.close()
            except: pass
        if playwright:
            try: await playwright.stop()
            except: pass

    print("🏁 TEST DONE")


if __name__ == "__main__":
    asyncio.run(main())
