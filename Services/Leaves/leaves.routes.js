import express from "express";
import {
  createLeave,
  getLeaves,
  deleteLeave,
  updateLeave,
  updateStatusById,
} from "./leaves.controller.js";
import { upload } from "../../utils/fileHandler.js";
import { authenticateToken, authorize } from "../../utils/auth.js";

const router = express.Router();

router.post(
  "/create",
  authenticateToken,
  authorize("leave.create"),
  upload.single("attachment"),
  createLeave
);

router.put(
  "/:id",
  authenticateToken,
  authorize("leave.edit"),
  upload.single("attachment"),
  updateLeave
);

router.put(
  "/status/:id",
  authenticateToken,
  updateStatusById
);


router.get(
  "/",
  authenticateToken,
  authorize("leave.view"),
  getLeaves
);

router.delete(
  "/:id",
  authenticateToken,
  authorize("leave.delete"),
  deleteLeave
);




export default router;