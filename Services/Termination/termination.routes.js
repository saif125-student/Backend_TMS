import express from "express";
import {
  createTermination,
  getTerminations,
  getTerminationByEmployeeId,
  updateTermination,
  deleteTermination,
} from "./termination.controller.js";
import { authenticateToken, authorize } from "../../utils/auth.js";

const router = express.Router();

router.post(
  "/create",
  authenticateToken,
  authorize("termination.create"),
  createTermination
);

router.get(
  "/",
  authenticateToken,
  authorize("termination.view"),
  getTerminations
);

router.get(
  "/employee/:employeeId",
  authenticateToken,
  authorize("termination.view"),
  getTerminationByEmployeeId
);

router.put(
  "/:id",
  authenticateToken,
  authorize("termination.edit"),
  updateTermination
);

router.delete(
  "/:id",
  authenticateToken,
  authorize("termination.delete"),
  deleteTermination
);

export default router;