import prisma from "../../prisma/client.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  validateMarkAttendance,
  validateUpdateAttendance,
  validateAttendanceId,
  validateEmployeeId,
  validateSalaryReport,
  validateCheckInAttendance,
  validateCheckOutAttendance,
} from "./attendance.validation.js";
import { getMinutesFromTime, getCurrentTimeOnly, getCurrentDateOnly, getPakistanDayName } from "../../utils/appDateTime.js";
import dayjs from "dayjs";

const toDateOnly = (date) => new Date(`${date}T00:00:00.000Z`);

const toTimeOnly = (time) => {
  if (!time) return null;
  return new Date(`1970-01-01T${time}:00.000Z`);
};

const serialize = (data) => {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};


const calculateMinutesDifference = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;

  const startMinutes = getMinutesFromTime(startTime);
  const endMinutes = getMinutesFromTime(endTime);

  return Math.max(endMinutes - startMinutes, 0);
};

const getDaysInMonth = (date) => {
  const currentDate = new Date(date);

  return new Date(
    currentDate.getUTCFullYear(),
    currentDate.getUTCMonth() + 1,
    0
  ).getUTCDate();
};

const toMoney = (value) => {
  return Number(Number(value || 0).toFixed(2));
};

const calculateAttendanceMetrics = ({
  status,
  checkInTime,
  checkOutTime,
  dutyStartTime,
  dutyEndTime,
}) => {
  if (
    status !== "Present" ||
    !checkInTime ||
    !checkOutTime ||
    !dutyStartTime ||
    !dutyEndTime
  ) {
    return {
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      paidRegularMinutes: 0,
    };
  }

  const checkInMinutes = getMinutesFromTime(checkInTime);
  const checkOutMinutes = getMinutesFromTime(checkOutTime);
  const dutyStartMinutes = getMinutesFromTime(dutyStartTime);
  const dutyEndMinutes = getMinutesFromTime(dutyEndTime);

  const workedMinutes = Math.max(
    checkOutMinutes - checkInMinutes,
    0
  );

  const lateMinutes = Math.max(
    checkInMinutes - dutyStartMinutes,
    0
  );

  const earlyLeaveMinutes = Math.max(
    dutyEndMinutes - checkOutMinutes,
    0
  );

  const overtimeMinutes = Math.max(
    checkOutMinutes - Math.max(checkInMinutes, dutyEndMinutes),
    0
  );

  const paidStartMinutes = Math.max(
    checkInMinutes,
    dutyStartMinutes
  );

  const paidEndMinutes = Math.min(
    checkOutMinutes,
    dutyEndMinutes
  );

  const paidRegularMinutes = Math.max(
    paidEndMinutes - paidStartMinutes,
    0
  );

  return {
    workedMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    paidRegularMinutes,
  };
};

const calculateLiveRates = async (tx, employeeId, date, dutyStartTime, dutyEndTime, paidRegularMinutes, overtimeMinutes = 0) => {
  const employee = await tx.employees.findUnique({
    where: { id: employeeId },
    select: { basicSalary: true }
  });

  if (!employee || !employee.basicSalary) {
    return { dailyPay: 0, overtimeRate: 0, overtimePay: 0 };
  }

  const basicSalary = Number(employee.basicSalary);

  const dailySalary = basicSalary / 23;

  // Compute duty minutes
  const dutyMinutes = calculateMinutesDifference(dutyStartTime, dutyEndTime);
  if (dutyMinutes <= 0) {
    return { dailyPay: 0, overtimeRate: 0, overtimePay: 0 };
  }

  const payableMinutes = Math.min(paidRegularMinutes, dutyMinutes);
  const dailyPay = toMoney(payableMinutes * (dailySalary / dutyMinutes));

  // Compute overtime pay
  const dutyHours = dutyMinutes / 60;
  const regularHourlyRate = dutyHours > 0 ? dailySalary / dutyHours : 0;
  const overtimeMultiplier = 1.5;
  const overtimeRate = regularHourlyRate * overtimeMultiplier;
  const overtimePay = toMoney((overtimeMinutes / 60) * overtimeRate);

  return {
    dailyPay,
    overtimeRate: toMoney(overtimeRate),
    overtimePay,
  };
};

const getEmployeeByUserId = async (userId) => {
  return prisma.employees.findFirst({
    where: {
      userId: BigInt(userId),
    },
  });
};

export const findDutyTiming = async (employeeId, attendanceDate) => {
  const employeeDutyTiming = await prisma.employee_duty_timings.findFirst({
    where: {
      employee_id: employeeId,
      AND: [
        {
          OR: [
            { valid_from: null },
            { valid_from: { lte: attendanceDate } },
          ],
        },
        {
          OR: [
            { valid_till: null },
            { valid_till: { gte: attendanceDate } },
          ],
        },
      ],
    },
    orderBy: {
      valid_from: "desc",
    },
  });

  if (employeeDutyTiming) {
    return employeeDutyTiming;
  }

  const departmentEmployee = await prisma.department_employee.findFirst({
    where: {
      employeeId: employeeId,
    },
  });

  if (!departmentEmployee) {
    return null;
  }

  return prisma.duty_timings.findFirst({
    where: {
      department_id: departmentEmployee.departmentId,
    },
    orderBy: {
      id: "desc",
    },
  });
};


const existingAttendanceCheck = async (employeeId, attendanceDate) => {

  return await prisma.attendances.findFirst({
    where: {
      employee_id: employeeId,
      date: attendanceDate,
    },
  });
}

const CheckEmployee = async (employeeId) => {
  return await prisma.employees.findUnique({
    where: { id: employeeId },
  });
}

export const markAttendance = async (req, res) => {
  try {
    const data = validateMarkAttendance(req.body);

    const employeeId = data.employee_id;
    const attendanceDate = toDateOnly(data.date);

    const employee = await CheckEmployee(employeeId);

    if (!employee) {
      return errorResponse(res, "Employee not found", {
        status: 404,
        message: "Employee not found.",
      });
    }

    const existingAttendance = await existingAttendanceCheck(
      employeeId,
      attendanceDate
    );

    if (existingAttendance) {
      return errorResponse(res, "Attendance already marked", {
        status: 409,
        message:
          "Attendance already marked for this employee on this date.",
      });
    }

    const dutyTiming = await findDutyTiming(
      employeeId,
      attendanceDate
    );

    if (!dutyTiming) {
      return errorResponse(res, "Duty timing not found", {
        status: 404,
        message:
          "Duty timing not found for this employee on selected date.",
      });
    }

    const checkInTime = data.check_in_time
      ? toTimeOnly(data.check_in_time)
      : null;

    const checkOutTime = data.check_out_time
      ? toTimeOnly(data.check_out_time)
      : null;

    if (
      data.status === "Present" &&
      (!checkInTime || !checkOutTime)
    ) {
      return errorResponse(res, "Attendance time required", {
        status: 400,
        message:
          "Check-in and check-out times are required for Present attendance.",
      });
    }

    if (
      data.status === "Present" &&
      getMinutesFromTime(checkOutTime) <=
      getMinutesFromTime(checkInTime)
    ) {
      return errorResponse(res, "Invalid attendance time", {
        status: 400,
        message:
          "Check-out time must be greater than check-in time.",
      });
    }

    const metrics = calculateAttendanceMetrics({
      status: data.status,
      checkInTime,
      checkOutTime,
      dutyStartTime: dutyTiming.start_time,
      dutyEndTime: dutyTiming.end_time,
    });

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      let dailyPay = 0;
      let overtimeRate = 0;
      let overtimePay = 0;

      if (data.status === "Present") {
        const rates = await calculateLiveRates(
          tx,
          employeeId,
          attendanceDate,
          dutyTiming.start_time,
          dutyTiming.end_time,
          metrics.paidRegularMinutes,
          metrics.overtimeMinutes
        );
        dailyPay = rates.dailyPay;
        overtimeRate = rates.overtimeRate;
        overtimePay = rates.overtimePay;
      }

      const attendance = await tx.attendances.create({
        data: {
          employee_id: employeeId,
          date: attendanceDate,

          check_in_time: checkInTime,
          check_out_time: checkOutTime,

          duty_start_time: dutyTiming.start_time,
          duty_end_time: dutyTiming.end_time,

          worked_minutes: metrics.workedMinutes,
          late_minutes: metrics.lateMinutes,
          early_leave_minutes: metrics.earlyLeaveMinutes,

          daily_pay: dailyPay,

          status: data.status,
          remarks: data.remarks || null,

          created_at: now,
          updated_at: now,
        },
      });

      let overtime = null;

      if (metrics.overtimeMinutes > 0) {
        overtime = await tx.overtimes.create({
          data: {
            employee_id: employeeId,
            date: attendanceDate,

            check_in_time: dutyTiming.end_time,
            check_out_time: checkOutTime,

            overtime_minutes: metrics.overtimeMinutes,

            overtime_rate: overtimeRate,
            overtime_pay: overtimePay,

            remarks:
              "Auto-created from admin attendance marking",

            created_at: now,
            updated_at: now,
          },
        });
      }

      return {
        attendance,
        overtime,
        metrics,
      };
    });

    return successResponse(
      res,
      "Attendance marked successfully",
      serialize(result),
      201
    );
  } catch (error) {
    return errorResponse(
      res,
      "Failed to mark attendance",
      error
    );
  }
};


export const checkInAttendance = async (req, res) => {
  try {
    const data = validateCheckInAttendance(req.body);
    const userId = req.user.id;

    const attendanceDate = getCurrentDateOnly();

    const employee = await getEmployeeByUserId(userId);

    if (!employee) {
      return errorResponse(res, "Employee not found", {
        status: 404,
        message: "Employee profile not found for logged-in user.",
      });
    }

    const employeeId = employee.id;

    const existingAttendance = await existingAttendanceCheck(
      employeeId,
      attendanceDate
    );

    if (existingAttendance) {
      return errorResponse(res, "Attendance already marked", {
        status: 409,
        message: "You have already checked in today.",
      });
    }

    const approvedLeave = await prisma.leaves.findFirst({
      where: {
        employee_id: employeeId,
        status: "approved", // use exact Prisma enum value
        start_date: {
          lte: attendanceDate,
        },
        end_date: {
          gte: attendanceDate,
        },
      },
    });

    if (approvedLeave) {
      return errorResponse(res, "Employee is on leave", {
        status: 400,
        message: "You cannot check in because you have approved leave today.",
      });
    }

    const holiday = await prisma.holidays.findFirst({
      where: {
        start_date: {
          lte: attendanceDate,
        },
        end_date: {
          gte: attendanceDate,
        },
      },
    });

    if (holiday) {
      return errorResponse(res, "Today is a holiday", {
        status: 400,
        message: "Attendance check-in is not allowed on a holiday.",
      });
    }

    const WEEKEND_DAYS = (process.env.WEEKEND_DAYS || "0,6")
      .split(",")
      .map(Number);

    if (WEEKEND_DAYS.includes(attendanceDate.getUTCDay())) {
      return errorResponse(res, "Today is a weekend", {
        status: 400,
        message: "Attendance check-in is not allowed on a weekend.",
      });
    }

    const dutyTiming = await findDutyTiming(
      employeeId,
      attendanceDate
    );

    if (!dutyTiming) {
      return errorResponse(res, "Duty timing not found", {
        status: 404,
        message: "Duty timing not found for today.",
      });
    }

    const checkInTime = getCurrentTimeOnly();
    const now = new Date();

    const attendance = await prisma.attendances.create({
      data: {
        employee_id: employeeId,
        date: attendanceDate,

        check_in_time: checkInTime,
        check_out_time: null,

        duty_start_time: dutyTiming.start_time,
        duty_end_time: dutyTiming.end_time,

        worked_minutes: 0,
        late_minutes: 0,
        early_leave_minutes: 0,

        // Money will be calculated during payroll generation
        daily_pay: 0,

        status: "Present",
        remarks: data.remarks || null,

        created_at: now,
        updated_at: now,
      },
    });

    return successResponse(
      res,
      "Checked in successfully",
      serialize(attendance),
      201
    );
  } catch (error) {
    return errorResponse(res, "Failed to check in", error);
  }
};

export const checkOutAttendance = async (req, res) => {
  try {
    const data = validateCheckOutAttendance(req.body);

    const userId = req.user.id;
    const attendanceDate = getCurrentDateOnly();

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employees.findFirst({
        where: {
          userId: BigInt(userId),
        },
      });

      if (!employee) {
        return {
          error: {
            title: "Employee not found",
            status: 404,
            message: "Employee profile not found for logged-in user.",
          },
        };
      }

      const attendance = await tx.attendances.findFirst({
        where: {
          employee_id: employee.id,
          date: attendanceDate,
          check_out_time: null,
        },
      });

      if (!attendance) {
        return {
          error: {
            title: "Active attendance not found",
            status: 404,
            message:
              "No active check-in found for today, or you have already checked out.",
          },
        };
      }

      if (!attendance.check_in_time) {
        return {
          error: {
            title: "Check-in time missing",
            status: 400,
            message: "Cannot checkout because check-in time is missing.",
          },
        };
      }

      if (!attendance.duty_start_time || !attendance.duty_end_time) {
        return {
          error: {
            title: "Duty timing missing",
            status: 400,
            message: "Cannot checkout because duty timing is missing.",
          },
        };
      }

      const checkOutTime = getCurrentTimeOnly();

      const checkInMinutes = getMinutesFromTime(
        attendance.check_in_time
      );

      const checkOutMinutes = getMinutesFromTime(checkOutTime);

      if (checkOutMinutes <= checkInMinutes) {
        return {
          error: {
            title: "Invalid checkout time",
            status: 400,
            message: "Checkout time must be later than check-in time.",
          },
        };
      }

      const metrics = calculateAttendanceMetrics({
        status: attendance.status,
        checkInTime: attendance.check_in_time,
        checkOutTime,
        dutyStartTime: attendance.duty_start_time,
        dutyEndTime: attendance.duty_end_time,
      });

      const now = new Date();

      const rates = await calculateLiveRates(
        tx,
        employee.id,
        attendanceDate,
        attendance.duty_start_time,
        attendance.duty_end_time,
        metrics.paidRegularMinutes,
        metrics.overtimeMinutes
      );

      const updatedAttendance = await tx.attendances.update({
        where: {
          id: attendance.id,
        },
        data: {
          check_out_time: checkOutTime,

          worked_minutes: metrics.workedMinutes,
          late_minutes: metrics.lateMinutes,
          early_leave_minutes: metrics.earlyLeaveMinutes,

          daily_pay: rates.dailyPay,

          remarks: data.remarks ?? attendance.remarks,

          updated_at: now,
        },
      });

      let overtime = null;

      if (metrics.overtimeMinutes > 0) {
        overtime = await tx.overtimes.create({
          data: {
            employee_id: employee.id,
            date: attendanceDate,

            check_in_time: attendance.check_in_time > attendance.duty_end_time ? attendance.check_in_time : attendance.duty_end_time,
            check_out_time: checkOutTime,

            overtime_minutes: metrics.overtimeMinutes,

            overtime_rate: rates.overtimeRate,
            overtime_pay: rates.overtimePay,

            remarks: "Auto-created from employee checkout",

            created_at: now,
            updated_at: now,
          },
        });
      }

      return {
        attendance: updatedAttendance,
        overtime,
        metrics,
      };
    });

    if (result.error) {
      return errorResponse(res, result.error.title, {
        status: result.error.status,
        message: result.error.message,
      });
    }

    return successResponse(
      res,
      "Checked out successfully",
      serialize(result),
      200
    );
  } catch (error) {
    return errorResponse(
      res,
      "Failed to check out",
      error
    );
  }
};

export const getAttendances = async (req, res) => {
  try {
    const attendances = await prisma.attendances.findMany({
      include: {
        employees: {
          include: {
            user: true,
            designation: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return successResponse(
      res,
      "Attendances fetched successfully",
      serialize(attendances)
    );
  } catch (error) {
    return errorResponse(res, "Failed to fetch attendances", error);
  }
};

export const getAttendanceByEmployeeId = async (req, res) => {
  try {
    const employeeId = validateEmployeeId(req.params.employeeId);

    const employee = await prisma.employees.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return errorResponse(res, "Employee not found", {
        status: 404,
        message: "Employee not found.",
      });
    }

    const attendances = await prisma.attendances.findMany({
      where: {
        employee_id: employeeId,
      },
      include: {
        employees: {
          include: {
            user: true,
            designation: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return successResponse(
      res,
      "Employee attendances fetched successfully",
      serialize(attendances)
    );
  } catch (error) {
    return errorResponse(res, "Failed to fetch employee attendances", error);
  }
};


export const getMyAttendanceByMonth = async (req, res) => {
  try {
    const userId = req.user.id;
    const { month } = req.params;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return errorResponse(
        res,
        "Month is required in YYYY-MM format.",
        null,
        400
      );
    }

    const monthDate = dayjs.tz(
      `${month}-01 00:00:00`,
      process.env.APP_TIMEZONE
    );

    if (!monthDate.isValid()) {
      return errorResponse(
        res,
        "Invalid month.",
        null,
        400
      );
    }

    const employee = await getEmployeeByUserId(userId);

    if (!employee) {
      return errorResponse(
        res,
        "Employee profile not found.",
        null,
        404
      );
    }

    const daysInMonth = monthDate.daysInMonth();

    const startDate = toDateOnly(`${month}-01`);

    const endDate = toDateOnly(
      `${month}-${String(daysInMonth).padStart(2, "0")}`
    );

    const attendanceRows = await prisma.attendances.findMany({
      where: {
        employee_id: employee.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        status: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    const attendanceMap = new Map(
      attendanceRows.map((attendance) => [
        attendance.date.toISOString().slice(0, 10),
        attendance.status,
      ])
    );

    const attendance = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${month}-${String(day).padStart(2, "0")}`;

      attendance.push({
        date: dateKey,

        day: dayjs
          .tz(`${dateKey} 00:00:00`, process.env.APP_TIMEZONE)
          .format("dddd"),

        status: attendanceMap.get(dateKey) || "Not_Marked",
      });
    }

    return successResponse(
      res,
      "Monthly attendance fetched successfully",
      {
        employee: {
          id: employee.id.toString(),
          name: employee.user?.name || null,
        },

        timezone: process.env.APP_TIMEZONE,
        month,
        attendance,
      }
    );
  } catch (error) {
    return errorResponse(
      res,
      "Failed to fetch monthly attendance",
      error
    );
  }
};


export const updateAttendance = async (req, res) => {
  try {
    const attendanceId = validateAttendanceId(req.params.id);
    const data = validateUpdateAttendance(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const oldAttendance = await tx.attendances.findUnique({
        where: {
          id: attendanceId,
        },
      });

      if (!oldAttendance) {
        return {
          error: {
            title: "Attendance not found",
            status: 404,
            message: "Attendance not found.",
          },
        };
      }

      const employeeId =
        data.employee_id ?? oldAttendance.employee_id;

      const attendanceDate =
        data.date !== undefined
          ? toDateOnly(data.date)
          : oldAttendance.date;

      const employee = await tx.employees.findUnique({
        where: {
          id: employeeId,
        },
      });

      if (!employee) {
        return {
          error: {
            title: "Employee not found",
            status: 404,
            message: "Employee not found.",
          },
        };
      }

      const duplicateAttendance = await tx.attendances.findFirst({
        where: {
          employee_id: employeeId,
          date: attendanceDate,
          NOT: {
            id: attendanceId,
          },
        },
      });

      if (duplicateAttendance) {
        return {
          error: {
            title: "Duplicate attendance",
            status: 409,
            message:
              "Attendance already exists for this employee on this date.",
          },
        };
      }

      let dutyTiming = null;

      if (
        data.employee_id !== undefined ||
        data.date !== undefined
      ) {
        dutyTiming = await findDutyTiming(
          employeeId,
          attendanceDate
        );

        if (!dutyTiming) {
          return {
            error: {
              title: "Duty timing not found",
              status: 404,
              message:
                "Duty timing not found for this employee on selected date.",
            },
          };
        }
      }

      const finalStatus =
        data.status !== undefined
          ? data.status
          : oldAttendance.status;

      let finalCheckInTime =
        data.check_in_time !== undefined
          ? toTimeOnly(data.check_in_time)
          : oldAttendance.check_in_time;

      let finalCheckOutTime =
        data.check_out_time !== undefined
          ? toTimeOnly(data.check_out_time)
          : oldAttendance.check_out_time;

      const finalDutyStartTime = dutyTiming
        ? dutyTiming.start_time
        : oldAttendance.duty_start_time;

      const finalDutyEndTime = dutyTiming
        ? dutyTiming.end_time
        : oldAttendance.duty_end_time;

      // Non-present records should not keep attendance times.
      if (finalStatus !== "Present") {
        finalCheckInTime = null;
        finalCheckOutTime = null;
      }

      if (
        finalStatus === "Present" &&
        (!finalCheckInTime || !finalCheckOutTime)
      ) {
        return {
          error: {
            title: "Attendance time required",
            status: 400,
            message:
              "Check-in and check-out times are required for Present attendance.",
          },
        };
      }

      if (
        finalStatus === "Present" &&
        getMinutesFromTime(finalCheckOutTime) <=
        getMinutesFromTime(finalCheckInTime)
      ) {
        return {
          error: {
            title: "Invalid attendance time",
            status: 400,
            message:
              "Check-out time must be greater than check-in time.",
          },
        };
      }

      const metrics = calculateAttendanceMetrics({
        status: finalStatus,
        checkInTime: finalCheckInTime,
        checkOutTime: finalCheckOutTime,
        dutyStartTime: finalDutyStartTime,
        dutyEndTime: finalDutyEndTime,
      });

      const now = new Date();

      const rates = await calculateLiveRates(
        tx,
        employeeId,
        attendanceDate,
        finalDutyStartTime,
        finalDutyEndTime,
        metrics.paidRegularMinutes,
        metrics.overtimeMinutes
      );

      const updatedAttendance = await tx.attendances.update({
        where: {
          id: attendanceId,
        },
        data: {
          ...(data.employee_id !== undefined && {
            employee_id: employeeId,
          }),

          ...(data.date !== undefined && {
            date: attendanceDate,
          }),

          check_in_time: finalCheckInTime,
          check_out_time: finalCheckOutTime,

          duty_start_time: finalDutyStartTime,
          duty_end_time: finalDutyEndTime,

          worked_minutes: metrics.workedMinutes,
          late_minutes: metrics.lateMinutes,
          early_leave_minutes: metrics.earlyLeaveMinutes,

          daily_pay: rates.dailyPay,

          status: finalStatus,

          ...(data.remarks !== undefined && {
            remarks: data.remarks,
          }),

          updated_at: now,
        },
      });

      // Delete only attendance-generated overtime.
      // Manual overtime rows remain untouched.
      await tx.overtimes.deleteMany({
        where: {
          employee_id: oldAttendance.employee_id,
          date: oldAttendance.date,
          remarks: {
            in: [
              "Auto-created from admin attendance marking",
              "Auto-created from employee checkout",
            ],
          },
        },
      });

      let overtime = null;

      if (metrics.overtimeMinutes > 0) {
        overtime = await tx.overtimes.create({
          data: {
            employee_id: employeeId,
            date: attendanceDate,

            check_in_time: finalDutyEndTime,
            check_out_time: finalCheckOutTime,

            overtime_minutes: metrics.overtimeMinutes,

            overtime_rate: rates.overtimeRate,
            overtime_pay: rates.overtimePay,

            remarks:
              "Auto-created from admin attendance marking",

            created_at: now,
            updated_at: now,
          },
        });
      }

      return {
        attendance: updatedAttendance,
        overtime,
        metrics,
      };
    });

    if (result.error) {
      return errorResponse(res, result.error.title, {
        status: result.error.status,
        message: result.error.message,
      });
    }

    return successResponse(
      res,
      "Attendance updated successfully",
      serialize(result)
    );
  } catch (error) {
    return errorResponse(
      res,
      "Failed to update attendance",
      error
    );
  }
};