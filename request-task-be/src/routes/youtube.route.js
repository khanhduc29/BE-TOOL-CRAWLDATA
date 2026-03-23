import express from "express";
import {
  createYouTubeScanController,
  getPendingYouTubeTask,
  updateYouTubeTask,
  getLatestYouTubeTask,
} from "../controllers/youtube.controller.js";

const router = express.Router();

// Tạo scan request
router.post("/scan", createYouTubeScanController);

// Worker lấy task pending
router.get("/task/pending", getPendingYouTubeTask);

// Worker update task
router.put("/task/:id", updateYouTubeTask);

// FE lấy task mới nhất
router.get("/task/latest", getLatestYouTubeTask);

export default router;