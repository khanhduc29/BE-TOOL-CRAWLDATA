from core.youtube_api import search_videos, get_video_details
from core.metrics import calculate_engagement, classify_video_length
from utils.helpers import parse_duration


def scan_videos_by_keyword(keyword: str, max_results=20):
    data = search_videos(keyword, max_results)

    if not data or "items" not in data:
        return []

    video_ids = []

    for item in data["items"]:
        video_id = item["id"].get("videoId")
        if video_id:
            video_ids.append(video_id)

    if not video_ids:
        return []

    detail = get_video_details(video_ids)

    if not detail or "items" not in detail:
        return []

    results = []

    for item in detail["items"]:
        snippet = item["snippet"]
        stats = item["statistics"]
        content = item["contentDetails"]

        duration_seconds = parse_duration(content["duration"])

        views = int(stats.get("viewCount", 0))
        likes = int(stats.get("likeCount", 0))
        comments = int(stats.get("commentCount", 0))
        video_id = item["id"]

        # results.append({
        #     "video_id": item["id"],
        #     "video_url": f"https://youtube.com/watch?v={video_id}",
        #     "title": snippet["title"],
        #     "channel": snippet["channelTitle"],
        #     "published_at": snippet["publishedAt"],
        #     "views": views,
        #     "likes": likes,
        #     "comments": comments,
        #     "duration_seconds": duration_seconds,
        #     "video_type": classify_video_length(duration_seconds),
        #     "engagement_rate": calculate_engagement(likes, comments, views),
        #     "tags": list(set(snippet.get("tags", [])))
        # })
        results.append({
            "video_id": video_id,
            "video_url": f"https://youtube.com/watch?v={video_id}",
            "title": snippet.get("title"),
            "description": snippet.get("description"),
            "channel_id": snippet.get("channelId"),
            "channel": snippet.get("channelTitle"),
            "published_at": snippet.get("publishedAt"),
            "category_id": snippet.get("categoryId"),
            "default_language": snippet.get("defaultLanguage"),
            "audio_language": snippet.get("defaultAudioLanguage"),
            "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url"),
            "views": views,
            "likes": likes,
            "comments": comments,
            "duration_seconds": duration_seconds,
            "video_type": classify_video_length(duration_seconds),
            "definition": content.get("definition"),
            "has_caption": content.get("caption") == "true",
            "engagement_rate": calculate_engagement(likes, comments, views),
            "tags": list(set(snippet.get("tags", [])))
        })

    return results