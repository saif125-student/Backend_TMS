import express from "express";
import {
  createDepartmentDutyTiming,
  getDepartmentDutyTimings,
  getDepartmentDutyTimingById,
  getDutyTimingsByDepartment,
  updateDepartmentDutyTiming,
  deleteDepartmentDutyTiming,

  createEmployeeDutyTiming,
  getEmployeeDutyTimings,
  getEmployeeDutyTimingById,
  getDutyTimingsByEmployee,
  updateEmployeeDutyTiming,
  deleteEmployeeDutyTiming,
} from "./dutytime.controller.js";
import {
  authenticateToken,
  authorize,
} from "../../utils/auth.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Department duty timings
|--------------------------------------------------------------------------
*/

router.post(
  "/departments",
  authenticateToken,
  authorize("duty-timing.create"),
  createDepartmentDutyTiming
);

router.get(
  "/departments",
  authenticateToken,
  authorize("duty-timing.view"),
  getDepartmentDutyTimings
);

router.get(
  "/departments/by-department/:departmentId",
  authenticateToken,
  authorize("duty-timing.view"),
  getDutyTimingsByDepartment
);

router.get(
  "/departments/:id",
  authenticateToken,
  authorize("duty-timing.view"),
  getDepartmentDutyTimingById
);

router.put(
  "/departments/:id",
  authenticateToken,
  authorize("duty-timing.edit"),
  updateDepartmentDutyTiming
);

router.delete(
  "/departments/:id",
  authenticateToken,
  authorize("duty-timing.delete"),
  deleteDepartmentDutyTiming
);

/*
|--------------------------------------------------------------------------
| Employee duty timings
|--------------------------------------------------------------------------
*/

router.post(
  "/employees",
  authenticateToken,
  authorize("duty-timing.create"),
  createEmployeeDutyTiming
);

router.get(
  "/employees",
  authenticateToken,
  authorize("duty-timing.view"),
  getEmployeeDutyTimings
);

router.get(
  "/employees/by-employee/:employeeId",
  authenticateToken,
  authorize("duty-timing.view"),
  getDutyTimingsByEmployee
);

router.get(
  "/employees/:id",
  authenticateToken,
  authorize("duty-timing.view"),
  getEmployeeDutyTimingById
);

router.put(
  "/employees/:id",
  authenticateToken,
  authorize("duty-timing.edit"),
  updateEmployeeDutyTiming
);

router.delete(
  "/employees/:id",
  authenticateToken,
  authorize("duty-timing.delete"),
  deleteEmployeeDutyTiming
);

export default router;