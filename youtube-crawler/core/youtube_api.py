from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from config import YOUTUBE_API_KEY

youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)


def safe_execute(request):
    try:
        return request.execute()
    except HttpError as e:
        print(f"YouTube API Error: {e}")
        return None


def search_channels(keyword, max_results=10):
    request = youtube.search().list(
        q=keyword,
        type="channel",
        part="snippet",
        maxResults=max_results
    )
    return safe_execute(request)


def search_videos(keyword, max_results=10):
    request = youtube.search().list(
        q=keyword,
        type="video",
        part="snippet",
        maxResults=max_results
    )
    return safe_execute(request)


def get_channel_details(channel_id):
    request = youtube.channels().list(
        id=channel_id,
        part="snippet,statistics,brandingSettings,topicDetails"
    )
    return safe_execute(request)


def get_video_details(video_ids):
    request = youtube.videos().list(
        id=",".join(video_ids),
        part="snippet,statistics,contentDetails"
    )
    return safe_execute(request)


def get_video_comments(video_id, max_results=50):
    request = youtube.commentThreads().list(
        videoId=video_id,
        part="snippet",
        maxResults=max_results
    )
    return safe_execute(request)