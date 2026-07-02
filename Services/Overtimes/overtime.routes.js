import express from "express";
import {
  overtimeCheckin,
  overtimeCheckout,
  createOvertime,
  updateOvertime,
  deleteOvertime,
  getOvertimes,
  getOwnMonthlyOvertime,
} from "./overtime.controller.js";
import { authenticateToken, authorize } from "../../utils/auth.js";

const router = express.Router();

// ─── Employee Self-Service ────────────────────────────────────────────────────

// POST /overtimes/checkin
router.post(
  "/checkin",
  authenticateToken,
  authorize("overtime.create"),
  overtimeCheckin
);

// POST /overtimes/checkout
router.post(
  "/checkout",
  authenticateToken,
  authorize("overtime.create"),
  overtimeCheckout
);

// GET /overtimes/me/monthly/:month  — must be before /:id to avoid conflict
router.get(
  "/me/monthly/:month",
  authenticateToken,
  getOwnMonthlyOvertime
);

// ─── Admin Endpoints ──────────────────────────────────────────────────────────

// GET /overtimes  (supports ?employee_id, ?start_date, ?end_date, ?status)
router.get(
  "/",
  authenticateToken,
  authorize("overtime.view"),
  getOvertimes
);

// POST /overtimes  — admin manual creation
router.post(
  "/",
  authenticateToken,
  authorize("overtime.create"),
  createOvertime
);

// PUT /overtimes/:id
router.put(
  "/:id",
  authenticateToken,
  authorize("overtime.edit"),
  updateOvertime
);

// DELETE /overtimes/:id
router.delete(
  "/:id",
  authenticateToken,
  authorize("overtime.delete"),
  deleteOvertime
);

export default router;