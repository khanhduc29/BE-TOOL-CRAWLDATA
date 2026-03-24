import express from "express";
import {
  getDashboardStats,
  getDashboardWorkers,
  getDashboardThroughput,
  getDashboardLogs,
  pushDashboardLog,
} from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/stats", getDashboardStats);
router.get("/workers", getDashboardWorkers);
router.get("/throughput", getDashboardThroughput);
router.get("/logs", getDashboardLogs);
router.post("/log", pushDashboardLog);

export default router;
