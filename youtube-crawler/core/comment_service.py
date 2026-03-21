import re
import html
from core.youtube_api import get_video_comments
from core.classifier import classify_intent
from utils.language import detect_language


def clean_youtube_text(text: str) -> str:
    if not text:
        return ""

    # decode HTML entities (&amp;, &#39;...)
    text = html.unescape(text)

    # convert <br> to newline
    text = re.sub(r"<br\s*/?>", "\n", text)

    # remove all remaining html tags
    text = re.sub(r"<.*?>", "", text)

    return text.strip()


def scan_video_comments(video_id: str, max_results=20):
    data = get_video_comments(video_id, max_results)

    if not data or "items" not in data:
        return []

    results = []

    for item in data["items"]:
        comment_data = item["snippet"]["topLevelComment"]["snippet"]

        raw_text = comment_data.get("textOriginal") or comment_data.get("textDisplay", "")
        text = clean_youtube_text(raw_text)

        results.append({
            "author": comment_data.get("authorDisplayName"),
            "content": text,
            "language": detect_language(text),
            "intent": classify_intent(text),
            "likes": comment_data.get("likeCount", 0),
            "published_at": comment_data.get("publishedAt")
        })

    return results