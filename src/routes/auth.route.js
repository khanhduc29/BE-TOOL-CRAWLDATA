import express from "express";
import { register, login, getMe, getAllUsers, updateUserRole, deleteUser, updateUser } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);

// Admin routes
router.get("/users", authMiddleware, getAllUsers);
router.put("/users/:id", authMiddleware, updateUser);
router.put("/users/:id/role", authMiddleware, updateUserRole);
router.delete("/users/:id", authMiddleware, deleteUser);

export default router;
