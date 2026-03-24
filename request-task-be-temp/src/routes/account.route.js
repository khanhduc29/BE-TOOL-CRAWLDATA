import express from "express";
import {
  getAllAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountById,
} from "../controllers/account.controller.js";

const router = express.Router();

router.get("/", getAllAccounts);
router.post("/", createAccount);
router.get("/:id", getAccountById);
router.patch("/:id", updateAccount);
router.delete("/:id", deleteAccount);

export default router;
