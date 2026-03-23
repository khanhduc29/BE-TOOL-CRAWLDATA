import express from "express";
import redis from "../config/redis.js";

const router = express.Router();

/**
 * POST /api/heartbeat
 * Worker gửi heartbeat mỗi 30s
 * Body: { tool, hostname, cpu, ram, tasks_completed, uptime }
 */
router.post("/", async (req, res) => {
  try {
    const { tool, hostname, cpu, ram, tasks_completed, uptime } = req.body;

    if (!tool) {
      return res.status(400).json({ success: false, message: "Missing 'tool'" });
    }

    const key = `worker:${tool}:${hostname || "default"}`;

    await redis.hmset(key, {
      tool,
      hostname: hostname || "default",
      cpu: String(cpu || 0),
      ram: String(ram || 0),
      tasks_completed: String(tasks_completed || 0),
      uptime: String(uptime || 0),
      lastHeartbeat: String(Date.now()),
    });

    // Auto-expire after 90s (worker sends every 30s, 3 misses = offline)
    await redis.expire(key, 90);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
