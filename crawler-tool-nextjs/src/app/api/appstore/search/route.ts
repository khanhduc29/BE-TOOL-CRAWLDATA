import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:3000";

export async function POST(request: Request) {
  const data = await request.json();
  const { keyword, country = "vn", limit = 50 } = data;

  if (!keyword) {
    return NextResponse.json({ error: "Vui lòng nhập keyword" }, { status: 400 });
  }

  // 1. Create task in backend DB
  let taskId = null;
  try {
    const taskRes = await fetch(`${BACKEND}/api/appstore/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan_type: "search", keyword, country, limit }),
    });
    const taskJson = await taskRes.json();
    taskId = taskJson?.data?._id;
  } catch { /* continue */ }

  try {
    // 2. Execute scan — call iTunes Search API
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(keyword)}&entity=software&country=${country}&limit=${Math.min(limit, 50)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const json = await resp.json();
    const results = json.results || [];

    const apps = results.map((r: any) => ({
      trackId: r.trackId,
      trackName: r.trackName || "",
      bundleId: r.bundleId || "",
      artworkUrl100: r.artworkUrl100 || "",
      artworkUrl60: r.artworkUrl60 || "",
      artistName: r.artistName || "",
      averageUserRating: Math.round((r.averageUserRating || 0) * 10) / 10,
      userRatingCount: r.userRatingCount || 0,
      primaryGenreName: r.primaryGenreName || "",
      price: r.price || 0,
      formattedPrice: r.formattedPrice || "Free",
      description: (r.description || "").length > 200 ? r.description.slice(0, 200) + "..." : r.description || "",
    }));

    // 3. Update task with results
    if (taskId) {
      await fetch(`${BACKEND}/api/appstore/task/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "success", result: apps }),
      }).catch(() => {});
    }

    return NextResponse.json({ apps, count: apps.length });
  } catch (e: any) {
    if (taskId) {
      await fetch(`${BACKEND}/api/appstore/task/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "error", error_message: e.message }),
      }).catch(() => {});
    }
    return NextResponse.json({ error: `Lỗi tìm kiếm: ${e.message}` }, { status: 500 });
  }
}
