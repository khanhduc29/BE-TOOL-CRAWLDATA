import {
  createPinterestScan,
  getPendingPinterestTasks,
  getSuccessPinterestTasks,
  updatePinterestTaskSuccess,
  updatePinterestTaskError,
} from "../services/pinterest.service.js";
import PinterestTask from "../models/PinterestTask.model.js";
import PinterestRequest from "../models/PinterestRequest.model.js";
import { syncRequestStatus } from "../utils/syncRequestStatus.js";

/**
 * CREATE SCAN
 */
export async function createScan(req, res) {
  try {
    const request = await createPinterestScan(req.body);

    res.json({
      success: true,
      data: request,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * GET PENDING TASK
 */
export async function getPendingTasks(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const tasks = await getPendingPinterestTasks(limit);

    res.json({
      success: true,
      total: tasks.length,
      data: tasks,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * GET SUCCESS TASK
 */
export async function getSuccessTasks(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const tasks = await getSuccessPinterestTasks(limit);

    res.json({
      success: true,
      total: tasks.length,
      data: tasks,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * UPDATE TASK ERROR
 */
export async function updateTaskError(req, res) {
  try {
    const { task_id, error } = req.body;

    const task = await updatePinterestTaskError(task_id, error);

    // Sync parent request status
    if (task?.request_id) {
      await syncRequestStatus(PinterestTask, PinterestRequest, "request_id", task.request_id);
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
 * UPDATE TASK SUCCESS
 */
export async function updateTaskSuccess(req, res) {
  try {
    const { task_id, results } = req.body;

    const task = await updatePinterestTaskSuccess(task_id, results);

    // Sync parent request status
    if (task?.request_id) {
      await syncRequestStatus(PinterestTask, PinterestRequest, "request_id", task.request_id);
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
 * GET ALL TASKS (any status)
 */
export async function getTasks(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const request_id = req.query.request_id;

    const filter = {};
    if (request_id) filter.request_id = request_id;

    const total = await PinterestTask.countDocuments(filter);
    const tasks = await PinterestTask.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: tasks,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}