import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import tripRoutes from "./routes/trip.routes.js";
import connection from "./connect/connection.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 4000;
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173,http://127.0.0.1:5173").split(",").map(v => v.trim());

app.use(cors({ origin(origin, cb) { if (!origin || allowedOrigins.includes(origin)) return cb(null, true); return cb(new Error("Origin not allowed by CORS")); }, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/api/health/", (req, res) => res.json({ status: "ok", backend: "node", database: "mongodb" }));
app.use("/api/auth", authRoutes);
app.use("/api/trip", tripRoutes);
app.use((req, res) => res.status(404).json({ detail: "Route not found." }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ detail: "Internal server error." }); });

async function start() {
  await connection();
  app.listen(port, () => console.log(`Server running on port ${port}`));
}
start().catch(err => { console.error("Startup failed:", err); process.exit(1); });
