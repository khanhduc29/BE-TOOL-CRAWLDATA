from crawlers.search_posts import crawl_posts_by_keyword
from crawlers.search_users import crawl_users_by_keyword
from crawlers.scan_replies import crawl_tweet_replies


SCAN_DISPATCHER = {
    "posts": crawl_posts_by_keyword,
    "users": crawl_users_by_keyword,
    "replies": crawl_tweet_replies,
}


async def dispatch_scan(scan_type: str, page, context, input_data: dict):
    if scan_type not in SCAN_DISPATCHER:
        raise ValueError(f"❌ Unsupported scan_type: {scan_type}")

    crawl_func = SCAN_DISPATCHER[scan_type]
    return await crawl_func(page=page, context=context, **input_data)
