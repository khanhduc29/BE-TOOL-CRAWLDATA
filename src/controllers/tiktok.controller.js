import { createTikTokScan } from "../services/tiktok.service.js";
import TikTokTask from "../models/TikTokTask.model.js";
import TikTokRequest from "../models/TikTokRequest.model.js";
import { syncRequestStatus } from "../utils/syncRequestStatus.js";
import { incrementWorkerTaskCount } from "../utils/incrementWorkerTaskCount.js";

export async function createTikTokScanController(req, res) {
  try {
    const request = await createTikTokScan(req.body);
    res.json({
      success: true,
      data: request,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}

export async function getPendingTikTokTask(req, res) {
  try {
    const { worker_id } = req.query;
    console.log(`[TikTok] getPendingTask called, worker_id=${worker_id || "none"}`);

    let task = null;

    // 1) Ưu tiên: task đã assign cho worker này
    if (worker_id) {
      task = await TikTokTask.findOneAndUpdate(
        { status: "pending", assigned_worker: worker_id },
        { status: "running" },
        { sort: { createdAt: 1 }, new: true }
      );
    }

    // 2) Fallback: task chưa assign
    if (!task) {
      task = await TikTokTask.findOneAndUpdate(
        { status: "pending", $or: [{ assigned_worker: { $exists: false } }, { assigned_worker: "" }, { assigned_worker: null }] },
        { status: "running", ...(worker_id ? { assigned_worker: worker_id } : {}) },
        { sort: { createdAt: 1 }, new: true }
      );
    }

    // 3) Last resort: task assign cho worker khác (offline/sai tool) → lấy luôn
    if (!task) {
      task = await TikTokTask.findOneAndUpdate(
        { status: "pending" },
        { status: "running", ...(worker_id ? { assigned_worker: worker_id } : {}) },
        { sort: { createdAt: 1 }, new: true }
      );
    }

    console.log(`[TikTok] Found task: ${task ? task._id : "none"}`);

    if (!task) {
      return res.json({
        success: true,
        data: null,
        message: "No pending TikTok task",
      });
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function updateTikTokTask(req, res) {
  try {
    const { id } = req.params;
    const { status, result, error_message } = req.body;

    console.log(`📝 TikTok updateTask: id=${id} status=${status} error_message=${error_message} result_type=${typeof result}`);

    if (!["success", "error", "running"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be success, error, or running",
      });
    }

    // 🔄 Auto-retry: nếu error → kiểm tra retry_count trước
    if (status === "error") {
      const currentTask = await TikTokTask.findById(id);
      if (currentTask) {
        const retryCount = currentTask.retry_count || 0;
        const maxRetries = currentTask.max_retries || 3;

        if (retryCount < maxRetries) {
          const retryTask = await TikTokTask.findByIdAndUpdate(
            id,
            {
              status: "pending",
              assigned_worker: null,
              last_error: error_message || result?.error || "Unknown error",
              retry_count: retryCount + 1,
              updatedAt: new Date(),
            },
            { new: true }
          );
          console.log(`🔄 TikTok task ${id} auto-retry ${retryCount + 1}/${maxRetries} → pending`);
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
      updateData.error_message = error_message || result?.error || "Unknown error";
      updateData.last_error = updateData.error_message;
      if (result) updateData.result = result;
    }

    const task = await TikTokTask.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "TikTok task not found",
      });
    }

    // Increment worker tasks_completed or tasks_error
    if (task.assigned_worker) {
      if (status === "success") {
        await incrementWorkerTaskCount(task.assigned_worker);
      } else if (status === "error") {
        const { incrementWorkerErrorCount } = await import("../utils/incrementWorkerTaskCount.js");
        await incrementWorkerErrorCount(task.assigned_worker);
      }
    }

    res.json({
      success: true,
      data: task,
    });

    // Sync parent request status
    await syncRequestStatus(TikTokTask, TikTokRequest, "request_id", task.request_id);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * GET latest TikTok task
 * /api/tiktok/task/latest
 * /api/tiktok/task/latest?scan_type=video_comments
 * /api/tiktok/task/latest?status=success
 * /api/tiktok/task/latest?scan_type=video_comments&status=success
 */
export async function getLatestTikTokTask(req, res) {
  try {
    const { scan_type, status } = req.query;

    const query = {};
    if (scan_type) query.scan_type = scan_type;
    if (status) query.status = status;

    const task = await TikTokTask.findOne(query)
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
 * GET all TikTok tasks (for history)
 * /api/tiktok/tasks
 * /api/tiktok/tasks?scan_type=top_posts&status=success&limit=50
 */
export async function getAllTikTokTasks(req, res) {
  try {
    const { scan_type, status, limit = 50, skip = 0 } = req.query;

    const query = {};
    if (scan_type) query.scan_type = scan_type;
    if (status) query.status = status;

    const tasks = await TikTokTask.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    const total = await TikTokTask.countDocuments(query);

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