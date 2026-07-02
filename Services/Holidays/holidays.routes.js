import express from "express";
import {
  createHoliday,
  getHolidays,
  getHolidayById,
  updateHoliday,
  deleteHolidays,
} from "./holidays.controller.js";
import {
  authenticateToken,
  authorize,
} from "../../utils/auth.js";

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  authorize("holiday.create"),
  createHoliday
);

router.get(
  "/",
  authenticateToken,
  authorize("holiday.view"),
  getHolidays
);

router.get(
  "/:id",
  authenticateToken,
  authorize("holiday.view"),
  getHolidayById
);

router.put(
  "/:id",
  authenticateToken,
  authorize("holiday.edit"),
  updateHoliday
);

router.delete(
  "/bulk",
  authenticateToken,
  authorize("holiday.delete"),
  deleteHolidays
);

export default router;