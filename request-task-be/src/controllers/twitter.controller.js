import { createTwitterScan } from "../services/twitter.service.js";
import TwitterTask from "../models/TwitterTask.model.js";
import TwitterRequest from "../models/TwitterRequest.model.js";
import { syncRequestStatus } from "../utils/syncRequestStatus.js";
import { incrementWorkerTaskCount } from "../utils/incrementWorkerTaskCount.js";

export async function createTwitterScanController(req, res) {
  try {
    const request = await createTwitterScan(req.body);
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

export async function getPendingTwitterTask(req, res) {
  try {
    const { worker_id } = req.query;
    console.log(`[Twitter] getPendingTask called, worker_id=${worker_id || "none"}`);

    let task = null;

    // 1) Ưu tiên: task đã assign cho worker này
    if (worker_id) {
      task = await TwitterTask.findOneAndUpdate(
        { status: "pending", assigned_worker: worker_id },
        { status: "running" },
        { sort: { createdAt: 1 }, new: true }
      );
    }

    // 2) Fallback: task chưa assign
    if (!task) {
      task = await TwitterTask.findOneAndUpdate(
        { status: "pending", $or: [{ assigned_worker: { $exists: false } }, { assigned_worker: "" }, { assigned_worker: null }] },
        { status: "running", ...(worker_id ? { assigned_worker: worker_id } : {}) },
        { sort: { createdAt: 1 }, new: true }
      );
    }

    // 3) Last resort: task assign cho worker khác (offline/sai tool) → lấy luôn
    if (!task) {
      task = await TwitterTask.findOneAndUpdate(
        { status: "pending" },
        { status: "running", ...(worker_id ? { assigned_worker: worker_id } : {}) },
        { sort: { createdAt: 1 }, new: true }
      );
    }

    console.log(`[Twitter] Found task: ${task ? task._id : "none"}`);

    if (!task) {
      return res.json({
        success: true,
        data: null,
        message: "No pending Twitter task",
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

export async function updateTwitterTask(req, res) {
  try {
    const { id } = req.params;
    const { status, result, error_message } = req.body;

    console.log(`📝 Twitter updateTask: id=${id} status=${status} error_message=${error_message} result_type=${typeof result}`);

    if (!["success", "error", "running"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be success, error, or running",
      });
    }

    // 🔄 Auto-retry: nếu error → kiểm tra retry_count trước
    if (status === "error") {
      const currentTask = await TwitterTask.findById(id);
      if (currentTask) {
        const retryCount = currentTask.retry_count || 0;
        const maxRetries = currentTask.max_retries || 3;

        if (retryCount < maxRetries) {
          const retryTask = await TwitterTask.findByIdAndUpdate(
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
          console.log(`🔄 Twitter task ${id} auto-retry ${retryCount + 1}/${maxRetries} → pending`);
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

    const task = await TwitterTask.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Twitter task not found",
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
    await syncRequestStatus(TwitterTask, TwitterRequest, "request_id", task.request_id);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * GET latest Twitter task
 * /api/twitter/task/latest
 * /api/twitter/task/latest?scan_type=posts
 * /api/twitter/task/latest?status=success
 */
export async function getLatestTwitterTask(req, res) {
  try {
    const { scan_type, status } = req.query;

    const query = {};
    if (scan_type) query.scan_type = scan_type;
    if (status) query.status = status;

    const task = await TwitterTask.findOne(query)
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
 * GET all Twitter tasks (for history)
 * /api/twitter/tasks
 * /api/twitter/tasks?scan_type=posts&status=success&limit=20&skip=0
 */
export async function getAllTwitterTasks(req, res) {
  try {
    const { scan_type, status, limit = 50, skip = 0 } = req.query;

    const query = {};
    if (scan_type) query.scan_type = scan_type;
    if (status) query.status = status;

    const tasks = await TwitterTask.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    const total = await TwitterTask.countDocuments(query);

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
