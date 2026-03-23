import InstagramTaskModel from "../models/InstagramTask.model.js";
import {
  createInstagramScan,
  getPendingInstagramTasks,
  getSuccessInstagramTasks,
  updateInstagramTaskSuccess,
  updateInstagramTaskError,
} from "../services/instagram.service.js";
import InstagramRequest from "../models/InstagramRequest.model.js";
import { syncRequestStatus } from "../utils/syncRequestStatus.js";

/**
 * CREATE SCAN
 */
export async function createScan(req, res) {
  try {
    const request = await createInstagramScan(req.body);

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

    const tasks = await getPendingInstagramTasks(limit);

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

    const tasks = await getSuccessInstagramTasks(limit);

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
 * UPDATE TASK SUCCESS
 */
export async function updateTaskSuccess(req, res) {
  try {
    const { task_id, results } = req.body;

    const task = await updateInstagramTaskSuccess(task_id, results);

    // Sync parent request status
    if (task?.request_id) {
      await syncRequestStatus(InstagramTaskModel, InstagramRequest, "request_id", task.request_id);
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
 * UPDATE TASK ERROR
 */
export async function updateTaskError(req, res) {
  try {
    const { task_id, error } = req.body;

    const task = await updateInstagramTaskError(task_id, error);

    // Sync parent request status
    if (task?.request_id) {
      await syncRequestStatus(InstagramTaskModel, InstagramRequest, "request_id", task.request_id);
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

export async function getTasks(req, res) {
  try {
    const limit = parseInt(req.query.limit);
    const request_id = req.query.request_id;

    const filter = {};
    if (request_id) filter.request_id = request_id;

    const query = InstagramTaskModel.find(filter).sort({ createdAt: -1 });

    if (limit) {
      query.limit(limit);
    }

    const tasks = await query;

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