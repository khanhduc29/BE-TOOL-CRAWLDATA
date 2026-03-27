import express from "express";
import { autoRegisterWorker } from "../middleware/autoRegisterWorker.js";

import {
  createScan,
  getPendingTasks,
  getSuccessTasks,
  updateTaskSuccess,
  updateTaskError,
  getTasks,
} from "../controllers/pinterest.controller.js";

const router = express.Router();

router.post("/scan", createScan);

router.get("/tasks/pending", autoRegisterWorker("pinterest"), getPendingTasks);

router.get("/tasks/success", getSuccessTasks);

router.get("/tasks", getTasks);

router.post("/tasks/success", updateTaskSuccess);

router.post("/tasks/error", updateTaskError);

export default router;
