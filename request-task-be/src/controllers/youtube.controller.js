import { createYouTubeScan } from "../services/youtube.service.js";
import YouTubeTask from "../models/YouTubeTask.model.js";
import YouTubeRequest from "../models/YouTubeRequest.model.js";
import { syncRequestStatus } from "../utils/syncRequestStatus.js";

/**
 * POST /api/youtube/scan
 * Tạo YouTube scan request
 */
export async function createYouTubeScanController(req, res) {
  try {
    const request = await createYouTubeScan(req.body);

    return res.json({
      success: true,
      data: request,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * GET /api/youtube/task/pending
 * Worker lấy task pending
 */
export async function getPendingYouTubeTask(req, res) {
  try {
    const { worker_id } = req.query;
    console.log(`[YouTube] getPendingTask called, worker_id=${worker_id || "none"}`);

    let task = null;

    // 1) Ưu tiên: task đã assign cho worker này
    if (worker_id) {
      task = await YouTubeTask.findOneAndUpdate(
        { status: "pending", assigned_worker: worker_id },
        { status: "running" },
        { sort: { createdAt: 1 }, new: true }
      );
    }

    // 2) Fallback: task chưa assign
    if (!task) {
      task = await YouTubeTask.findOneAndUpdate(
        { status: "pending", $or: [{ assigned_worker: { $exists: false } }, { assigned_worker: "" }, { assigned_worker: null }] },
        { status: "running", ...(worker_id ? { assigned_worker: worker_id } : {}) },
        { sort: { createdAt: 1 }, new: true }
      );
    }

    console.log(`[YouTube] Found task: ${task ? task._id : "none"}`);

    if (!task) {
      return res.json({
        success: true,
        data: null,
        message: "No pending YouTube task",
      });
    }

    return res.json({
      success: true,
      data: task,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * PUT /api/youtube/task/:id
 * Worker update result
 */
export async function updateYouTubeTask(req, res) {
  try {
    const { id } = req.params;
    const { status, result, error_message } = req.body;

    if (!["success", "error"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be success or error",
      });
    }

    // 🔄 Auto-retry: nếu error → kiểm tra retry_count trước
    if (status === "error") {
      const currentTask = await YouTubeTask.findById(id);
      if (currentTask) {
        const retryCount = currentTask.retry_count || 0;
        const maxRetries = currentTask.max_retries || 3;

        if (retryCount < maxRetries) {
          const retryTask = await YouTubeTask.findByIdAndUpdate(
            id,
            {
              status: "pending",
              assigned_worker: null,
              last_error: error_message || "Unknown error",
              retry_count: retryCount + 1,
              updatedAt: new Date(),
            },
            { new: true }
          );
          console.log(`🔄 YouTube task ${id} auto-retry ${retryCount + 1}/${maxRetries} → pending`);
          return res.json({ success: true, data: retryTask, retried: true });
        }
      }
    }

    const updateData = {
      status,
      updatedAt: new Date(),
    };

    if (status === "success") {
      updateData.result = result;
    }

    if (status === "error") {
      updateData.error_message =
        error_message || "Unknown error";
      updateData.last_error = updateData.error_message;
    }

    const task = await YouTubeTask.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "YouTube task not found",
      });
    }

    // Sync parent request status
    if (task.request_id) {
      await syncRequestStatus(YouTubeTask, YouTubeRequest, "request_id", task.request_id);
    }

    return res.json({
      success: true,
      data: task,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * GET /api/youtube/task/latest
 * Query params:
 * ?scan_type=videos
 * ?status=success
 */
export async function getLatestYouTubeTask(req, res) {
  try {
    const { scan_type, status } = req.query;

    const query = {};
    if (scan_type) query.scan_type = scan_type;
    if (status) query.status = status;

    const task = await YouTubeTask.findOne(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: task || null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * GET /api/youtube/tasks
 * History: all YouTube tasks with pagination
 * ?scan_type=videos&status=success&limit=50&skip=0
 */
export async function getAllYouTubeTasks(req, res) {
  try {
    const { scan_type, status, limit = 50, skip = 0 } = req.query;

    const query = {};
    if (scan_type) query.scan_type = scan_type;
    if (status) query.status = status;

    const tasks = await YouTubeTask.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    const total = await YouTubeTask.countDocuments(query);

    return res.json({
      success: true,
      data: tasks,
      total,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}