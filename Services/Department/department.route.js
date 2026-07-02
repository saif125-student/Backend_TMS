import express from "express";
import {
  createDepartment,
  getDepartments,
  updateDepartment,
  deleteDepartment,
} from "./department.controller.js";
import { authenticateToken, authorize } from "../../utils/auth.js";

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  authorize("department.create"),
  createDepartment
);

router.get(
  "/",
  authenticateToken,
  authorize("department.view"),
  getDepartments
);

router.put(
  "/:id",
  authenticateToken,
  authorize("department.edit"),
  updateDepartment
);

router.delete(
  "/:id",
  authenticateToken,
  authorize("department.delete"),
  deleteDepartment
);

export default router;
