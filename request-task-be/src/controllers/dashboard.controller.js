import redis from "../config/redis.js";
import { getAllQueueStats, TOOL_NAMES } from "../services/queue.service.js";

// Import all task models
import TikTokTask from "../models/TikTokTask.model.js";
import PinterestTask from "../models/PinterestTask.model.js";
import InstagramTask from "../models/InstagramTask.model.js";
import YouTubeTask from "../models/YouTubeTask.model.js";
import TwitterTask from "../models/TwitterTask.model.js";
import GoogleMapTask from "../models/GoogleMapTask.model.js";
import ChplayTask from "../models/ChplayTask.model.js";
import AppstoreTask from "../models/AppstoreTask.model.js";

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

    // Queue stats from Redis
    let queueStats = {};
    try {
      queueStats = await getAllQueueStats();
    } catch { /* Redis may be offline */ }

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
        queues: queueStats,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/dashboard/workers
 * Worker heartbeat status from Redis
 */
export async function getDashboardWorkers(req, res) {
  try {
    const workers = [];
    const keys = await redis.keys("worker:*");

    for (const key of keys) {
      const data = await redis.hgetall(key);
      if (data && data.tool) {
        const lastBeat = parseInt(data.lastHeartbeat || "0");
        const isOnline = Date.now() - lastBeat < 60000; // 60s timeout
        workers.push({
          tool: data.tool,
          hostname: data.hostname || "unknown",
          online: isOnline,
          cpu: parseFloat(data.cpu || "0"),
          ram: parseFloat(data.ram || "0"),
          tasks_completed: parseInt(data.tasks_completed || "0"),
          lastHeartbeat: lastBeat,
          uptime: data.uptime || "0",
        });
      }
    }

    res.json({ success: true, data: workers });
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

    // Query all completed tasks in last 60 minutes
    const since = new Date(now.getTime() - minutes * 60 * 1000);

    // Aggregate across all models
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

    // Group by minute
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
 * Recent logs stored in Redis list
 */
export async function getDashboardLogs(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const raw = await redis.lrange("dashboard:logs", 0, limit - 1);
    const logs = raw.map((r) => {
      try { return JSON.parse(r); } catch { return { message: r }; }
    });

    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/dashboard/log
 * Workers push logs here
 */
export async function pushDashboardLog(req, res) {
  try {
    const { tool, level, message } = req.body;
    const entry = {
      tool: tool || "unknown",
      level: level || "info",
      message: message || "",
      timestamp: new Date().toISOString(),
    };
    await redis.lpush("dashboard:logs", JSON.stringify(entry));
    await redis.ltrim("dashboard:logs", 0, 499); // Keep last 500
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
