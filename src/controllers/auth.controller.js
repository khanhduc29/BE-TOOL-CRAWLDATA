import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "crawler-tool-secret-key-2024";
const JWT_EXPIRES_IN = "7d";

/**
 * POST /api/auth/register
 */
export async function register(req, res) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "Email, password và tên là bắt buộc",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password phải có ít nhất 6 ký tự",
      });
    }

    // Check existing user
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email đã được đăng ký",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
    });

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email và password là bắt buộc",
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc password không đúng",
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc password không đúng",
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/auth/me
 * Requires auth middleware
 */
export async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// =================== SELF-UPDATE PROFILE ===================

/**
 * PUT /api/auth/me — Update own profile (any authenticated user)
 */
export async function updateProfile(req, res) {
  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const update = {};

    if (name) update.name = name;
    if (email) update.email = email.toLowerCase();

    // Password change requires current password verification
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập mật khẩu hiện tại" });
      }

      const user = await User.findById(req.user.id);
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: "Mật khẩu hiện tại không đúng" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
      }

      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(newPassword, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      update,
      { new: true }
    ).select("-password").lean();

    res.json({ success: true, data: updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// =================== ADMIN ENDPOINTS ===================

/**
 * Helper: check if user is admin
 */
function requireAdmin(req, res) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ success: false, message: "Chỉ admin mới có quyền truy cập" });
    return false;
  }
  return true;
}

/**
 * GET /api/auth/users — List all users (admin only)
 */
export async function getAllUsers(req, res) {
  try {
    if (!requireAdmin(req, res)) return;

    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PUT /api/auth/users/:id/role — Update user role (admin only)
 */
export async function updateUserRole(req, res) {
  try {
    if (!requireAdmin(req, res)) return;

    const { role } = req.body;
    if (!["admin", "user"].includes(role)) {
      return res.status(400).json({ success: false, message: "Role phải là admin hoặc user" });
    }

    // Prevent self-demotion
    if (req.params.id === req.user.id && role !== "admin") {
      return res.status(400).json({ success: false, message: "Không thể tự hạ quyền admin của mình" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/auth/users/:id — Delete user (admin only)
 */
export async function deleteUser(req, res) {
  try {
    if (!requireAdmin(req, res)) return;

    // Prevent self-deletion
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: "Không thể xóa chính mình" });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }

    res.json({ success: true, message: "Đã xóa user" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PUT /api/auth/users/:id — Update user info (admin only)
 */
export async function updateUser(req, res) {
  try {
    if (!requireAdmin(req, res)) return;

    const { name, email, password } = req.body;
    const update = {};
    if (name) update.name = name;
    if (email) update.email = email.toLowerCase();
    if (password) {
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(password, salt);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

