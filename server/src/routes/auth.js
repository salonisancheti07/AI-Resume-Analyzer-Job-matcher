import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import passport from "passport";
import { User } from "../models/User.js";
import { hasOauthConfig } from "../auth/oauthConfig.js";
import { buildAuthToken, sanitizeUser, setAuthCookie } from "../auth/session.js";

export function createAuthRouter({ jwtSecret, frontendUrl, requireAuth }) {
  const router = express.Router();
  const buildOauthErrorRedirect = (provider, code = "failed") =>
    `${frontendUrl}/login?oauth=${provider}_${code}`;

  router.post("/signup", async (req, res) => {
    try {
      const { email = "", name = "", password = "", rememberMe = false } = req.body || {};
      if (!email || !password || !name) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({ message: "User already exists" });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        passwordHash,
        provider: "local",
        rememberMe,
        role: "user",
      });
      const safeUser = sanitizeUser(user);
      const token = buildAuthToken(safeUser, jwtSecret, rememberMe);
      setAuthCookie(res, token, rememberMe);
      res.json({ token, user: safeUser });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Sign up failed" });
    }
  });

  router.post("/login", async (req, res) => {
    try {
      const { email = "", password = "", rememberMe = false } = req.body || {};
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      user.rememberMe = rememberMe;
      await user.save();
      const safeUser = sanitizeUser(user);
      const token = buildAuthToken(safeUser, jwtSecret, rememberMe);
      setAuthCookie(res, token, rememberMe);
      res.json({ token, user: safeUser });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  router.post("/forgot-password", async (req, res) => {
    try {
      const { email = "" } = req.body || {};
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.json({ status: "ok", message: "If the account exists, a reset token has been generated." });
      }
      const resetToken = crypto.randomBytes(24).toString("hex");
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpiresAt = new Date(Date.now() + 1000 * 60 * 30);
      await user.save();
      res.json({
        status: "ok",
        message: "Reset token generated. Connect email delivery to send this token in production.",
        resetToken,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Forgot password failed" });
    }
  });

  router.post("/reset-password", async (req, res) => {
    try {
      const { token = "", password = "" } = req.body || {};
      if (!token || password.length < 8) {
        return res.status(400).json({ message: "Valid reset token and strong password are required" });
      }
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpiresAt: { $gt: new Date() },
      });
      if (!user) {
        return res.status(400).json({ message: "Reset token is invalid or expired" });
      }
      user.passwordHash = await bcrypt.hash(password, 12);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpiresAt = undefined;
      await user.save();
      res.json({ status: "ok", message: "Password reset successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Reset password failed" });
    }
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie("session_token");
    res.json({ status: "ok" });
  });

  router.get("/me", requireAuth, (req, res) => {
    res.json({ user: sanitizeUser(req.authUser) });
  });

  router.get("/google", (req, res, next) => {
    if (!hasOauthConfig(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_CALLBACK_URL)) {
      return res.redirect(`${frontendUrl}/login?oauth=google_unavailable`);
    }
    return passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  router.get(
    "/google/callback",
    (req, res, next) => {
      passport.authenticate("google", { session: false }, (error, user) => {
        if (error) {
          const message = String(error.message || "").toLowerCase();
          const code = message.includes("client secret") ? "invalid_credentials" : "failed";
          return res.redirect(buildOauthErrorRedirect("google", code));
        }
        if (!user) {
          return res.redirect(buildOauthErrorRedirect("google", "failed"));
        }

        try {
          const safeUser = sanitizeUser(user);
          const token = buildAuthToken(safeUser, jwtSecret, false);
          setAuthCookie(res, token, false);
          const encodedUser = encodeURIComponent(JSON.stringify(safeUser));
          return res.redirect(`${frontendUrl}/auth/callback?token=${encodeURIComponent(token)}&user=${encodedUser}`);
        } catch (callbackError) {
          return next(callbackError);
        }
      })(req, res, next);
    }
  );

  router.get("/github", (req, res, next) => {
    if (!hasOauthConfig(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET, process.env.GITHUB_CALLBACK_URL)) {
      return res.redirect(`${frontendUrl}/login?oauth=github_unavailable`);
    }
    return passport.authenticate("github", { scope: ["user:email"] })(req, res, next);
  });

  router.get(
    "/github/callback",
    (req, res, next) => {
      passport.authenticate("github", { session: false }, (error, user) => {
        if (error) {
          const message = String(error.message || "").toLowerCase();
          const code = message.includes("client secret") ? "invalid_credentials" : "failed";
          return res.redirect(buildOauthErrorRedirect("github", code));
        }
        if (!user) {
          return res.redirect(buildOauthErrorRedirect("github", "failed"));
        }

        try {
          const safeUser = sanitizeUser(user);
          const token = buildAuthToken(safeUser, jwtSecret, false);
          setAuthCookie(res, token, false);
          const encodedUser = encodeURIComponent(JSON.stringify(safeUser));
          return res.redirect(`${frontendUrl}/auth/callback?token=${encodeURIComponent(token)}&user=${encodedUser}`);
        } catch (callbackError) {
          return next(callbackError);
        }
      })(req, res, next);
    }
  );

  return router;
}
