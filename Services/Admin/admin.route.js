import express from "express";
import {
  createAdmin,
  getAdmins,
  // getAdminById,
  updateAdmin,
  deleteAdmin,
} from "./admin.controller.js";
import { authenticateToken, authorize } from "../../utils/auth.js";
import { upload } from "../../utils/fileHandler.js";

const router = express.Router();

// CREATE
router.post(
  "/create",
  authenticateToken,
  authorize("admin.create"),
  upload.single("profile"),
  createAdmin
);

// READ
router.get("/", authenticateToken, authorize("admin.view"), getAdmins);
// router.get("/:id", getAdminById);

// UPDATE
router.put(
  "/:id",
  authenticateToken,
  authorize("admin.edit"),
  upload.single("profile"),
  updateAdmin
);

// DELETE
router.delete(
  "/:id",
  authenticateToken,
  authorize("admin.delete"),
  deleteAdmin
);

export default router;