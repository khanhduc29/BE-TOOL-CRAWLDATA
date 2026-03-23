import express from "express";
import {
  createChplayScan,
  getLatestChplayTask,
  getPendingChplayTask,
  updateChplayTask,
  getAllChplayTasks,
} from "../controllers/chplay.controller.js";

const router = express.Router();

router.post("/scan", createChplayScan);
router.get("/task/pending", getPendingChplayTask);
router.patch("/task/:id", updateChplayTask);
router.get("/task/latest", getLatestChplayTask);
router.get("/tasks", getAllChplayTasks);

export default router;
