import asyncio


async def crawl_tweet_replies(page, context, tweet_url, limit=100, delay_range=None, **kwargs):
    """
    Quét replies (comments) trên một tweet cụ thể
    """
    results = []
    seen_urls = set()

    print(f"[REPLIES] Navigate to: {tweet_url}", flush=True)
    await page.goto(tweet_url, wait_until="domcontentloaded", timeout=30000)

    # Chờ tweet chính load
    try:
        await page.wait_for_selector('article[data-testid="tweet"]', timeout=15000)
    except Exception:
        print("[REPLIES] Tweet not found or page didn't load", flush=True)
        return results

    # Chờ thêm để replies load
    await asyncio.sleep(2)

    print(f"[REPLIES] Page loaded, collecting up to {limit} replies...", flush=True)

    no_new_count = 0
    MAX_NO_NEW = 5
    is_first_tweet = True  # Skip tweet đầu tiên (bài gốc)

    while len(results) < limit and no_new_count < MAX_NO_NEW:
        tweets = await page.query_selector_all('article[data-testid="tweet"]')

        old_count = len(results)

        for tweet in tweets:
            # Skip bài tweet gốc (bài đầu tiên)
            if is_first_tweet:
                is_first_tweet = False
                continue

            if len(results) >= limit:
                break

            try:
                reply_data = await _extract_reply(tweet)
                reply_id = reply_data.get("url", "") or reply_data.get("text", "")[:50]
                if reply_id and reply_id not in seen_urls:
                    seen_urls.add(reply_id)
                    results.append(reply_data)
            except Exception as e:
                print(f"[REPLIES] Error extracting reply: {e}", flush=True)
                continue

        if len(results) == old_count:
            no_new_count += 1
        else:
            no_new_count = 0
            print(f"[REPLIES] Collected: {len(results)}/{limit}", flush=True)

        # Scroll down
        await page.evaluate("window.scrollBy(0, 600)")
        await asyncio.sleep(1.5)

    print(f"[REPLIES] Done. Total: {len(results)} replies", flush=True)
    return results


async def _extract_reply(tweet_el):
    """Extract data from a reply tweet element"""
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
    }

    try:
        # Author info
        user_links = await tweet_el.query_selector_all('a[role="link"][href*="/"]')
        for link in user_links:
            href = await link.get_attribute("href")
            if href and href.startswith("/") and not href.startswith("/search") and not href.startswith("/i/"):
                username = href.strip("/").split("/")[0]
                if username and not username.startswith("hashtag"):
                    data["author_username"] = f"@{username}"

                    name_el = await link.query_selector("span")
                    if name_el:
                        data["author_name"] = (await name_el.inner_text()).strip()
                    break

        # Avatar
        avatar_el = await tweet_el.query_selector('img[src*="profile_images"]')
        if avatar_el:
            data["author_avatar"] = await avatar_el.get_attribute("src") or ""

        # Reply text
        text_el = await tweet_el.query_selector('div[data-testid="tweetText"]')
        if text_el:
            data["text"] = (await text_el.inner_text()).strip()

        # Timestamp & URL
        time_el = await tweet_el.query_selector("time")
        if time_el:
            data["timestamp"] = await time_el.get_attribute("datetime") or ""
            parent_link = await time_el.evaluate("el => el.closest('a')?.href || ''")
            if parent_link:
                data["url"] = parent_link

        # Engagement
        reply_btn = await tweet_el.query_selector('[data-testid="reply"]')
        if reply_btn:
            data["replies_count"] = await _get_metric(reply_btn)

        retweet_btn = await tweet_el.query_selector('[data-testid="retweet"]')
        if retweet_btn:
            data["retweets"] = await _get_metric(retweet_btn)

        like_btn = await tweet_el.query_selector('[data-testid="like"]')
        if like_btn:
            data["likes"] = await _get_metric(like_btn)

    except Exception as e:
        print(f"[REPLIES] Extract error: {e}", flush=True)

    return data


async def _get_metric(element):
    """Extract number from engagement button"""
    try:
        text = (await element.inner_text()).strip()
        if not text:
            return 0
        text = text.replace(",", "")
        if text.endswith("K"):
            return int(float(text[:-1]) * 1000)
        elif text.endswith("M"):
            return int(float(text[:-1]) * 1000000)
        return int(text)
    except (ValueError, TypeError):
        return 0
