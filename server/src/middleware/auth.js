import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export function createRequireAuth(jwtSecret) {
  return async function requireAuth(req, res, next) {
    try {
      const bearer = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : "";
      const token = bearer || req.cookies?.session_token || "";
      if (!token) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const payload = jwt.verify(token, jwtSecret);
      const user = await User.findById(payload.sub);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      req.authUser = user;
      next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired session" });
    }
  };
}
