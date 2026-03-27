import AppstoreTask from "../models/AppstoreTask.model.js";

/**
 * POST /api/appstore/scan
 */
export async function createAppstoreScan(req, res) {
  try {
    const { scan_type, keyword, app_id, app_name, country = "vn", limit = 50, max_pages = 10 } = req.body;

    if (!scan_type) {
      return res.status(400).json({ success: false, message: "scan_type is required" });
    }

    let input = {};
    if (scan_type === "search") {
      if (!keyword) return res.status(400).json({ success: false, message: "keyword is required" });
      input = { keyword, country, limit };
    } else if (scan_type === "reviews") {
      if (!app_id) return res.status(400).json({ success: false, message: "app_id is required" });
      input = { app_id, app_name: app_name || "", country, max_pages };
    } else {
      return res.status(400).json({ success: false, message: "scan_type must be search or reviews" });
    }

    const task = await AppstoreTask.create({ scan_type, input, status: "pending" });
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/appstore/task/latest
 */
export async function getLatestAppstoreTask(req, res) {
  try {
    const { scan_type, status } = req.query;
    const query = {};
    if (scan_type) query.scan_type = scan_type;
    if (status) query.status = status;

    const task = await AppstoreTask.findOne(query).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: task || null });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/appstore/task/pending
 */
export async function getPendingAppstoreTask(req, res) {
  try {
    const task = await AppstoreTask.findOneAndUpdate(
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
 * PATCH /api/appstore/task/:id
 */
export async function updateAppstoreTask(req, res) {
  try {
    const { id } = req.params;
    const { status, result, error_message } = req.body;

    if (!["success", "error", "running"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const updateData = { status, updatedAt: new Date() };
    if (result !== undefined) updateData.result = result;
    if (error_message) updateData.error_message = error_message;

    const task = await AppstoreTask.findByIdAndUpdate(id, updateData, { new: true });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    return res.json({ success: true, data: task });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/appstore/tasks
 */
export async function getAllAppstoreTasks(req, res) {
  try {
    const { scan_type, status, limit = 50, skip = 0 } = req.query;
    const query = {};
    if (scan_type) query.scan_type = scan_type;
    if (status) query.status = status;

    const tasks = await AppstoreTask.find(query).sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit)).lean();
    const total = await AppstoreTask.countDocuments(query);

    return res.json({ success: true, data: tasks, total });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
