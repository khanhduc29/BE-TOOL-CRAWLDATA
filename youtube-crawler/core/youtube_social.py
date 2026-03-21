# from playwright.sync_api import sync_playwright


# def get_channel_social_links(channel_id):

#     url = f"https://www.youtube.com/channel/{channel_id}/about"

#     links = []

#     with sync_playwright() as p:

#         browser = p.chromium.launch(headless=True)

#         page = browser.new_page()

#         page.goto(url, timeout=60000)

#         page.wait_for_timeout(3000)

#         elements = page.query_selector_all("a[href^='http']")

#         for el in elements:

#             href = el.get_attribute("href")

#             text = el.inner_text()

#             if href and any(
#                 domain in href
#                 for domain in [
#                     "instagram.com",
#                     "facebook.com",
#                     "twitter.com",
#                     "x.com",
#                     "tiktok.com",
#                     "discord.gg",
#                 ]
#             ):
#                 links.append(
#                     {
#                         "platform": text,
#                         "url": href,
#                     }
#                 )

#         browser.close()

#     return links


from playwright.sync_api import sync_playwright


SOCIAL_DOMAINS = [
    "instagram.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "discord.gg",
    "linkedin.com",
]


def extract_social_links(page):

    links = []

    anchors = page.query_selector_all("a[href]")

    for a in anchors:

        href = a.get_attribute("href")

        if not href:
            continue

        if any(domain in href for domain in SOCIAL_DOMAINS):

            text = a.inner_text() or ""

            links.append({
                "platform": text.strip(),
                "url": href
            })

    return links


def crawl_channel_social(page, channel_id):

    url = f"https://www.youtube.com/channel/{channel_id}/about"

    page.goto(
        url,
        timeout=60000,
        wait_until="domcontentloaded"
    )

    page.wait_for_timeout(3000)

    links = []

    anchors = page.query_selector_all("a[href]")

    for a in anchors:

        href = a.get_attribute("href")

        if not href:
            continue

        if any(domain in href for domain in [
            "instagram.com",
            "facebook.com",
            "x.com",
            "twitter.com",
            "tiktok.com"
        ]):

            links.append({
                "platform": href.split("/")[2],
                "url": href
            })

    return links
def start_browser():

    playwright = sync_playwright().start()

    browser = playwright.chromium.launch(headless=True)

    return playwright, browser