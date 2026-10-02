import express from "express";
import { signup, signin, logout, me } from "../controllers/auth.controller.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { validateCredentials } from "../middleware/validation.js";

const router = express.Router();
router.post("/signup/", validateCredentials, signup);
router.post("/signin/", validateCredentials, signin);
router.post("/logout/", logout);
router.get("/me/", authRequired, me);
export default router;
