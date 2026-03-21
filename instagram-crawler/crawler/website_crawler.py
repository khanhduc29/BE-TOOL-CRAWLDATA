import re
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright


PHONE_REGEX = r"\+?\d{1,3}[\s\-]?\(?\d{2,3}\)?[\s\-]?\d{2}[\s\-]?\d{2}[\s\-]?\d{2}[\s\-]?\d{2}"
EMAIL_REGEX = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"


def clean_phone_list(phones):

    cleaned = []

    for p in phones:

        digits = re.sub(r"\D", "", p)

        if 9 <= len(digits) <= 13:
            cleaned.append(p.strip())

    return list(set(cleaned))


def extract_social_links(page):

    socials = {
        "facebook": [],
        "instagram": [],
        "linkedin": [],
        "tiktok": [],
        "youtube": []
    }

    links = page.locator("a").all()

    for link in links:

        href = link.get_attribute("href")

        if not href:
            continue

        href = href.lower()

        if "facebook.com" in href:
            socials["facebook"].append(href)

        if "instagram.com" in href:
            socials["instagram"].append(href)

        if "linkedin.com" in href:
            socials["linkedin"].append(href)

        if "tiktok.com" in href:
            socials["tiktok"].append(href)

        if "youtube.com" in href or "youtu.be" in href:
            socials["youtube"].append(href)

    for key in socials:
        socials[key] = list(set(socials[key]))

    return socials


def crawl_website(url):

    with sync_playwright() as p:

        browser = p.chromium.launch(headless=True)

        page = browser.new_page()

        page.goto(url, timeout=60000)
        page.wait_for_timeout(3000)

        text = page.inner_text("body")

        emails = re.findall(EMAIL_REGEX, text)
        phones = re.findall(PHONE_REGEX, text)

        emails = list(set(emails))
        phones = clean_phone_list(phones)

        socials = extract_social_links(page)

        # tìm link contact nếu có
        contact_url = None

        links = page.locator("a").all()

        for link in links:

            href = link.get_attribute("href")

            if not href:
                continue

            if "contact" in href.lower():

                contact_url = urljoin(url, href)
                break

        if contact_url:

            try:

                page.goto(contact_url)
                page.wait_for_timeout(2000)

                text = page.inner_text("body")

                emails += re.findall(EMAIL_REGEX, text)
                phones += re.findall(PHONE_REGEX, text)

            except:
                pass

        browser.close()

        return {
            "emails": list(set(emails)),
            "phones": clean_phone_list(phones),
            "socials": socials
        }