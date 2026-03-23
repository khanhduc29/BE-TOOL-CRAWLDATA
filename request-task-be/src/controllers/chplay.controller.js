import ChplayTask from "../models/ChplayTask.model.js";

/**
 * POST /api/chplay/scan
 * Creates a task, executes inline (calls google-play-scraper), saves result
 */
export async function createChplayScan(req, res) {
  try {
    const { scan_type, keyword, app_id, app_name, country = "vn", lang = "vi", limit = 50, count = 200 } = req.body;

    if (!scan_type) {
      return res.status(400).json({ success: false, message: "scan_type is required" });
    }

    let input = {};
    if (scan_type === "search") {
      if (!keyword) return res.status(400).json({ success: false, message: "keyword is required" });
      input = { keyword, country, lang, limit };
    } else if (scan_type === "reviews") {
      if (!app_id) return res.status(400).json({ success: false, message: "app_id is required" });
      input = { app_id, app_name: app_name || "", country, lang, count };
    } else {
      return res.status(400).json({ success: false, message: "scan_type must be search or reviews" });
    }

    // Create task as pending
    const task = await ChplayTask.create({ scan_type, input, status: "pending" });

    // Return immediately, task will be processed by worker or inline
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/chplay/task/latest
 */
export async function getLatestChplayTask(req, res) {
  try {
    const { scan_type, status } = req.query;
    const query = {};
    if (scan_type) query.scan_type = scan_type;
    if (status) query.status = status;

    const task = await ChplayTask.findOne(query).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: task || null });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/chplay/task/pending
 */
export async function getPendingChplayTask(req, res) {
  try {
    const task = await ChplayTask.findOneAndUpdate(
      { status: "pending" },
      { status: "running" },
      { sort: { createdAt: 1 }, new: true }
    );
    return res.json({ success: true, data: task || null });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PATCH /api/chplay/task/:id
 */
export async function updateChplayTask(req, res) {
  try {
    const { id } = req.params;
    const { status, result, error_message } = req.body;

    if (!["success", "error", "running"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const updateData = { status, updatedAt: new Date() };
    if (result !== undefined) updateData.result = result;
    if (error_message) updateData.error_message = error_message;

    const task = await ChplayTask.findByIdAndUpdate(id, updateData, { new: true });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    return res.json({ success: true, data: task });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/chplay/tasks
 */
export async function getAllChplayTasks(req, res) {
  try {
    const { scan_type, status, limit = 50, skip = 0 } = req.query;
    const query = {};
    if (scan_type) query.scan_type = scan_type;
    if (status) query.status = status;

    const tasks = await ChplayTask.find(query).sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit)).lean();
    const total = await ChplayTask.countDocuments(query);

    return res.json({ success: true, data: tasks, total });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
