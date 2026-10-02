import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { setAuthCookie, signToken } from "../middleware/authMiddleware.js";

const publicUser = (user) => ({ id: user._id.toString(), username: user.username });

export async function signup(req, res) {
  try {
    const username = req.body.username.toLowerCase();
    if (await User.findOne({ username })) return res.status(409).json({ detail: "Username already exists." });
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const user = await User.create({ username, passwordHash });
    setAuthCookie(res, signToken(user));
    return res.status(201).json(publicUser(user));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ detail: "Username already exists." });
    console.error(err);
    return res.status(500).json({ detail: "Registration failed." });
  }
}

export async function signin(req, res) {
  try {
    const username = req.body.username.toLowerCase();
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
      return res.status(401).json({ detail: "Invalid username or password." });
    }
    setAuthCookie(res, signToken(user));
    return res.json(publicUser(user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: "Sign in failed." });
  }
}

export function logout(req, res) {
  res.clearCookie("eld_auth", {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res.json({ detail: "Signed out." });
}

export function me(req, res) {
  return res.json({ authenticated: true, ...publicUser(req.user) });
}
