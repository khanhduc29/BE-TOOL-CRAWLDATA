from langdetect import detect


def detect_language(text: str) -> str:
    if len(text.strip()) < 5:
        return "unknown"

    try:
        return detect(text)
    except:
        return "unknown"