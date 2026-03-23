import express from "express";
import {
  createAppstoreScan,
  getLatestAppstoreTask,
  getPendingAppstoreTask,
  updateAppstoreTask,
  getAllAppstoreTasks,
} from "../controllers/appstore.controller.js";

const router = express.Router();

router.post("/scan", createAppstoreScan);
router.get("/task/pending", getPendingAppstoreTask);
router.patch("/task/:id", updateAppstoreTask);
router.get("/task/latest", getLatestAppstoreTask);
router.get("/tasks", getAllAppstoreTasks);

export default router;
