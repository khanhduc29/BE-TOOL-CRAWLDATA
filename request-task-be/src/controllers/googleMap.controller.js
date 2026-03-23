import { createGoogleMapJob } from "../services/googleMap.service.js";
import GoogleMapTask from "../models/GoogleMapTask.model.js";
import GoogleMapJobModel from "../models/GoogleMapJob.model.js";
import GoogleMapTaskModel from "../models/GoogleMapTask.model.js";
import { syncRequestStatus } from "../utils/syncRequestStatus.js";

export async function createGoogleMapJobController(req, res) {
  try {
    const job = await createGoogleMapJob(req.body);

    res.json({
      success: true,
      data: job,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}

export async function getPendingGoogleMapTask(req, res) {
  try {
    const task = await GoogleMapTask.findOneAndUpdate(
      { status: "pending" },            // điều kiện
      { status: "processing" },          // lock task
      {
        sort: { created_at: 1 },         // FIFO
        new: true,
      }
    );

    if (!task) {
      return res.json({
        success: true,
        data: null,
        message: "No pending Google Map task",
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

export async function updateGoogleMapTask(req, res) {
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
      updated_at: new Date(),
    };

    if (status === "success" && result) {
      // Loại trùng theo name + address
      const seen = new Set();
      const dedupResult = result.filter((place) => {
        const key = `${(place.name || "").toLowerCase()}_${(place.address || "").toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      updateData.result = dedupResult;
      updateData.partial_result = null; // Xóa partial sau khi có result cuối
    }

    if (status === "error") {
      updateData.error_message = error_message || "Unknown error";
    }

    const task = await GoogleMapTask.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Google Map task not found",
      });
    }

    // Sync parent job status
    if (task.job_id) {
      await syncRequestStatus(GoogleMapTask, GoogleMapJobModel, "job_id", task.job_id);
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

/**
 * Lưu kết quả tạm (partial) để không mất data khi crash
 */
export async function updatePartialGoogleMapTask(req, res) {
  try {
    const { id } = req.params;
    const { partial_result } = req.body;

    const task = await GoogleMapTask.findByIdAndUpdate(
      id,
      {
        partial_result,
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.json({
      success: true,
      data: { _id: task._id, partial_count: partial_result?.length || 0 },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function getGoogleMapJobs(req, res) {
  try {
    const jobs = await GoogleMapJobModel.find()
      .sort({ created_at: -1 })
      .limit(100);

    res.json({
      success: true,
      data: jobs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function getGoogleMapTasks(req, res) {
  try {
    const { jobId } = req.query;

    const tasks = await GoogleMapTaskModel.find({ job_id: jobId })
      .sort({ created_at: 1 });

    res.json({
      success: true,
      data: tasks,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function getGoogleMapTaskDetail(req, res) {
  try {
    const { id } = req.params;

    const task = await GoogleMapTaskModel.findById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
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

/**
 * Reset các task bị stuck ở "processing" > 5 phút → pending
 */
export async function resetStuckTasks(req, res) {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const result = await GoogleMapTask.updateMany(
      {
        status: "processing",
        updated_at: { $lt: fiveMinAgo },
      },
      {
        status: "pending",
        updated_at: new Date(),
      }
    );

    // Cũng reset task processing mà không có updated_at
    const result2 = await GoogleMapTask.updateMany(
      {
        status: "processing",
        updated_at: { $exists: false },
      },
      {
        status: "pending",
        updated_at: new Date(),
      }
    );

    const totalReset = (result.modifiedCount || 0) + (result2.modifiedCount || 0);

    console.log(`🔄 Reset ${totalReset} stuck processing tasks → pending`);

    res.json({
      success: true,
      message: `Reset ${totalReset} stuck tasks`,
      data: { reset_count: totalReset },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}