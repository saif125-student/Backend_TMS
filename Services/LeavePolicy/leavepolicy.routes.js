import express from "express";

import {
  createLeavePolicy,
  getLeavePolicies,
  updateLeavePolicy,
  deleteLeavePolicy,
} from "./leavepolicy.controller.js";

import { authenticateToken, authorize } from "../../utils/auth.js";

const router = express.Router();

// CREATE
router.post(
  "/",
  authenticateToken,
  authorize("leave-policy.create"),
  createLeavePolicy
);

// READ ALL
router.get(
  "/",
  authenticateToken,
  authorize("leave-policy.view"),
  getLeavePolicies
);

// UPDATE
router.put(
  "/:id",
  authenticateToken,
  authorize("leave-policy.edit"),
  updateLeavePolicy
);

// DELETE
router.delete(
  "/:id",
  authenticateToken,
  authorize("leave-policy.delete"),
  deleteLeavePolicy
);

export default router;