import { NextResponse } from "next/server";
import gplay from "google-play-scraper";

const BACKEND = process.env.BACKEND_URL || "http://localhost:3000";

export async function POST(request: Request) {
  const data = await request.json();
  const { app_id, app_name = "", country = "vn", lang = "vi", count = 200 } = data;

  if (!app_id) {
    return NextResponse.json({ error: "Thiếu app_id" }, { status: 400 });
  }

  // 1. Create task in backend DB
  let taskId = null;
  try {
    const taskRes = await fetch(`${BACKEND}/api/chplay/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan_type: "reviews", app_id, app_name, country, lang, count }),
    });
    const taskJson = await taskRes.json();
    taskId = taskJson?.data?._id;
  } catch { /* continue */ }

  try {
    // 2. Fetch reviews using google-play-scraper
    const reviews_by_rating: Record<string, any[]> = { "1": [], "2": [], "3": [], "4": [], "5": [] };
    const rating_counts: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

    // Fetch reviews sorted by most relevant
    const rawReviews = await gplay.reviews({
      appId: app_id,
      lang,
      country,
      sort: 2 as any, // NEWEST
      num: Math.min(count, 500),
    });

    const reviewList = rawReviews.data || [];

    for (const r of reviewList) {
      const rating = r.score || 0;
      if (rating >= 1 && rating <= 5) {
        const review = {
          userName: r.userName || "Unknown",
          content: r.text || "",
          rating,
          date: r.date || "",
          thumbsUpCount: r.thumbsUp || 0,
          reviewCreatedVersion: r.version || "",
        };
        reviews_by_rating[String(rating)].push(review);
        rating_counts[String(rating)]++;
      }
    }

    const total = Object.values(rating_counts).reduce((a, b) => a + b, 0);

    const result = {
      app_name: app_name || app_id,
      app_id,
      total_reviews: total,
      rating_counts,
      reviews_by_rating,
    };

    // 3. Update task with results
    if (taskId) {
      await fetch(`${BACKEND}/api/chplay/task/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "success", result }),
      }).catch(() => {});
    }

    return NextResponse.json(result);
  } catch (e: any) {
    if (taskId) {
      await fetch(`${BACKEND}/api/chplay/task/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "error", error_message: e.message }),
      }).catch(() => {});
    }
    return NextResponse.json({ error: `Lỗi cào reviews: ${e.message}` }, { status: 500 });
  }
}
