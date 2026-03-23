import express from "express";

import {
  createScan,
  getPendingTasks,
  getSuccessTasks,
  updateTaskSuccess,
  updateTaskError,
  getTasks,
} from "../controllers/instagram.controller.js";

const router = express.Router();

/**
 * CREATE SCAN
 * tạo request quét instagram
 */
router.post("/create-scan", createScan);

/**
 * WORKER LẤY TASK
 */
router.get("/pending-tasks", getPendingTasks);

/**
 * XEM TASK ĐÃ SUCCESS
 */
router.get("/success-tasks", getSuccessTasks);
router.get("/tasks", getTasks);
/**
 * WORKER UPDATE SUCCESS
 */
router.post("/update-success", updateTaskSuccess);

/**
 * WORKER UPDATE ERROR
 */
router.post("/update-error", updateTaskError);

export default router;