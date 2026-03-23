import express from "express";
import { createGoogleMapJobController, getGoogleMapJobs, getGoogleMapTaskDetail, getGoogleMapTasks, getPendingGoogleMapTask, updateGoogleMapTask, updatePartialGoogleMapTask, resetStuckTasks } from "../controllers/googleMap.controller.js";

const router = express.Router();

router.post("/scan", createGoogleMapJobController);
router.get("/task/pending", getPendingGoogleMapTask);
router.patch("/task/:id", updateGoogleMapTask);
router.patch("/task/:id/partial", updatePartialGoogleMapTask);
router.post("/task/reset-stuck", resetStuckTasks);
// frontend dashboard
router.get("/crawl-jobs", getGoogleMapJobs);
router.get("/crawl-tasks", getGoogleMapTasks);
router.get("/crawl-tasks/:id", getGoogleMapTaskDetail);

export default router;