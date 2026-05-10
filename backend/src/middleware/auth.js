import jwt from "jsonwebtoken";

function normalizeRoles(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    return user.roles.filter(Boolean);
  }

  if (typeof user?.role === "string" && user.role.trim()) {
    return [user.role.trim()];
  }

  return [];
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const queryToken = typeof req.query.token === "string" ? req.query.token : null;

  if (!header?.startsWith("Bearer ") && !queryToken) {
    return res.status(401).json({ message: "Missing auth token" });
  }

  const token = header?.startsWith("Bearer ") ? header.replace("Bearer ", "") : queryToken;

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "change-me");
    req.user.roles = normalizeRoles(req.user);
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
