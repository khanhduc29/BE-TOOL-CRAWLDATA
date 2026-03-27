import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "crawler-tool-secret-key-2024";

/**
 * Middleware: verify JWT token from Authorization header.
 * Sets req.user = { id, email, role }
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Không có token — vui lòng đăng nhập",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
}
