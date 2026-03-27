import PinterestRequest from "../models/PinterestRequest.model.js";
import PinterestTask from "../models/PinterestTask.model.js";
import { assignWorkersRoundRobin } from "../utils/assignWorker.js";

/**
 * CREATE SCAN
 */
export async function createPinterestScan(data) {
  const { scan_type } = data;

  const request = await PinterestRequest.create({
    scan_type,
    scan_account: data.scan_account,
    payload: data,
    userId: data.userId,
  });

  let tasks = [];

  switch (scan_type) {
    case "pins":
      tasks.push({
        request_id: request._id,
        scan_type,
        input: {
          keyword: data.keyword,
          limit: data.limit ?? 20,
        },
      });
      break;

    case "profile":
      tasks.push({
        request_id: request._id,
        scan_type,
        input: {
          profile_url: data.profile_url,
        },
      });
      break;

    default:
      throw new Error("Unsupported scan_type");
  }

  await assignWorkersRoundRobin("pinterest", tasks);
  const createdTasks = await PinterestTask.insertMany(tasks);

  request.total_tasks = tasks.length;
  await request.save();

  return request;
}

/**
 * GET PENDING TASK
 */
export async function getPendingPinterestTasks(limit = 5, worker_id = null) {
  let task = null;

  // 1) Priority: task assigned to this worker
  if (worker_id) {
    task = await PinterestTask.findOneAndUpdate(
      { status: "pending", assigned_worker: worker_id },
      { status: "running" },
      { sort: { createdAt: 1 }, new: true }
    );
  }

  // 2) Fallback: unassigned pending task
  if (!task) {
    task = await PinterestTask.findOneAndUpdate(
      { status: "pending", $or: [{ assigned_worker: { $exists: false } }, { assigned_worker: "" }, { assigned_worker: null }] },
      { status: "running", ...(worker_id ? { assigned_worker: worker_id } : {}) },
      { sort: { createdAt: 1 }, new: true }
    );
  }

  // 3) Last resort: task assign cho worker khác (offline/sai tool) → lấy luôn
  if (!task) {
    task = await PinterestTask.findOneAndUpdate(
      { status: "pending" },
      { status: "running", ...(worker_id ? { assigned_worker: worker_id } : {}) },
      { sort: { createdAt: 1 }, new: true }
    );
  }

  return task ? [task] : [];
}

/**
 * GET SUCCESS TASK
 */
export async function getSuccessPinterestTasks(limit = 20) {
  const tasks = await PinterestTask.find({
    status: "success",
  })
    .sort({ updatedAt: -1 })
    .limit(limit);

  return tasks;
}

/**
 * UPDATE TASK SUCCESS
 */
export async function updatePinterestTaskSuccess(taskId, results) {
  return PinterestTask.findByIdAndUpdate(
    taskId,
    {
      status: "success",
      result: results, // ✅ đúng field
      finished_at: new Date(),
    },
    { new: true }
  );
}
/**
 * UPDATE TASK ERROR
 */
export async function updatePinterestTaskError(taskId, error) {
  // 🔄 Auto-retry: kiểm tra retry_count trước khi đánh dấu error
  const currentTask = await PinterestTask.findById(taskId);
  if (currentTask) {
    const retryCount = currentTask.retry_count || 0;
    const maxRetries = currentTask.max_retries || 3;

    if (retryCount < maxRetries) {
      console.log(`🔄 Pinterest task ${taskId} auto-retry ${retryCount + 1}/${maxRetries} → pending`);
      return PinterestTask.findByIdAndUpdate(
        taskId,
        {
          status: "pending",
          assigned_worker: null,
          last_error: error,
          retry_count: retryCount + 1,
        },
        { new: true }
      );
    }
  }

  return PinterestTask.findByIdAndUpdate(
    taskId,
    {
      status: "error",
      error_message: error,
      last_error: error,
      finished_at: new Date(),
    },
    { new: true }
  );
}