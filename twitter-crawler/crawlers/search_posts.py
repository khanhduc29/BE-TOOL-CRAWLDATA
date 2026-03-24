import asyncio
import re
import random


async def crawl_posts_by_keyword(page, context, keyword, limit=50, sort_by="latest", delay_range=None, **kwargs):
    """
    Quét tweets theo keyword trên X.com
    sort_by: "latest" hoặc "top"
    """
    results = []
    seen_urls = set()

    # Build search URL
    tab = "live" if sort_by == "latest" else "top"
    search_url = f"https://x.com/search?q={keyword}&src=typed_query&f={tab}"

    print(f"[POSTS] Navigate to: {search_url}", flush=True)
    await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)

    # Chờ tweets load
    try:
        await page.wait_for_selector('article[data-testid="tweet"]', timeout=15000)
    except Exception:
        print("[POSTS] No tweets found or page didn't load", flush=True)
        return results

    print(f"[POSTS] Page loaded, collecting up to {limit} tweets...", flush=True)

    no_new_count = 0
    MAX_NO_NEW = 5

    while len(results) < limit and no_new_count < MAX_NO_NEW:
        # Lấy tất cả tweet articles hiện tại
        tweets = await page.query_selector_all('article[data-testid="tweet"]')

        old_count = len(results)

        for tweet in tweets:
            if len(results) >= limit:
                break

            try:
                tweet_data = await _extract_tweet(tweet, page)
                if tweet_data and tweet_data.get("url") and tweet_data["url"] not in seen_urls:
                    seen_urls.add(tweet_data["url"])
                    results.append(tweet_data)
            except Exception as e:
                print(f"[POSTS] Error extracting tweet: {e}", flush=True)
                continue

        if len(results) == old_count:
            no_new_count += 1
        else:
            no_new_count = 0
            print(f"[POSTS] Collected: {len(results)}/{limit}", flush=True)

        # Scroll down
        await page.evaluate("window.scrollBy(0, 800)")
        await asyncio.sleep(random.uniform(2, 4))

    print(f"[POSTS] Done. Total: {len(results)} tweets", flush=True)
    return results


async def _extract_tweet(tweet_el, page):
    """Extract data from a single tweet article element"""
    data = {
        "author_name": "",
        "author_username": "",
        "author_avatar": "",
        "text": "",
        "timestamp": "",
        "url": "",
        "likes": 0,
        "retweets": 0,
        "replies_count": 0,
        "views": 0,
    }

    try:
        # Author info
        user_links = await tweet_el.query_selector_all('a[role="link"][href*="/"]')
        for link in user_links:
            href = await link.get_attribute("href")
            if href and href.startswith("/") and not href.startswith("/search") and not href.startswith("/i/"):
                # Đây là link tới profile
                username = href.strip("/").split("/")[0]
                if username and not username.startswith("hashtag"):
                    data["author_username"] = f"@{username}"

                    # Lấy display name từ span
                    name_el = await link.query_selector("span")
                    if name_el:
                        data["author_name"] = (await name_el.inner_text()).strip()
                    break

        # Avatar
        avatar_el = await tweet_el.query_selector('img[src*="profile_images"]')
        if avatar_el:
            data["author_avatar"] = await avatar_el.get_attribute("src") or ""

        # Tweet text
        text_el = await tweet_el.query_selector('div[data-testid="tweetText"]')
        if text_el:
            data["text"] = (await text_el.inner_text()).strip()

        # Timestamp & URL
        time_el = await tweet_el.query_selector("time")
        if time_el:
            data["timestamp"] = await time_el.get_attribute("datetime") or ""
            parent_link = await time_el.evaluate("el => el.closest('a')?.href || ''")
            if parent_link:
                # Convert full URL to relative path
                data["url"] = parent_link

        # Engagement metrics
        # Replies
        reply_btn = await tweet_el.query_selector('[data-testid="reply"]')
        if reply_btn:
            data["replies_count"] = await _get_metric_value(reply_btn)

        # Retweets
        retweet_btn = await tweet_el.query_selector('[data-testid="retweet"]')
        if retweet_btn:
            data["retweets"] = await _get_metric_value(retweet_btn)

        # Likes
        like_btn = await tweet_el.query_selector('[data-testid="like"]')
        if like_btn:
            data["likes"] = await _get_metric_value(like_btn)

        # Views
        views_el = await tweet_el.query_selector('a[href*="/analytics"]')
        if views_el:
            data["views"] = await _get_metric_value(views_el)

    except Exception as e:
        print(f"[POSTS] Extract error: {e}", flush=True)

    return data


async def _get_metric_value(element):
    """Extract numeric value from engagement button"""
    try:
        text = (await element.inner_text()).strip()
        if not text:
            return 0
        # Parse K, M suffixes
        text = text.replace(",", "")
        if text.endswith("K"):
            return int(float(text[:-1]) * 1000)
        elif text.endswith("M"):
            return int(float(text[:-1]) * 1000000)
        return int(text)
    except (ValueError, TypeError):
        return 0
