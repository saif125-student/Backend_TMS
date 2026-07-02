import express from "express";
import {
  createSalary,
  getAllSalaries,
  getSalariesByEmployeeId,
  updateSalary,
  deleteSalary,
  bulkGenerateSalaries,
  getExpectedSalary,
  getExpectedSalarySlip,
} from "./salaries.controller.js";
import { authenticateToken, authorize } from "../../utils/auth.js";

const router = express.Router();



router.post(
  "/create",
  authenticateToken,
  authorize("salary.create"),
  createSalary
);

router.post(
  "/bulk-generate",
  authenticateToken,
  authorize("salary.create"),
  bulkGenerateSalaries
);

router.post(
  "/expected",
  authenticateToken,
  authorize("salary.view"),
  getExpectedSalary
);

router.post(
  "/expected/slip",
  authenticateToken,
  authorize("salary.view"),
  getExpectedSalarySlip
);

router.get(
  "/",
  authenticateToken,
  authorize("salary.view"),
  getAllSalaries
);

router.get(
  "/employee/:employeeId",
  authenticateToken,
  authorize("salary.view"),
  getSalariesByEmployeeId
);

router.put(
  "/:id",
  authenticateToken,
  authorize("salary.edit"),
  updateSalary
);

router.delete(
  "/:id",
  authenticateToken,
  authorize("salary.delete"),
  deleteSalary
);

export default router;