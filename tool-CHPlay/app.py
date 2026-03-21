"""
CH Play (Google Play) Crawler Tool
- Tìm kiếm app theo keyword qua google-play-scraper
- Cào reviews & phân loại theo số sao (1-5)
- Xuất kết quả ra CSV
"""

import csv
import io
from flask import Flask, render_template, request, jsonify, Response
from google_play_scraper import search, reviews, Sort

app = Flask(__name__)


def fetch_reviews_gplay(app_id, country="vn", lang="vi", count=200):
    """
    Cào reviews từ Google Play Store.
    Dùng google_play_scraper.reviews() với pagination.
    """
    all_reviews = []
    print(f"[REVIEWS] Fetching reviews for {app_id}, country={country}, lang={lang}, count={count}")

    try:
        result, continuation_token = reviews(
            app_id,
            lang=lang,
            country=country,
            sort=Sort.NEWEST,
            count=min(count, 200),
        )
        all_reviews.extend(result)
        print(f"[REVIEWS] First batch: {len(result)} reviews")

        # Fetch more if needed
        fetched = len(result)
        while continuation_token and fetched < count:
            batch_size = min(200, count - fetched)
            result, continuation_token = reviews(
                app_id,
                lang=lang,
                country=country,
                sort=Sort.NEWEST,
                count=batch_size,
                continuation_token=continuation_token,
            )
            if not result:
                break
            all_reviews.extend(result)
            fetched += len(result)
            print(f"[REVIEWS] Batch: +{len(result)}, total: {fetched}")

    except Exception as e:
        print(f"[REVIEWS] ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

    print(f"[REVIEWS] Done: {len(all_reviews)} total reviews")
    return all_reviews


@app.route("/")
def index():
    return render_template("index.html")


import json as _json
import re as _re
from urllib.parse import quote as _quote
from google_play_scraper.constants.element import ElementSpecs
from google_play_scraper.constants.regex import Regex
from google_play_scraper.constants.request import Formats
from google_play_scraper.exceptions import NotFoundError
from google_play_scraper.utils.request import get as _gplay_get


def search_with_fix(query, n_hits=30, lang="en", country="us"):
    """
    Custom search that fixes the library bug where the promoted
    top result has appId=None. Extracts appId from raw data.
    """
    if n_hits <= 0:
        return []

    q = _quote(query)
    url = Formats.Searchresults.build(query=q, lang=lang, country=country)
    try:
        dom = _gplay_get(url)
    except NotFoundError:
        url = Formats.Searchresults.fallback_build(query=q, lang=lang)
        dom = _gplay_get(url)

    matches = Regex.SCRIPT.findall(dom)
    dataset = {}
    for match in matches:
        key_match = Regex.KEY.findall(match)
        value_match = Regex.VALUE.findall(match)
        if key_match and value_match:
            key = key_match[0]
            value = _json.loads(value_match[0])
            dataset[key] = value

    try:
        top_result = dataset["ds:4"][0][1][0][23][16]
    except (IndexError, KeyError, TypeError):
        top_result = None

    success = False
    ds4_data = dataset["ds:4"]
    for idx in range(len(ds4_data[0][1])):
        try:
            dataset_apps = ds4_data[0][1][idx][22][0]
            success = True
        except Exception:
            pass
    if not success:
        return []

    n_apps = min(len(dataset_apps), n_hits)

    search_results = []
    if top_result:
        top_app = {
            k: spec.extract_content(top_result)
            for k, spec in ElementSpecs.SearchResultOnTop.items()
        }
        # Fix: extract appId from raw data if None
        if not top_app.get("appId"):
            raw = _json.dumps(top_result, default=str)
            pkg_matches = _re.findall(r'"(com\.[a-z0-9_.]+)"', raw)
            if pkg_matches:
                for pkg in pkg_matches:
                    if "_card_" not in pkg and "_bg_" not in pkg and len(pkg.split(".")) >= 3:
                        top_app["appId"] = pkg
                        break
        # Extract ratings count from top result: [2][51][2][1]
        try:
            top_app["ratings"] = top_result[2][51][2][1]
        except (IndexError, TypeError, KeyError):
            top_app["ratings"] = 0
        search_results.append(top_app)

    for app_idx in range(n_apps - len(search_results)):
        app_data = {}
        for k, spec in ElementSpecs.SearchResult.items():
            content = spec.extract_content(dataset_apps[app_idx])
            app_data[k] = content
        # Extract ratings count for regular results
        try:
            app_data["ratings"] = dataset_apps[app_idx][0][4][2]
        except (IndexError, TypeError, KeyError):
            app_data["ratings"] = 0
        search_results.append(app_data)

    return search_results


@app.route("/api/search", methods=["POST"])
def search_apps():
    """Tìm kiếm app trên Google Play theo keyword."""
    from google_play_scraper import app as gplay_app
    from concurrent.futures import ThreadPoolExecutor

    data = request.get_json()
    keyword = data.get("keyword", "").strip()
    country = data.get("country", "vn")
    lang = data.get("lang", "vi")
    limit = data.get("limit", 50)

    if not keyword:
        return jsonify({"error": "Vui lòng nhập keyword"}), 400

    try:
        results = search_with_fix(
            keyword,
            lang=lang,
            country=country,
            n_hits=min(limit, 50),
        )

        apps = []
        for r in results:
            app_id = r.get("appId")
            if not app_id:
                continue

            apps.append({
                "appId": app_id,
                "title": r.get("title", ""),
                "icon": r.get("icon", ""),
                "developer": r.get("developer", ""),
                "score": round(r.get("score", 0) or 0, 1),
                "ratings": r.get("ratings", 0) or 0,
                "genre": r.get("genre", ""),
                "free": r.get("free", True),
                "price": r.get("price", "0"),
                "description": (r.get("description", "")[:200] + "...")
                if len(r.get("description", "") or "") > 200
                else r.get("description", ""),
                "installs": r.get("installs", ""),
            })

        # Enrich apps that have no ratings with parallel app() lookups
        apps_need_ratings = [
            (i, a["appId"]) for i, a in enumerate(apps) if not a.get("ratings")
        ]

        if apps_need_ratings:
            def fetch_ratings(item):
                idx, aid = item
                try:
                    detail = gplay_app(aid, lang=lang, country=country)
                    return idx, detail.get("ratings", 0) or 0
                except Exception:
                    return idx, 0

            with ThreadPoolExecutor(max_workers=10) as executor:
                for idx, rating_count in executor.map(fetch_ratings, apps_need_ratings):
                    apps[idx]["ratings"] = rating_count

        return jsonify({"apps": apps, "count": len(apps)})

    except Exception as e:
        return jsonify({"error": f"Lỗi khi tìm kiếm: {str(e)}"}), 500


@app.route("/api/reviews", methods=["POST"])
def get_reviews():
    """Cào reviews của một app từ Google Play."""
    data = request.get_json()
    app_name = data.get("app_name", "")
    app_id = data.get("app_id")
    country = data.get("country", "vn")
    lang = data.get("lang", "vi")
    count = data.get("count", 200)

    if not app_id:
        return jsonify({"error": "Thiếu app_id"}), 400

    try:
        all_reviews = fetch_reviews_gplay(
            app_id, country=country, lang=lang, count=count
        )

        # Phân loại reviews theo số sao (dùng string keys cho JSON)
        reviews_by_rating = {"1": [], "2": [], "3": [], "4": [], "5": []}
        rating_counts = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}

        for review in all_reviews:
            rating = review.get("score", 0)
            rating_key = str(rating)
            if rating_key in reviews_by_rating:
                parsed = {
                    "userName": review.get("userName", "Ẩn danh"),
                    "content": review.get("content", ""),
                    "rating": rating,
                    "date": str(review.get("at", "")),
                    "thumbsUpCount": review.get("thumbsUpCount", 0),
                    "reviewCreatedVersion": review.get("reviewCreatedVersion", ""),
                    "replyContent": review.get("replyContent", ""),
                    "replyDate": str(review.get("repliedAt", "")) if review.get("repliedAt") else "",
                }
                reviews_by_rating[rating_key].append(parsed)
                rating_counts[rating_key] += 1

        total = sum(rating_counts.values())

        # Fallback sang tiếng Anh nếu không có kết quả
        fallback_country = None
        if total == 0 and (country != "us" or lang != "en"):
            fallback_reviews = fetch_reviews_gplay(
                app_id, country="us", lang="en", count=count
            )
            for review in fallback_reviews:
                rating = review.get("score", 0)
                rating_key = str(rating)
                if rating_key in reviews_by_rating:
                    parsed = {
                        "userName": review.get("userName", "Unknown"),
                        "content": review.get("content", ""),
                        "rating": rating,
                        "date": str(review.get("at", "")),
                        "thumbsUpCount": review.get("thumbsUpCount", 0),
                        "reviewCreatedVersion": review.get("reviewCreatedVersion", ""),
                        "replyContent": review.get("replyContent", ""),
                        "replyDate": str(review.get("repliedAt", "")) if review.get("repliedAt") else "",
                    }
                    reviews_by_rating[rating_key].append(parsed)
                    rating_counts[rating_key] += 1
            total = sum(rating_counts.values())
            if total > 0:
                fallback_country = "us"

        return jsonify({
            "app_name": app_name,
            "app_id": app_id,
            "total_reviews": total,
            "rating_counts": rating_counts,
            "reviews_by_rating": reviews_by_rating,
            "fallback_country": fallback_country,
        })

    except Exception as e:
        return jsonify({"error": f"Lỗi khi cào reviews: {str(e)}"}), 500


@app.route("/api/export", methods=["POST"])
def export_csv():
    """Xuất reviews ra file CSV."""
    data = request.get_json()
    app_name = data.get("app_name", "app")
    reviews_by_rating = data.get("reviews_by_rating", {})

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Rating", "Content", "User", "Date",
        "App Version", "Thumbs Up", "Reply", "Reply Date"
    ])

    for rating in ["5", "4", "3", "2", "1"]:
        review_list = reviews_by_rating.get(str(rating), [])
        for r in review_list:
            writer.writerow([
                r.get("rating", ""),
                r.get("content", ""),
                r.get("userName", ""),
                r.get("date", ""),
                r.get("reviewCreatedVersion", ""),
                r.get("thumbsUpCount", ""),
                r.get("replyContent", ""),
                r.get("replyDate", ""),
            ])

    csv_content = output.getvalue()
    output.close()

    safe_name = "".join(
        c if c.isalnum() or c in (" ", "-", "_") else "_" for c in app_name
    )

    return Response(
        csv_content,
        mimetype="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=reviews_{safe_name}.csv",
            "Content-Type": "text/csv; charset=utf-8",
        },
    )


if __name__ == "__main__":
    print("=" * 60)
    print("  CH Play (Google Play) Crawler Tool")
    print("  Mở trình duyệt tại: http://localhost:5000")
    print("=" * 60)
    app.run(debug=True, host="0.0.0.0", port=5000)
