import prisma from "../../prisma/client.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  toDateOnly,
  toTimeOnly,
  getCurrentDateOnly,
  getCurrentTimeOnly,
  calculateOvertimeMinutes,
  getMinutesFromTime,
  formatTime,
  formatMinutes,
  getPakistanDayName,
  serialize,
} from "../../utils/appDateTime.js";
import {
  validateEmployeeCheckin,
  validateEmployeeCheckout,
  validateAdminCreateOvertime,
  validateAdminUpdateOvertime,
  validateOvertimeId,
  validateMonthParam,
} from "./overtime.validation.js";
import { findDutyTiming } from "../Attendance/attendance.controller.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Karachi";

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Find an employee row by the logged-in user's ID.
 */
const getEmployeeByUserId = async (userId) => {
  return prisma.employees.findFirst({
    where: { userId: BigInt(userId) },
  });
};

/**
 * Check if a given time is within a start and end time range.
 * Supports overnight ranges (e.g. 22:00 to 06:00).
 */
const isTimeWithinRange = (timeToCheck, startTime, endTime) => {
  if (!timeToCheck || !startTime || !endTime) return false;

  const t = getMinutesFromTime(timeToCheck);
  const start = getMinutesFromTime(startTime);
  const end = getMinutesFromTime(endTime);

  if (start <= end) {
    return t >= start && t < end;
  } else {
    // Overnight duty timing
    return t >= start || t < end;
  }
};

/**
 * Validate that check-out is strictly after check-in, with overnight support.
 * Both checkInTime and checkOutTime should be "HH:mm" strings.
 */
const validateTimeOrder = (checkInTime, checkOutTime) => {
  if (!checkInTime || !checkOutTime) return;

  const checkIn  = toTimeOnly(checkInTime);
  const checkOut = toTimeOnly(checkOutTime);

  const ciMinutes = checkIn.getUTCHours()  * 60 + checkIn.getUTCMinutes();
  let   coMinutes = checkOut.getUTCHours() * 60 + checkOut.getUTCMinutes();

  // Allow overnight: treat checkout as next day if it falls before check-in
  // But reject if they are identical (zero-length session)
  if (ciMinutes === coMinutes) {
    throw { status: 400, message: "Check-in and check-out times cannot be identical." };
  }
};

/**
 * Format a single overtime row for API responses.
 */
const formatOvertimeRow = (overtime, index = 0) => {
  const minutes = overtime.overtime_minutes ?? 0;

  return {
    sr_no:           index + 1,
    id:              overtime.id?.toString(),
    employee_id:     overtime.employee_id?.toString(),

    employee:
      overtime.employees?.user?.name ||
      overtime.employees?.name ||
      null,

    designation:
      overtime.employees?.designation?.name ||
      null,

    date:            overtime.date
      ? new Date(overtime.date).toISOString().slice(0, 10)
      : null,

    day:             overtime.date ? getPakistanDayName(overtime.date) : null,

    check_in:        formatTime(overtime.check_in_time),
    check_out:       formatTime(overtime.check_out_time),

    status:          overtime.check_out_time ? "completed" : "active",

    overtime_minutes: minutes,
    duration:         formatMinutes(minutes),

    remarks:          overtime.remarks,
    created_at:       overtime.created_at,
    updated_at:       overtime.updated_at,
  };
};

// ─── 1. Employee Overtime Check-In ────────────────────────────────────────────

export const overtimeCheckin = async (req, res) => {
  try {
    const data = validateEmployeeCheckin(req.body);

    // Resolve employee from logged-in user
    const employee = await getEmployeeByUserId(req.user.id);
    if (!employee) {
      return errorResponse(res, "Employee not found", {
        status: 404,
        message: "No employee profile linked to your account.",
      }, 404);
    }

    const todayDate = getCurrentDateOnly();

    // Guard 1: Employee must have completed normal attendance checkout today
    const attendance = await prisma.attendances.findFirst({
      where: {
        employee_id: employee.id,
        date:        todayDate,
      },
    });

    if (!attendance) {
      return errorResponse(
        res,
        "No attendance record today",
        {
          status: 400,
          message:
            "You must have an attendance record for today before starting overtime.",
        },
        400
      );
    }

    if (!attendance.check_out_time) {
      return errorResponse(
        res,
        "Attendance not checked out",
        {
          status: 400,
          message:
            "You must complete your regular attendance checkout before starting overtime.",
        },
        400
      );
    }

    // Guard 2: No active overtime session (check_out_time is null)
    const activeOvertime = await prisma.overtimes.findFirst({
      where: {
        employee_id:    employee.id,
        date:           todayDate,
        check_out_time: null,
      },
    });

    if (activeOvertime) {
      return errorResponse(
        res,
        "Active overtime session exists",
        {
          status: 409,
          message:
            "You already have an active overtime session. Please checkout first.",
        },
        409
      );
    }

    const now = new Date();
    const checkInTime = getCurrentTimeOnly();

    // Guard 3: Cannot perform overtime during regular duty hours
    const dutyTiming = await findDutyTiming(employee.id, todayDate);
    if (dutyTiming && dutyTiming.start_time && dutyTiming.end_time) {
      if (isTimeWithinRange(checkInTime, dutyTiming.start_time, dutyTiming.end_time)) {
        return errorResponse(
          res,
          "Overtime during duty hours",
          {
            status: 400,
            message: `You cannot do overtime within your regular duty hours (${formatTime(
              dutyTiming.start_time
            )} - ${formatTime(dutyTiming.end_time)}).`,
          },
          400
        );
      }
    }

    const overtime = await prisma.overtimes.create({
      data: {
        employee_id:     employee.id,
        date:            todayDate,
        check_in_time:   checkInTime,
        check_out_time:  null,
        overtime_minutes: 0,
        overtime_rate:   0,
        overtime_pay:    0,
        remarks:         data.remarks ?? null,
        created_at:      now,
        updated_at:      now,
      },
    });

    return successResponse(
      res,
      "Overtime check-in recorded successfully",
      serialize(overtime),
      201
    );
  } catch (error) {
    return errorResponse(
      res,
      "Failed to check in for overtime",
      error?.message ?? error,
      error?.status ?? 500
    );
  }
};

// ─── 2. Employee Overtime Check-Out ───────────────────────────────────────────

export const overtimeCheckout = async (req, res) => {
  try {
    const data = validateEmployeeCheckout(req.body);

    // Resolve employee from logged-in user
    const employee = await getEmployeeByUserId(req.user.id);
    if (!employee) {
      return errorResponse(res, "Employee not found", {
        status: 404,
        message: "No employee profile linked to your account.",
      }, 404);
    }

    // Find the latest active overtime session for this employee
    const activeOvertime = await prisma.overtimes.findFirst({
      where: {
        employee_id:    employee.id,
        check_out_time: null,
      },
      orderBy: { created_at: "desc" },
    });

    if (!activeOvertime) {
      return errorResponse(
        res,
        "No active overtime session",
        {
          status: 404,
          message:
            "No active overtime session found. Please check in for overtime first.",
        },
        404
      );
    }

    const now          = new Date();
    const checkOutTime = getCurrentTimeOnly();

    // Calculate overtime minutes (overnight-aware)
    const overtimeMinutes = calculateOvertimeMinutes(
      activeOvertime.check_in_time,
      checkOutTime
    );

    const updated = await prisma.overtimes.update({
      where: { id: activeOvertime.id },
      data: {
        check_out_time:   checkOutTime,
        overtime_minutes: overtimeMinutes,
        overtime_rate:    0,
        overtime_pay:     0,
        ...(data.remarks !== undefined && { remarks: data.remarks }),
        updated_at:       now,
      },
    });

    return successResponse(
      res,
      "Overtime check-out recorded successfully",
      {
        ...serialize(updated),
        overtime_minutes: overtimeMinutes,
        duration:         formatMinutes(overtimeMinutes),
      }
    );
  } catch (error) {
    return errorResponse(
      res,
      "Failed to check out from overtime",
      error?.message ?? error,
      error?.status ?? 500
    );
  }
};

// ─── 3. Admin Create Overtime ─────────────────────────────────────────────────

export const createOvertime = async (req, res) => {
  try {
    const data = validateAdminCreateOvertime(req.body);

    // Validate time order (overnight allowed, but not identical)
    validateTimeOrder(data.check_in_time, data.check_out_time);

    // Validate employee exists
    const employee = await prisma.employees.findUnique({
      where: { id: data.employee_id },
    });

    if (!employee) {
      return errorResponse(res, "Employee not found", {
        status: 404,
        message: "Employee not found.",
      }, 404);
    }

    const overtimeDate  = toDateOnly(data.date);
    const checkInTime   = toTimeOnly(data.check_in_time);
    const checkOutTime  = toTimeOnly(data.check_out_time);

    // Calculate minutes (overnight-aware)
    const overtimeMinutes = calculateOvertimeMinutes(checkInTime, checkOutTime);

    const now = new Date();

    // Multiple records on same date are ALLOWED — no duplicate check
    const overtime = await prisma.overtimes.create({
      data: {
        employee_id:      data.employee_id,
        date:             overtimeDate,
        check_in_time:    checkInTime,
        check_out_time:   checkOutTime,
        overtime_minutes: overtimeMinutes,
        overtime_rate:    0,
        overtime_pay:     0,
        remarks:          data.remarks ?? null,
        created_at:       now,
        updated_at:       now,
      },
    });

    return successResponse(
      res,
      "Overtime created successfully",
      {
        ...serialize(overtime),
        overtime_minutes: overtimeMinutes,
        duration:         formatMinutes(overtimeMinutes),
      },
      201
    );
  } catch (error) {
    return errorResponse(
      res,
      "Failed to create overtime",
      error?.message ?? error,
      error?.status ?? 500
    );
  }
};

// ─── 4. Admin Update Overtime ─────────────────────────────────────────────────

export const updateOvertime = async (req, res) => {
  try {
    const id   = validateOvertimeId(req.params.id);
    const data = validateAdminUpdateOvertime(req.body);

    // Fetch existing record
    const existing = await prisma.overtimes.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse(res, "Overtime not found", {
        status: 404,
        message: "Overtime record not found.",
      }, 404);
    }

    // Validate employee if employee_id is changing
    if (data.employee_id !== undefined) {
      const employee = await prisma.employees.findUnique({
        where: { id: data.employee_id },
      });
      if (!employee) {
        return errorResponse(res, "Employee not found", {
          status: 404,
          message: "Employee not found.",
        }, 404);
      }
    }

    // Resolve final date
    const finalDate = data.date
      ? toDateOnly(data.date)
      : existing.date;

    // Resolve final times (keep existing if not provided)
    const finalCheckIn  = data.check_in_time  !== undefined
      ? toTimeOnly(data.check_in_time)
      : existing.check_in_time;

    const finalCheckOut = data.check_out_time !== undefined
      ? toTimeOnly(data.check_out_time)
      : existing.check_out_time;

    // If we now have both times, validate order and recalculate minutes
    let overtimeMinutes = existing.overtime_minutes ?? 0;

    if (finalCheckIn && finalCheckOut) {
      validateTimeOrder(
        formatTime(finalCheckIn),
        formatTime(finalCheckOut)
      );
      overtimeMinutes = calculateOvertimeMinutes(finalCheckIn, finalCheckOut);
    }

    const updatePayload = {
      date:             finalDate,
      check_in_time:    finalCheckIn,
      check_out_time:   finalCheckOut,
      overtime_minutes: overtimeMinutes,
      overtime_rate:    0,
      overtime_pay:     0,
      updated_at:       new Date(),
    };

    if (data.employee_id !== undefined) {
      updatePayload.employee_id = data.employee_id;
    }

    if (data.remarks !== undefined) {
      updatePayload.remarks = data.remarks;
    }

    const updated = await prisma.overtimes.update({
      where: { id },
      data:  updatePayload,
    });

    return successResponse(
      res,
      "Overtime updated successfully",
      {
        ...serialize(updated),
        overtime_minutes: overtimeMinutes,
        duration:         formatMinutes(overtimeMinutes),
      }
    );
  } catch (error) {
    return errorResponse(
      res,
      "Failed to update overtime",
      error?.message ?? error,
      error?.status ?? 500
    );
  }
};

// ─── 5. Admin Get Overtime List ───────────────────────────────────────────────

export const getOvertimes = async (req, res) => {
  try {
    const { employee_id, start_date, end_date, status } = req.query;

    const where = {};

    // Filter by employee
    if (employee_id) {
      const empId = BigInt(employee_id);
      where.employee_id = empId;
    }

    // Filter by date range
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = toDateOnly(start_date);
      if (end_date)   where.date.lte = toDateOnly(end_date);
    }

    // Filter by status
    if (status === "active") {
      where.check_out_time = null;
    } else if (status === "completed") {
      where.check_out_time = { not: null };
    }

    const overtimes = await prisma.overtimes.findMany({
      where,
      include: {
        employees: {
          include: {
            user:        true,
            designation: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { check_in_time: "desc" }],
    });

    const formatted = overtimes.map((overtime, index) =>
      formatOvertimeRow(overtime, index)
    );

    return successResponse(res, "Overtimes fetched successfully", {
      total:    formatted.length,
      overtimes: formatted,
    });
  } catch (error) {
    return errorResponse(
      res,
      "Failed to fetch overtimes",
      error?.message ?? error,
      error?.status ?? 500
    );
  }
};

// ─── 6. Employee Own Monthly Overtime ─────────────────────────────────────────

export const getOwnMonthlyOvertime = async (req, res) => {
  try {
    const month = validateMonthParam(req.params.month); // "YYYY-MM"

    // Resolve employee from logged-in user
    const employee = await getEmployeeByUserId(req.user.id);
    if (!employee) {
      return errorResponse(res, "Employee not found", {
        status: 404,
        message: "No employee profile linked to your account.",
      }, 404);
    }

    // Build PKT-aware date range for the given month
    const startStr = `${month}-01`;
    const endDate  = dayjs.tz(startStr, APP_TIMEZONE).endOf("month");
    const endStr   = endDate.format("YYYY-MM-DD");

    const startDate = toDateOnly(startStr);
    const endDateObj = toDateOnly(endStr);

    // Fetch completed overtime sessions only
    const overtimes = await prisma.overtimes.findMany({
      where: {
        employee_id:    employee.id,
        date:           { gte: startDate, lte: endDateObj },
        check_out_time: { not: null },
      },
      orderBy: [{ date: "asc" }, { check_in_time: "asc" }],
    });

    // Format each row
    const records = overtimes.map((ot, index) => ({
      sr_no:            index + 1,
      id:               ot.id?.toString(),
      date:             new Date(ot.date).toISOString().slice(0, 10),
      day:              getPakistanDayName(ot.date),
      check_in:         formatTime(ot.check_in_time),
      check_out:        formatTime(ot.check_out_time),
      overtime_minutes: ot.overtime_minutes ?? 0,
      duration:         formatMinutes(ot.overtime_minutes ?? 0),
      remarks:          ot.remarks,
    }));

    // Monthly summary
    const totalMinutes = records.reduce(
      (sum, r) => sum + (r.overtime_minutes ?? 0),
      0
    );

    return successResponse(
      res,
      "Monthly overtime fetched successfully",
      {
        employee_id: employee.id.toString(),
        month,
        records,
        summary: {
          total_records:          records.length,
          total_overtime_minutes: totalMinutes,
          total_overtime_hours:   Number((totalMinutes / 60).toFixed(2)),
          total_duration:         formatMinutes(totalMinutes),
        },
      }
    );
  } catch (error) {
    return errorResponse(
      res,
      "Failed to fetch monthly overtime",
      error?.message ?? error,
      error?.status ?? 500
    );
  }
};

// ─── 7. Admin Delete Overtime ─────────────────────────────────────────────────

export const deleteOvertime = async (req, res) => {
  try {
    const id = validateOvertimeId(req.params.id);

    const overtime = await prisma.overtimes.findUnique({ where: { id } });
    if (!overtime) {
      return errorResponse(
        res,
        "Overtime not found",
        { status: 404, message: "Overtime record not found." },
        404
      );
    }

    await prisma.overtimes.delete({ where: { id } });

    return successResponse(res, "Overtime deleted successfully");
  } catch (error) {
    return errorResponse(
      res,
      "Failed to delete overtime",
      error?.message ?? error,
      error?.status ?? 500
    );
  }
};