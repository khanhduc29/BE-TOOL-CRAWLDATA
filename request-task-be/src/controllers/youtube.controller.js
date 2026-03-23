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
    const task = await YouTubeTask.findOneAndUpdate(
      { status: "pending" },
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