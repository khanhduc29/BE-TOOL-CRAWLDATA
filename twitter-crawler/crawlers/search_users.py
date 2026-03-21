import asyncio


async def crawl_users_by_keyword(page, context, keyword, limit=50, delay_range=None, **kwargs):
    """
    Quét users theo keyword trên X.com
    """
    results = []
    seen_usernames = set()

    search_url = f"https://x.com/search?q={keyword}&src=typed_query&f=user"

    print(f"[USERS] Navigate to: {search_url}", flush=True)
    await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)

    # Chờ user cards load
    try:
        await page.wait_for_selector('[data-testid="UserCell"]', timeout=15000)
    except Exception:
        print("[USERS] No users found or page didn't load", flush=True)
        return results

    print(f"[USERS] Page loaded, collecting up to {limit} users...", flush=True)

    no_new_count = 0
    MAX_NO_NEW = 5

    while len(results) < limit and no_new_count < MAX_NO_NEW:
        user_cells = await page.query_selector_all('[data-testid="UserCell"]')

        old_count = len(results)

        for cell in user_cells:
            if len(results) >= limit:
                break

            try:
                user_data = await _extract_user(cell)
                username = user_data.get("username", "")
                if username and username not in seen_usernames:
                    seen_usernames.add(username)
                    results.append(user_data)
            except Exception as e:
                print(f"[USERS] Error extracting user: {e}", flush=True)
                continue

        if len(results) == old_count:
            no_new_count += 1
        else:
            no_new_count = 0
            print(f"[USERS] Collected: {len(results)}/{limit}", flush=True)

        # Scroll down
        await page.evaluate("window.scrollBy(0, 600)")
        await asyncio.sleep(1.5)

    print(f"[USERS] Done. Total: {len(results)} users", flush=True)
    return results


async def _extract_user(cell_el):
    """Extract user data from a UserCell element"""
    data = {
        "username": "",
        "display_name": "",
        "bio": "",
        "avatar_url": "",
        "followers": "",
        "following": "",
        "verified": False,
        "profile_url": "",
    }

    try:
        # Username & display name from links
        links = await cell_el.query_selector_all('a[role="link"]')
        for link in links:
            href = await link.get_attribute("href")
            if href and href.startswith("/") and len(href.strip("/").split("/")) == 1:
                username = href.strip("/")
                if username and not username.startswith("i/"):
                    data["username"] = f"@{username}"
                    data["profile_url"] = f"https://x.com/{username}"
                    break

        # Display name
        name_spans = await cell_el.query_selector_all('a[role="link"] span')
        for span in name_spans:
            text = (await span.inner_text()).strip()
            if text and not text.startswith("@"):
                data["display_name"] = text
                break

        # Avatar
        avatar_el = await cell_el.query_selector('img[src*="profile_images"]')
        if avatar_el:
            data["avatar_url"] = await avatar_el.get_attribute("src") or ""

        # Bio / description
        # Bio is typically in a div after the username section
        all_text_divs = await cell_el.query_selector_all("div")
        texts_collected = []
        for div in all_text_divs:
            text = (await div.inner_text()).strip()
            if text and not text.startswith("@") and len(text) > 20:
                texts_collected.append(text)

        if texts_collected:
            # Take the longest text as bio
            data["bio"] = max(texts_collected, key=len)

        # Verified badge
        verified_el = await cell_el.query_selector('[data-testid="icon-verified"]')
        if verified_el:
            data["verified"] = True

    except Exception as e:
        print(f"[USERS] Extract error: {e}", flush=True)

    return data
