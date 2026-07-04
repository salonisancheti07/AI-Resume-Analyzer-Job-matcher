import jwt from "jsonwebtoken";

export function buildAuthToken(user = {}, jwtSecret, rememberMe = false) {
  return jwt.sign(
    {
      sub: String(user._id || user.id),
      email: user.email,
      name: user.name,
      role: user.role || "user",
      rememberMe,
    },
    jwtSecret,
    { expiresIn: rememberMe ? "30d" : "1d" }
  );
}

export function sanitizeUser(user = {}) {
  return {
    id: String(user._id || user.id || ""),
    name: user.name || "",
    email: user.email || "",
    avatarUrl: user.avatarUrl || "",
    provider: user.provider || "local",
    role: user.role || "user",
  };
}

export function setAuthCookie(res, token, rememberMe = false) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
  };

  if (rememberMe) {
    cookieOptions.maxAge = 1000 * 60 * 60 * 24 * 30;
  }

  res.cookie("session_token", token, cookieOptions);
}
