import { NextResponse } from "next/server";
import gplay from "google-play-scraper";

const BACKEND = process.env.BACKEND_URL || "http://localhost:3000";

export async function POST(request: Request) {
  const data = await request.json();
  const { keyword, country = "vn", lang = "vi", limit = 50 } = data;

  if (!keyword) {
    return NextResponse.json({ error: "Vui lòng nhập keyword" }, { status: 400 });
  }

  // 1. Create task in backend DB
  let taskId = null;
  try {
    const taskRes = await fetch(`${BACKEND}/api/chplay/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan_type: "search", keyword, country, lang, limit }),
    });
    const taskJson = await taskRes.json();
    taskId = taskJson?.data?._id;
  } catch { /* continue */ }

  try {
    // 2. Execute search using google-play-scraper
    const results = await gplay.search({
      term: keyword,
      num: Math.min(limit, 250),
      lang,
      country,
    });

    const apps = results.map((r: any) => ({
      appId: r.appId || "",
      title: r.title || "",
      icon: r.icon || "",
      developer: r.developer || "",
      score: Math.round((r.score || 0) * 10) / 10,
      ratings: r.ratings || 0,
      genre: r.genre || "",
      free: r.free ?? true,
      installs: r.installs || "",
      description: (r.summary || r.description || "").slice(0, 200),
      url: r.url || "",
      price: r.price || 0,
      priceText: r.priceText || "Free",
    }));

    // 3. Update task with results
    if (taskId) {
      await fetch(`${BACKEND}/api/chplay/task/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "success", result: apps }),
      }).catch(() => {});
    }

    return NextResponse.json({ apps, count: apps.length });
  } catch (e: any) {
    if (taskId) {
      await fetch(`${BACKEND}/api/chplay/task/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "error", error_message: e.message }),
      }).catch(() => {});
    }
    return NextResponse.json({
      error: `Lỗi tìm kiếm CH Play: ${e.message}`,
      apps: [], count: 0,
    }, { status: 500 });
  }
}
