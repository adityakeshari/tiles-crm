import jwt from "jsonwebtoken";
import { query } from "../db.js";

function normalizeRoles(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    return user.roles.filter(Boolean);
  }

  if (typeof user?.role === "string" && user.role.trim()) {
    return [user.role.trim()];
  }

  return [];
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const queryToken = typeof req.query.token === "string" ? req.query.token : null;

  if (!header?.startsWith("Bearer ") && !queryToken) {
    return res.status(401).json({ message: "Missing auth token" });
  }

  const token = header?.startsWith("Bearer ") ? header.replace("Bearer ", "") : queryToken;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userResult = await query(
      "SELECT id, name, phone, role, roles, session_version FROM users WHERE id = $1 LIMIT 1",
      [decoded.id]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const tokenSessionVersion = Number(decoded.session_version ?? 0);
    const currentSessionVersion = Number(user.session_version ?? 0);

    if (tokenSessionVersion !== currentSessionVersion) {
      return res.status(401).json({
        message: "Session expired because your account was logged in elsewhere.",
        code: "SESSION_REPLACED",
      });
    }

    req.user = {
      ...decoded,
      name: user.name,
      phone: user.phone,
      role: user.role,
      roles: normalizeRoles(user),
      session_version: currentSessionVersion,
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const effectiveRoles = normalizeRoles(req.user);

    if (effectiveRoles.includes("admin") || req.user.role === "admin") {
      return next();
    }

    if (!roles.some((role) => effectiveRoles.includes(role) || req.user.role === role)) {
      return res.status(403).json({ message: "You do not have access to this resource" });
    }

    next();
  };
}
