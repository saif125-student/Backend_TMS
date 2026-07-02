import express from "express";
import {
  createResignation,
  getResignations,
  getResignationByEmployeeId,
  updateResignation,
  deleteResignation,
updateResignationByEmployeeId,
createResignationByEmployeeId
} from "./resignation.controller.js";
import { authenticateToken, authorize } from "../../utils/auth.js";

const router = express.Router();

router.post(
  "/create",
  authenticateToken,
  authorize("resignation.create"),
  createResignation
);

router.post(
  "/employee/:employeeId",
  authenticateToken,
  authorize("resignation.create"),
  createResignationByEmployeeId
);

router.get(
  "/",
  authenticateToken,
  authorize("resignation.view"),
  getResignations
);

router.get(
  "/employee/:employeeId",
  authenticateToken,
  authorize("resignation.view"),
  getResignationByEmployeeId
);

router.put(
  "/:id",
  authenticateToken,
  authorize("resignation.edit"),
  updateResignation
);

router.put(
  "/employee/:employeeId",
  authenticateToken,
  authorize("resignation.edit"),
  updateResignationByEmployeeId
);

router.delete(
  "/:id",
  authenticateToken,
  authorize("resignation.delete"),
  deleteResignation
);

export default router;