import express from "express";
import {
  createPermission,
  getPermissions,
  updatePermission,
  deletePermission,
} from "./permissions.controller.js";
import { authenticateToken, authorize } from "../../utils/auth.js";

const router = express.Router();

// CREATE
router.post(
  "/",
  authenticateToken,
  authorize("permission.create"),
  createPermission
);

// READ ALL
router.get(
  "/",
  authenticateToken,
  authorize("permission.view"),
  getPermissions
);

// UPDATE
router.put(
  "/:id",
  authenticateToken,
  authorize("permission.edit"),
  updatePermission
);

// DELETE
router.delete(
  "/:id",
  authenticateToken,
  authorize("permission.delete"),
  deletePermission
);

export default router;