import express from "express";
import {
  markAttendance,
  getAttendances,
  getAttendanceByEmployeeId,
  updateAttendance,
  checkInAttendance,
  checkOutAttendance,
  getMyAttendanceByMonth,
} from "./attendance.controller.js";
import { authenticateToken, authorize } from "../../utils/auth.js";

const router = express.Router();

router.post(
  "/mark",
  authenticateToken,
  authorize("attendance.create"),
  markAttendance
);


router.post(
  "/checkin",
  authenticateToken,
  authorize("attendance.create"),
  checkInAttendance
);

router.post(
  "/checkout",
  authenticateToken,
  authorize("attendance.create"),
  checkOutAttendance
);

router.get(
  "/",
  authenticateToken,
  authorize("attendance.view"),
  getAttendances
);

router.get(
  "/employee/:employeeId",
  authenticateToken,
  authorize("attendance.view"),
  getAttendanceByEmployeeId
);

router.get(
  "/employee/monthly/:month",
  authenticateToken,
  authorize("attendance.view"),
  getMyAttendanceByMonth
);

router.put(
  "/:id",
  authenticateToken,
  authorize("attendance.edit"),
  updateAttendance
);




export default router;