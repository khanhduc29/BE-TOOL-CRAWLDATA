import logging
import sys
import io

def setup_logger():
    # Force UTF-8 output trên Windows để tránh UnicodeEncodeError với emoji
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%H:%M:%S"
    ))

    logger = logging.getLogger("tiktok-crawler")
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    return logger
