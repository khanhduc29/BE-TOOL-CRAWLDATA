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
 * Worker status from Workers collection + derived from task data
 */
export async function getDashboardWorkers(req, res) {
  try {
    const now = Date.now();
    const workersMap = new Map();

    // 1) Workers from dedicated collection
    const dbWorkers = await Worker.find().lean();
    for (const w of dbWorkers) {
      workersMap.set(w.worker_id, {
        worker_id: w.worker_id,
        tool: w.tool,
        status: w.status,
        online: now - new Date(w.last_heartbeat).getTime() < 90000,
        last_heartbeat: w.last_heartbeat,
        tasks_completed: w.tasks_completed || 0,
        hostname: w.hostname || "unknown",
      });
    }

    // 2) Derive workers from assigned_worker in tasks (last 7 days)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    for (const [tool, Model] of Object.entries(TOOL_MODELS)) {
      try {
        const tasks = await Model.find(
          { assigned_worker: { $exists: true, $ne: "" }, updatedAt: { $gte: since } },
          { assigned_worker: 1, status: 1, updatedAt: 1 }
        ).lean();

        for (const t of tasks) {
          const wid = t.assigned_worker;
          if (!wid) continue;

          if (!workersMap.has(wid)) {
            workersMap.set(wid, {
              worker_id: wid,
              tool,
              status: "offline",
              online: false,
              last_heartbeat: t.updatedAt,
              tasks_completed: 0,
              hostname: "unknown",
              source: "task-derived",
            });
          }

          const entry = workersMap.get(wid);
          // Count completed tasks
          if (t.status === "success" || t.status === "error") {
            entry.tasks_completed = (entry.tasks_completed || 0) + 1;
          }
          // Update last seen
          if (new Date(t.updatedAt) > new Date(entry.last_heartbeat || 0)) {
            entry.last_heartbeat = t.updatedAt;
          }
        }
      } catch { /* skip model errors */ }
    }

    const result = Array.from(workersMap.values()).sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return a.tool.localeCompare(b.tool);
    });

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
