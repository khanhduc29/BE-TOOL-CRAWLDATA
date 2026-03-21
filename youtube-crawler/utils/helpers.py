import isodate


def parse_duration(duration_iso: str) -> float:
    """
    Convert ISO8601 duration (PT1M30S) to seconds
    """
    try:
        duration = isodate.parse_duration(duration_iso)
        return duration.total_seconds()
    except:
        return 0