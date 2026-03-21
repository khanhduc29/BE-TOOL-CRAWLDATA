def classify_intent(text: str) -> str:
    text = text.lower()

    if any(word in text for word in ["price", "giá", "bao nhiêu", "how much"]):
        return "ask_buy"

    if any(word in text for word in ["where", "ở đâu", "link", "mua ở"]):
        return "ask_info"

    if any(word in text for word in ["thanks", "thank you", "cảm ơn", "nice", "good"]):
        return "feedback"

    return "other"