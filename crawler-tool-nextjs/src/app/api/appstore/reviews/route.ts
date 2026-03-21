import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:3000";

async function fetchReviewsRSS(appId: string, country: string = "us", maxPages: number = 10) {
  const allReviews: any[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${appId}/sortBy=mostRecent/json`;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) break;

      const data = await resp.json();
      const entries = data?.feed?.entry || [];
      if (!entries.length) break;

      for (const e of entries) {
        if (!e["im:rating"]) continue;
        const rating = parseInt(e["im:rating"]?.label || "0");
        allReviews.push({
          title: e.title?.label || "",
          content: e.content?.label || "",
          rating,
          userName: e.author?.name?.label || "Unknown",
          date: e.updated?.label || "",
          voteCount: e["im:voteCount"]?.label || "0",
          voteSum: e["im:voteSum"]?.label || "0",
          appVersion: e["im:version"]?.label || "",
        });
      }
    } catch {
      break;
    }
  }

  return allReviews;
}

export async function POST(request: Request) {
  const data = await request.json();
  const { app_id, app_name = "", country = "vn", max_pages = 10 } = data;

  if (!app_id) {
    return NextResponse.json({ error: "Thiếu app_id" }, { status: 400 });
  }

  // 1. Create task in backend DB
  let taskId = null;
  try {
    const taskRes = await fetch(`${BACKEND}/api/appstore/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan_type: "reviews", app_id, app_name, country, max_pages }),
    });
    const taskJson = await taskRes.json();
    taskId = taskJson?.data?._id;
  } catch { /* continue */ }

  try {
    // 2. Execute scan
    const allReviews = await fetchReviewsRSS(app_id, country, max_pages);

    const reviews_by_rating: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    const rating_counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const r of allReviews) {
      const rating = r.rating;
      if (rating >= 1 && rating <= 5) {
        reviews_by_rating[rating].push(r);
        rating_counts[rating]++;
      }
    }

    let total = Object.values(rating_counts).reduce((a, b) => a + b, 0);
    let fallback_country = null;

    // Fallback to US if no reviews
    if (total === 0 && country !== "us") {
      const fallbackReviews = await fetchReviewsRSS(app_id, "us", max_pages);
      for (const r of fallbackReviews) {
        const rating = r.rating;
        if (rating >= 1 && rating <= 5) {
          reviews_by_rating[rating].push(r);
          rating_counts[rating]++;
        }
      }
      total = Object.values(rating_counts).reduce((a, b) => a + b, 0);
      if (total > 0) fallback_country = "us";
    }

    const result = {
      app_name, app_id,
      total_reviews: total,
      rating_counts,
      reviews_by_rating,
      fallback_country,
    };

    // 3. Update task with results
    if (taskId) {
      await fetch(`${BACKEND}/api/appstore/task/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "success", result }),
      }).catch(() => {});
    }

    return NextResponse.json(result);
  } catch (e: any) {
    if (taskId) {
      await fetch(`${BACKEND}/api/appstore/task/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "error", error_message: e.message }),
      }).catch(() => {});
    }
    return NextResponse.json({ error: `Lỗi cào reviews: ${e.message}` }, { status: 500 });
  }
}
