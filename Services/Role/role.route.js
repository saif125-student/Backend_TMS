import express from "express";
import {
  createRole,
  getRoles,
  updateRole,
  deleteRole,
  assignPermissionsToRole,
} from "./role.controller.js";
import { authenticateToken, authorize } from "../../utils/auth.js";

const router = express.Router();

// CREATE ROLE
router.post("/", authenticateToken, authorize("role.create"), createRole);

// GET ALL ROLES
router.get("/", authenticateToken, authorize("role.view"), getRoles);

// UPDATE ROLE
router.put("/:id", authenticateToken, authorize("role.edit"), updateRole);

// DELETE ROLE
router.delete("/:id", authenticateToken, authorize("role.delete"), deleteRole);

// ASSIGN PERMISSIONS TO ROLE
router.post(
  "/assign-permissions",
  authenticateToken,
  authorize("role.edit"),
  assignPermissionsToRole
);

export default router;