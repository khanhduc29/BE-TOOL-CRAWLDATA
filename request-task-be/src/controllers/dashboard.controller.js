// Import all task models
import TikTokTask from "../models/TikTokTask.model.js";
import PinterestTask from "../models/PinterestTask.model.js";
import InstagramTask from "../models/InstagramTask.model.js";
import YouTubeTask from "../models/YouTubeTask.model.js";
import TwitterTask from "../models/TwitterTask.model.js";
import GoogleMapTask from "../models/GoogleMapTask.model.js";
import ChplayTask from "../models/ChplayTask.model.js";
import AppstoreTask from "../models/AppstoreTask.model.js";
import Worker from "../models/Worker.model.js";

const TOOL_MODELS = {
  tiktok: TikTokTask,
  pinterest: PinterestTask,
  instagram: InstagramTask,
  youtube: YouTubeTask,
  twitter: TwitterTask,
  "google-map": GoogleMapTask,
  chplay: ChplayTask,
  appstore: AppstoreTask,
};

/**
 * GET /api/dashboard/stats
 * Task counts per tool + totals
 */
export async function getDashboardStats(req, res) {
  try {
    const tools = {};
    let totalPending = 0, totalRunning = 0, totalSuccess = 0, totalError = 0;

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const [tool, Model] of Object.entries(TOOL_MODELS)) {
      const [pending, running, success, error] = await Promise.all([
        Model.countDocuments({ status: "pending" }),
        Model.countDocuments({ status: "running" }),
        Model.countDocuments({ status: "success", updatedAt: { $gte: last24h } }),
        Model.countDocuments({ status: "error", updatedAt: { $gte: last24h } }),
      ]);

      tools[tool] = { pending, running, success, error };
      totalPending += pending;
      totalRunning += running;
      totalSuccess += success;
      totalError += error;
    }

    res.json({
      success: true,
      data: {
        totals: {
          pending: totalPending,
          running: totalRunning,
          success: totalSuccess,
          error: totalError,
        },
        tools,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/dashboard/workers
 * Worker status from MongoDB
 */
export async function getDashboardWorkers(req, res) {
  try {
    const workers = await Worker.find().lean();
    const now = Date.now();

    const result = workers.map((w) => ({
      worker_id: w.worker_id,
      tool: w.tool,
      online: now - new Date(w.last_heartbeat).getTime() < 60000,
      last_heartbeat: w.last_heartbeat,
      registered_at: w.registered_at,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/dashboard/throughput
 * Tasks completed per minute (last 60 minutes)
 */
export async function getDashboardThroughput(req, res) {
  try {
    const now = new Date();
    const minutes = 60;
    const buckets = [];

    const since = new Date(now.getTime() - minutes * 60 * 1000);

    const allTasks = [];
    for (const [tool, Model] of Object.entries(TOOL_MODELS)) {
      const tasks = await Model.find(
        { status: "success", updatedAt: { $gte: since } },
        { updatedAt: 1 }
      ).lean();
      for (const t of tasks) {
        allTasks.push({ time: new Date(t.updatedAt).getTime(), tool });
      }
    }

    for (let i = minutes - 1; i >= 0; i--) {
      const bucketStart = now.getTime() - (i + 1) * 60000;
      const bucketEnd = now.getTime() - i * 60000;
      const label = new Date(bucketEnd).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const count = allTasks.filter(
        (t) => t.time >= bucketStart && t.time < bucketEnd
      ).length;

      buckets.push({ label, count });
    }

    res.json({ success: true, data: buckets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/dashboard/logs
 * Placeholder — returns empty (no Redis)
 */
export async function getDashboardLogs(req, res) {
  res.json({ success: true, data: [] });
}

/**
 * POST /api/dashboard/log
 * Placeholder — no-op (no Redis)
 */
export async function pushDashboardLog(req, res) {
  res.json({ success: true });
}
