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
  const query = { status: "pending" };
  if (worker_id) query.assigned_worker = worker_id;

  const tasks = await PinterestTask.find(query)
    .sort({ createdAt: 1 })
    .limit(limit);

  return tasks;
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
  return PinterestTask.findByIdAndUpdate(
    taskId,
    {
      status: "error",
      error,
      finished_at: new Date(),
    },
    { new: true }
  );
}