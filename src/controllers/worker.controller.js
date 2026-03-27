import Worker from "../models/Worker.model.js";

/**
 * POST /api/workers/register
 * Worker đăng ký khi khởi động
 * Body: { worker_id, tool, hostname }
 */
export async function registerWorker(req, res) {
  try {
    const { worker_id, tool, hostname } = req.body;

    if (!worker_id || !tool) {
      return res.status(400).json({ success: false, message: "worker_id and tool are required" });
    }

    const worker = await Worker.findOneAndUpdate(
      { worker_id },
      {
        worker_id,
        tool,
        hostname: hostname || "unknown",
        status: "online",
        last_heartbeat: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log(`🟢 Worker registered: ${worker_id} (${tool})`);

    res.json({ success: true, data: worker });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/workers/:worker_id
 * Xóa worker khỏi hệ thống
 */
export async function unregisterWorker(req, res) {
  try {
    const { worker_id } = req.params;

    const result = await Worker.findOneAndDelete({ worker_id });

    if (!result) {
      return res.status(404).json({ success: false, message: "Worker not found" });
    }

    console.log(`🗑 Worker deleted: ${worker_id}`);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/workers/list
 * Danh sách workers, optional filter ?tool=tiktok
 */
export async function listWorkers(req, res) {
  try {
    const query = {};
    if (req.query.tool) query.tool = req.query.tool;
    if (req.query.status) query.status = req.query.status;

    const workers = await Worker.find(query).sort({ tool: 1, worker_id: 1 }).lean();

    res.json({ success: true, data: workers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/workers/heartbeat
 * Worker gửi heartbeat mỗi 30s
 * Body: { worker_id, cpu, ram, tasks_completed }
 */
export async function workerHeartbeat(req, res) {
  try {
    const { worker_id, cpu, ram, tasks_completed } = req.body;

    if (!worker_id) {
      return res.status(400).json({ success: false, message: "worker_id required" });
    }

    const worker = await Worker.findOneAndUpdate(
      { worker_id },
      {
        status: "online",
        last_heartbeat: new Date(),
        ...(cpu != null && { "config.cpu": cpu }),
        ...(ram != null && { "config.ram": ram }),
        ...(tasks_completed != null && { tasks_completed }),
      },
      { new: true }
    );

    if (!worker) {
      return res.status(404).json({ success: false, message: "Worker not found" });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Lấy danh sách worker_ids online cho 1 tool (internal use)
 */
export async function getOnlineWorkerIds(tool) {
  const cutoff = new Date(Date.now() - 90 * 1000); // 90s timeout
  const workers = await Worker.find({
    tool,
    status: "online",
    last_heartbeat: { $gte: cutoff },
  }).lean();

  return workers.map((w) => w.worker_id);
}
