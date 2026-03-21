def calculate_engagement(likes: int, comments: int, views: int) -> float:
    if views == 0:
        return 0.0
    return round(((likes + comments) / views) * 100, 2)

def classify_video_length(duration_seconds: float) -> str:
    if duration_seconds < 60:
        return "short"
    if duration_seconds < 600:
        return "medium"
    return "long"