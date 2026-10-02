import express from "express";

import { authRequired } from "../middleware/authMiddleware.js";
import { validateTrip } from "../middleware/validation.js";

import {
  listTrips,
  createTrip,
  getTrip,
  deleteTrip,
  planTrip,
  eldPdf,
} from "../controllers/trip.controller.js";

const router = express.Router();

router.use(authRequired);

router.get("/", listTrips);

router.post("/", validateTrip, createTrip);

router.get("/:id/", getTrip);

router.delete("/:id/", deleteTrip);

router.post("/:id/plan/", planTrip);

router.get("/:id/eld.pdf", eldPdf);

export default router;