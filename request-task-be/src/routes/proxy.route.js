import express from "express";
import {
  getAllProxies,
  createProxy,
  updateProxy,
  deleteProxy,
  bulkDeleteProxies,
  getRandomProxy,
  checkProxy,
} from "../controllers/proxy.controller.js";

const router = express.Router();

router.get("/", getAllProxies);
router.post("/", createProxy);
router.get("/random", getRandomProxy);
router.post("/bulk-delete", bulkDeleteProxies);
router.post("/check/:id", checkProxy);
router.patch("/:id", updateProxy);
router.delete("/:id", deleteProxy);

export default router;
