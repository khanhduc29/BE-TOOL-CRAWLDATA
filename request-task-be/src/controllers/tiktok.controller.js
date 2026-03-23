import { createTikTokScan } from "../services/tiktok.service.js";
import TikTokTask from "../models/TikTokTask.model.js";
import TikTokRequest from "../models/TikTokRequest.model.js";
import { syncRequestStatus } from "../utils/syncRequestStatus.js";

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

    // Build query: if worker_id provided, only return tasks assigned to this worker
    const query = { status: "pending" };
    if (worker_id) {
      query.assigned_worker = worker_id;
    }

    const task = await TikTokTask.findOneAndUpdate(
      query,
      { status: "running" },
      {
        sort: { createdAt: 1 },
        new: true,
      }
    );

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

    const updateData = {
      status,
      updatedAt: new Date(),
    };

    if (status === "success") {
      updateData.result = result;
    }

    if (status === "error") {
      updateData.error_message = error_message || result?.error || "Unknown error";
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