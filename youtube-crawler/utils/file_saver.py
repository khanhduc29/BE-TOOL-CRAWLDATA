import os
import json
import csv
from datetime import datetime


DATA_DIR = "data"


def ensure_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)


def generate_filename(prefix: str, keyword: str, extension: str):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_keyword = keyword.replace(" ", "_")
    return f"{prefix}_{safe_keyword}_{timestamp}.{extension}"


def save_json(data, prefix: str, keyword: str):
    ensure_data_dir()
    filename = generate_filename(prefix, keyword, "json")
    path = os.path.join(DATA_DIR, filename)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    print(f"Saved JSON: {path}")


def save_csv(data, prefix: str, keyword: str):
    if not data:
        return

    ensure_data_dir()
    filename = generate_filename(prefix, keyword, "csv")
    path = os.path.join(DATA_DIR, filename)

    keys = data[0].keys()

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(data)

    print(f"Saved CSV: {path}")