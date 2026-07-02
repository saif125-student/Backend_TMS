import express from "express";
import {
  createDesignation,
  getDesignations,
  updateDesignation,
  deleteDesignation,
} from "./designation.controller.js";
import { authenticateToken, authorize } from "../../utils/auth.js";

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  authorize("designation.create"),
  createDesignation
);

router.get(
  "/",
  authenticateToken,
  authorize("designation.view"),
  getDesignations
);

router.put(
  "/:id",
  authenticateToken,
  authorize("designation.edit"),
  updateDesignation
);

router.delete(
  "/:id",
  authenticateToken,
  authorize("designation.delete"),
  deleteDesignation
);

export default router;
