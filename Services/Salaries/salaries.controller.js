import prisma from "../../prisma/client.js";
import {
  successResponse,
  errorResponse,
} from "../../utils/response.js";
import {
  validateComputeSalary,
  validateCreateSalary,
  validateSalaryEmployeeId,
  validateUpdateSalary,
  validateSalaryId,
  validateBulkGenerateSalary,
  validateExpectedSalary,
} from "./salaries.validation.js";

import {
   calculatePayrollTotals,
   buildSalaryCreateData,
  formatSalaryResult,
} from "./salary.helper.js";
import { generateExpectedSalarySlipPdf } from "./salarySlip.pdf.js";
import { getMinutesFromTime } from "../../utils/appDateTime.js";

const toDateOnly = (date) => new Date(`${date}T00:00:00.000Z`);

// Validates that a "YYYY-MM-DD" string is a real calendar date
// (prevents JS silently rolling e.g. June 31 → July 1)
const isValidCalendarDate = (dateStr) => {
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (isNaN(parsed.getTime())) return false;
  const [year, month, day] = dateStr.split("-").map(Number);
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
};

const serialize = (data) => {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

const getNumber = (value) => {
  if (value === null || value === undefined) return 0;

  if (typeof value === "object" && typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(value || 0);
};

const toMoney = (value) => {
  return Number(Number(value || 0).toFixed(2));
};

const handleSalaryError = (res, error, defaultMessage) => {
  if (error?.status) {
    return errorResponse(
      res,
      error.message,
      null,
      error.status
    );
  }

  if (error?.code === "P2002") {
    return errorResponse(
      res,
      "Duplicate salary record found.",
      null,
      409
    );
  }

  if (error?.code === "P2025") {
    return errorResponse(
      res,
      "Salary record not found.",
      null,
      404
    );
  }

  return errorResponse(res, defaultMessage, error);
};

const getEmployee = async (employeeId) => {
  return prisma.employees.findUnique({
    where: {
      id: employeeId,
    },
    include: {
      user: true,
      designation: true,
    },
  });
};

const sumItems = (items = []) => {
  return items.reduce((total, item) => {
    return total + Number(item.amount || 0);
  }, 0);
};

const salaryInclude = {
  employees: {
    include: {
      user: true,
      designation: true,
      departments: true,
    },
  },
  salary_allowances: true,
  salary_deductions: true,
};


export const createSalary = async (req, res) => {
  try {
    const data = validateCreateSalary(req.body);

    const startDate = toDateOnly(data.start_date);
    const endDate = toDateOnly(data.end_date);

    if (endDate < startDate) {
      return errorResponse(
        res,
        "End date must be greater than or equal to start date.",
        null,
        400
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employees.findUnique({
        where: {
          id: data.employee_id,
        },
        include: {
          user: true,
          designation: true,
        },
      });

      if (!employee) {
        return {
          error: {
            message: "Employee not found.",
            status: 404,
          },
        };
      }

      const existingSalary = await tx.salaries.findFirst({
        where: {
          employee_id: data.employee_id,
          start_date: {
            lte: endDate,
          },
          end_date: {
            gte: startDate,
          },
        },
      });

      if (existingSalary) {
        return {
          error: {
            message:
              "A salary record for this employee already exists within the selected date range.",
            status: 409,
          },
        };
      }

      /*
       * Fetch all attendance statuses.
       * Present, Absent and On_Leave are needed
       * to calculate total working days.
       */
      const attendanceRows = await tx.attendances.findMany({
        where: {
          employee_id: data.employee_id,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          date: "asc",
        },
      });

      if (attendanceRows.length === 0) {
        return {
          error: {
            message:
              "No attendance records found within the selected date range.",
            status: 400,
          },
        };
      }

      /*
       * Fetch only completed overtime sessions.
       */
      const overtimeRows = await tx.overtimes.findMany({
        where: {
          employee_id: data.employee_id,
          date: {
            gte: startDate,
            lte: endDate,
          },
          check_out_time: {
            not: null,
          },
        },
        orderBy: {
          date: "asc",
        },
      });

      const allowances = data.allowances || [];
      const deductions = data.deductions || [];

      const totals = calculatePayrollTotals({
        employee,
        attendanceRows,
        overtimeRows,
        allowances,
        deductions,
        overtimeMultiplier: 1.5,
      });

      if (totals.workingDays <= 0) {
        return {
          error: {
            message:
              "No working days found within the selected date range.",
            status: 400,
          },
        };
      }

      const now = new Date();

      const salary = await tx.salaries.create({
        data: buildSalaryCreateData({
          employee,
          startDate,
          endDate,
          totals,
          allowances,
          deductions,
          remarks:
            data.remarks ||
            "Salary generated from attendance and overtime records",
          now,
        }),
        include: salaryInclude,
      });

      return {
        salary,
        calculation: {
          working_days: totals.workingDays,
          present_days: totals.presentDays,
          absent_days: totals.absentDays,
          leave_days: totals.leaveDays,
          holiday_days: totals.holidayDays,
          weekend_days: totals.weekendDays,

          daily_salary: totals.dailySalary,

          attendance_salary: totals.attendanceSalary,

          early_leave_minutes:
            totals.totalEarlyLeaveMinutes || 0,

          overtime_minutes: totals.overtimeMinutes,
          overtime_hours: totals.overtimeHours,
          overtime_salary: totals.overtimeSalary,

          total_allowances: totals.totalAllowances,
          total_deductions: totals.totalDeductions,

          net_salary: totals.netSalary,
        },
      };
    });

    if (result.error) {
      return errorResponse(
        res,
        result.error.message,
        null,
        result.error.status
      );
    }

    return successResponse(
      res,
      "Salary created successfully",
      serialize(result),
      201
    );
  } catch (error) {
    return handleSalaryError(
      res,
      error,
      "Failed to create salary"
    );
  }
};

export const getAllSalaries = async (req, res) => {
  try {
    const salaries = await prisma.salaries.findMany({
      include: salaryInclude,
      orderBy: {
        start_date: "desc",
      },
    });

    return successResponse(
      res,
      "Salaries fetched successfully",
      serialize(salaries)
    );
  } catch (error) {
    return handleSalaryError(
      res,
      error,
      "Failed to fetch salaries"
    );
  }
};

export const getSalariesByEmployeeId = async (req, res) => {
  try {
    const employeeId = validateSalaryEmployeeId(req.params.employeeId);

    const employee = await prisma.employees.findUnique({
      where: {
        id: employeeId,
      },
    });

    if (!employee) {
      return errorResponse(
        res,
        "Employee not found",
        null,
        404
      );
    }

    const salaries = await prisma.salaries.findMany({
      where: {
        employee_id: employeeId,
      },
      include: salaryInclude,
      orderBy: {
        start_date: "desc",
      },
    });

    return successResponse(
      res,
      "Employee salaries fetched successfully",
      serialize(salaries)
    );
  } catch (error) {
    return handleSalaryError(
      res,
      error,
      "Failed to fetch employee salaries"
    );
  }
};
export const updateSalary = async (req, res) => {
  try {
    const salaryId = validateSalaryId(req.params.id);
    const data = validateUpdateSalary(req.body);

    const updatedSalary = await prisma.$transaction(async (tx) => {
      const oldSalary = await tx.salaries.findUnique({
        where: {
          id: salaryId,
        },
        include: {
          employees: {
            include: {
              user: true,
              designation: true,
            },
          },
          salary_allowances: true,
          salary_deductions: true,
        },
      });

      if (!oldSalary) {
        return {
          error: {
            message: "Salary not found.",
            status: 404,
          },
        };
      }

      const employee = oldSalary.employees;

      const startDate =
        data.start_date !== undefined
          ? toDateOnly(data.start_date)
          : oldSalary.start_date;

      const endDate =
        data.end_date !== undefined
          ? toDateOnly(data.end_date)
          : oldSalary.end_date;

      if (endDate < startDate) {
        return {
          error: {
            message:
              "End date must be greater than or equal to start date.",
            status: 400,
          },
        };
      }

      const duplicateSalary = await tx.salaries.findFirst({
        where: {
          employee_id: oldSalary.employee_id,

          start_date: {
            lte: endDate,
          },

          end_date: {
            gte: startDate,
          },

          NOT: {
            id: salaryId,
          },
        },
      });

      if (duplicateSalary) {
        return {
          error: {
            message:
              "Another salary record already exists within the selected date range.",
            status: 409,
          },
        };
      }

      const now = new Date();

      /*
       * Keep existing allowance and deduction records when
       * they are not provided in the update body.
       */
      let allowances = oldSalary.salary_allowances.map(
        (allowance) => ({
          name: allowance.name,
          amount: getNumber(allowance.amount),
        })
      );

      let deductions = oldSalary.salary_deductions.map(
        (deduction) => ({
          name: deduction.name,
          amount: getNumber(deduction.amount),
        })
      );

      /*
       * Replace allowances only when allowances are provided.
       * Sending an empty array removes all allowances.
       */
      if (data.allowances !== undefined) {
        await tx.salary_allowances.deleteMany({
          where: {
            salary_id: salaryId,
          },
        });

        allowances = data.allowances;

        if (allowances.length > 0) {
          await tx.salary_allowances.createMany({
            data: allowances.map((allowance) => ({
              salary_id: salaryId,
              name: allowance.name,
              amount: getNumber(allowance.amount),
              created_at: now,
              updated_at: now,
            })),
          });
        }
      }

      /*
       * Replace deductions only when deductions are provided.
       * Sending an empty array removes all deductions.
       */
      if (data.deductions !== undefined) {
        await tx.salary_deductions.deleteMany({
          where: {
            salary_id: salaryId,
          },
        });

        deductions = data.deductions;

        if (deductions.length > 0) {
          await tx.salary_deductions.createMany({
            data: deductions.map((deduction) => ({
              salary_id: salaryId,
              name: deduction.name,
              amount: getNumber(deduction.amount),
              created_at: now,
              updated_at: now,
            })),
          });
        }
      }

      /*
       * Fetch all attendance statuses.
       * Present, Absent and On_Leave are required for
       * working-day calculation.
       */
      const attendanceRows = await tx.attendances.findMany({
        where: {
          employee_id: oldSalary.employee_id,

          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          date: "asc",
        },
      });

      if (attendanceRows.length === 0) {
        return {
          error: {
            message:
              "No attendance records found within the selected date range.",
            status: 400,
          },
        };
      }

      /*
       * Only completed overtime sessions are included.
       */
      const overtimeRows = await tx.overtimes.findMany({
        where: {
          employee_id: oldSalary.employee_id,

          date: {
            gte: startDate,
            lte: endDate,
          },

          check_out_time: {
            not: null,
          },
        },
        orderBy: {
          date: "asc",
        },
      });

      const totals = calculatePayrollTotals({
        employee,
        attendanceRows,
        overtimeRows,
        allowances,
        deductions,

        overtimeMultiplier: 1.5,

        // Change to true when approved leave should be paid.
        paidLeave: false,
      });

      if (totals.workingDays <= 0) {
        return {
          error: {
            message:
              "No working days found within the selected date range.",
            status: 400,
          },
        };
      }

      const salary = await tx.salaries.update({
        where: {
          id: salaryId,
        },
        data: {
          /*
           * Keep the salary snapshot according to the employee's
           * current basic salary.
           */
          basic_salary: totals.basicSalary,
          currency: employee.currency || null,

          start_date: startDate,
          end_date: endDate,

          attendance_days: totals.attendanceDays,
          attendance_salary: totals.attendanceSalary,

          overtime_hours: totals.overtimeHours,
          overtime_salary: totals.overtimeSalary,

          total_allowances: totals.totalAllowances,
          total_deductions: totals.totalDeductions,

          net_salary: totals.netSalary,

          ...(data.remarks !== undefined && {
            remarks: data.remarks,
          }),

          updated_at: now,
        },
        include: salaryInclude,
      });

      return {
        salary,

        calculation: {
          working_days: totals.workingDays,

          present_days: totals.presentDays,
          absent_days: totals.absentDays,
          leave_days: totals.leaveDays,
          holiday_days: totals.holidayDays,
          weekend_days: totals.weekendDays,

          daily_salary: totals.dailySalary,

          attendance_days: totals.attendanceDays,
          attendance_salary: totals.attendanceSalary,

          late_minutes: totals.totalLateMinutes,
          early_leave_minutes:
            totals.totalEarlyLeaveMinutes,

          overtime_minutes: totals.overtimeMinutes,
          overtime_hours: totals.overtimeHours,
          overtime_salary: totals.overtimeSalary,

          total_allowances: totals.totalAllowances,
          total_deductions: totals.totalDeductions,

          net_salary: totals.netSalary,
        },
      };
    });

    if (updatedSalary.error) {
      return errorResponse(
        res,
        updatedSalary.error.message,
        null,
        updatedSalary.error.status
      );
    }

    return successResponse(
      res,
      "Salary updated successfully",
      serialize(updatedSalary)
    );
  } catch (error) {
    return handleSalaryError(
      res,
      error,
      "Failed to update salary"
    );
  }
};


export const deleteSalary = async (req, res) => {
  try {
    const salaryId = validateSalaryId(req.params.id);

    const existingSalary = await prisma.salaries.findUnique({
      where: {
        id: salaryId,
      },
    });

    if (!existingSalary) {
      return errorResponse(
        res,
        "Salary not found",
        null,
        404
      );
    }

    await prisma.salaries.delete({
      where: {
        id: salaryId,
      },
    });

    return successResponse(
      res,
      "Salary deleted successfully"
    );
  } catch (error) {
    return handleSalaryError(
      res,
      error,
      "Failed to delete salary"
    );
  }
};


export const bulkGenerateSalaries = async (req, res) => {
  try {
    const data = validateBulkGenerateSalary(req.body);

    const startDate = toDateOnly(data.start_date);
    const endDate = toDateOnly(data.end_date);

    if (endDate < startDate) {
      return errorResponse(
        res,
        "End date must be greater than or equal to start date.",
        null,
        400
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const employees = await tx.employees.findMany({
          include: {
            user: true,
            designation: true,
          },
        });

        // All statuses are required to calculate working days.
        const attendanceRows = await tx.attendances.findMany({
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: {
            date: "asc",
          },
        });

        // Only completed overtime sessions.
        const overtimeRows = await tx.overtimes.findMany({
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
            check_out_time: {
              not: null,
            },
          },
          orderBy: {
            date: "asc",
          },
        });

        // Fetch overlapping salaries once.
        const existingSalaries = await tx.salaries.findMany({
          where: {
            start_date: {
              lte: endDate,
            },
            end_date: {
              gte: startDate,
            },
          },
          select: {
            employee_id: true,
          },
        });

        const existingSalaryEmployeeIds = new Set(
          existingSalaries.map((salary) =>
            salary.employee_id.toString()
          )
        );

        // Group attendance rows by employee.
        const attendanceMap = new Map();

        for (const attendance of attendanceRows) {
          const employeeKey = attendance.employee_id.toString();

          if (!attendanceMap.has(employeeKey)) {
            attendanceMap.set(employeeKey, []);
          }

          attendanceMap.get(employeeKey).push(attendance);
        }

        // Group overtime rows by employee.
        const overtimeMap = new Map();

        for (const overtime of overtimeRows) {
          const employeeKey = overtime.employee_id.toString();

          if (!overtimeMap.has(employeeKey)) {
            overtimeMap.set(employeeKey, []);
          }

          overtimeMap.get(employeeKey).push(overtime);
        }

        const generatedSalaries = [];
        const skippedEmployees = [];
        const now = new Date();

        for (const employee of employees) {
          const employeeKey = employee.id.toString();

          if (existingSalaryEmployeeIds.has(employeeKey)) {
            skippedEmployees.push({
              employee_id: employeeKey,
              employee_name: employee.user?.name || null,
              reason:
                "Salary already exists within the selected date range.",
            });

            continue;
          }

          const employeeAttendances =
            attendanceMap.get(employeeKey) || [];

          const employeeOvertimes =
            overtimeMap.get(employeeKey) || [];

          if (employeeAttendances.length === 0) {
            skippedEmployees.push({
              employee_id: employeeKey,
              employee_name: employee.user?.name || null,
              reason:
                "No attendance records found within the selected date range.",
            });

            continue;
          }

          const totals = calculatePayrollTotals({
            employee,
            attendanceRows: employeeAttendances,
            overtimeRows: employeeOvertimes,

            // Bulk generation initially has no manual items.
            allowances: [],
            deductions: [],

            overtimeMultiplier: 1.5,
          });

          if (totals.workingDays <= 0) {
            skippedEmployees.push({
              employee_id: employeeKey,
              employee_name: employee.user?.name || null,
              reason:
                "No payable working days found within the selected date range.",
            });

            continue;
          }

          const salary = await tx.salaries.create({
            data: buildSalaryCreateData({
              employee,
              startDate,
              endDate,
              totals,

              allowances: [],
              deductions: [],

              remarks:
                data.remarks ||
                "Bulk generated from attendance and overtime records",

              now,
            }),

            include: salaryInclude,
          });

          generatedSalaries.push(
            formatSalaryResult({
              employee,
              salary,
              totals,
            })
          );
        }

        const totalPayroll = generatedSalaries.reduce(
          (total, item) => {
            return total + Number(item.net_salary || 0);
          },
          0
        );

        return {
          period: {
            start_date: startDate,
            end_date: endDate,
          },

          summary: {
            total_employees: employees.length,
            generated: generatedSalaries.length,
            skipped: skippedEmployees.length,
            total_payroll: Number(totalPayroll.toFixed(2)),
          },

          results: generatedSalaries,
          skipped_records: skippedEmployees,
        };
      },
      {
        maxWait: 10000,
        timeout: 60000,
      }
    );

    return successResponse(
      res,
      "Bulk salaries generated successfully",
      serialize(result),
      201
    );
  } catch (error) {
    return handleSalaryError(
      res,
      error,
      "Failed to generate bulk salaries"
    );
  }
};

// ── Shared helper: compute expected salary data (used by JSON + PDF endpoints) ──
const computeExpectedSalary = async (userId, startDateStr, endDateStr) => {
  const startDate = toDateOnly(startDateStr);
  const endDate = toDateOnly(endDateStr);

  const employee = await prisma.employees.findUnique({
    where: { userId: BigInt(userId) },
    include: { user: true, designation: true },
  });

  if (!employee) {
    throw { status: 404, message: "Employee not found." };
  }

  // Fetch attendances in range with status 'Present' or 'On_Leave'
  const attendanceRows = await prisma.attendances.findMany({
    where: {
      employee_id: employee.id,
      date: { gte: startDate, lte: endDate },
      status: { in: ["Present", "On_Leave"] },
    },
  });

  // Fetch completed overtimes in range
  const overtimeRows = await prisma.overtimes.findMany({
    where: {
      employee_id: employee.id,
      date: { gte: startDate, lte: endDate },
      check_out_time: { not: null },
    },
  });

  // ── Dynamic calculation based on basicSalary / 23 ──
  const basicSalary = Number(employee.basicSalary || 0);
  const WORKING_DAYS = 23;
  const dailySalary = basicSalary / WORKING_DAYS;

  const totalPresentDays = attendanceRows.filter(r => r.status === "Present").length;
  const totalLeaveDays = attendanceRows.filter(r => r.status === "On_Leave").length;

  // Attendance salary: for each Present day, pay based on minutes worked within duty time
  let expectedAttendanceSalary = 0;
  for (const row of attendanceRows) {
    if (row.status === "On_Leave") {
      expectedAttendanceSalary += dailySalary;
    } else if (row.status === "Present") {
      const dutyStartMin = row.duty_start_time ? getMinutesFromTime(row.duty_start_time) : 0;
      const dutyEndMin = row.duty_end_time ? getMinutesFromTime(row.duty_end_time) : 0;
      const totalDutyMinutes = dutyEndMin > dutyStartMin ? dutyEndMin - dutyStartMin : 0;

      if (totalDutyMinutes > 0) {
        const workedMinutes = Number(row.worked_minutes || 0);
        const payableMinutes = Math.min(workedMinutes, totalDutyMinutes);
        const perMinuteRate = dailySalary / totalDutyMinutes;
        expectedAttendanceSalary += payableMinutes * perMinuteRate;
      }
    }
  }

  // Overtime salary: hourly_rate = dailySalary / duty_hours, overtime_rate = hourly_rate * 1.5
  const totalOvertimeMinutes = overtimeRows.reduce(
    (sum, row) => sum + (Number(row.overtime_minutes) || 0),
    0
  );
  const totalOvertimeHours = totalOvertimeMinutes / 60;

  let expectedOvertimeSalary = 0;
  for (const row of overtimeRows) {
    const minutes = Number(row.overtime_minutes || 0);
    if (minutes > 0) {
      const sameDayAttendance = attendanceRows.find(
        (a) => a.date?.getTime?.() === row.date?.getTime?.()
      );
      let dutyHours = 8;
      if (sameDayAttendance?.duty_start_time && sameDayAttendance?.duty_end_time) {
        const ds = getMinutesFromTime(sameDayAttendance.duty_start_time);
        const de = getMinutesFromTime(sameDayAttendance.duty_end_time);
        if (de > ds) dutyHours = (de - ds) / 60;
      }
      const hourlyRate = dailySalary / dutyHours;
      const overtimeRate = hourlyRate * 1.5;
      expectedOvertimeSalary += (minutes / 60) * overtimeRate;
    }
  }

  const expectedNetSalary = expectedAttendanceSalary + expectedOvertimeSalary;

  return {
    employee: {
      id: employee.id.toString(),
      name: employee.user?.name || null,
      designation: employee.designation?.name || null,
    },
    basicSalary: toMoney(basicSalary),
    dailySalary: toMoney(dailySalary),
    calculation: {
      start_date: startDateStr,
      end_date: endDateStr,
      present_days: totalPresentDays,
      leave_days: totalLeaveDays,
      total_overtime_minutes: totalOvertimeMinutes,
      total_overtime_hours: Number(totalOvertimeHours.toFixed(2)),
      expected_attendance_salary: toMoney(expectedAttendanceSalary),
      expected_overtime_salary: toMoney(expectedOvertimeSalary),
      expected_net_salary: toMoney(expectedNetSalary),
    },
  };
};

// ── JSON endpoint ──
export const getExpectedSalary = async (req, res) => {
  try {
    const data = validateExpectedSalary(req.body);

    if (!isValidCalendarDate(data.start_date)) {
      return errorResponse(res, `Invalid start date: "${data.start_date}" is not a valid calendar date.`, null, 400);
    }
    if (!isValidCalendarDate(data.end_date)) {
      return errorResponse(res, `Invalid end date: "${data.end_date}" is not a valid calendar date.`, null, 400);
    }

    const startDate = toDateOnly(data.start_date);
    const endDate = toDateOnly(data.end_date);
    if (endDate < startDate) {
      return errorResponse(res, "End date must be greater than or equal to start date.", null, 400);
    }

    const result = await computeExpectedSalary(req.user.id, data.start_date, data.end_date);

    return successResponse(res, "Expected salary calculated successfully", {
      employee: result.employee,
      calculation: result.calculation,
    });
  } catch (error) {
    if (error.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return handleSalaryError(res, error, "Failed to calculate expected salary");
  }
};

// ── PDF Salary Slip endpoint ──
export const getExpectedSalarySlip = async (req, res) => {
  try {
    const data = validateExpectedSalary(req.body);

    if (!isValidCalendarDate(data.start_date)) {
      return errorResponse(res, `Invalid start date: "${data.start_date}" is not a valid calendar date.`, null, 400);
    }
    if (!isValidCalendarDate(data.end_date)) {
      return errorResponse(res, `Invalid end date: "${data.end_date}" is not a valid calendar date.`, null, 400);
    }

    const startDate = toDateOnly(data.start_date);
    const endDate = toDateOnly(data.end_date);
    if (endDate < startDate) {
      return errorResponse(res, "End date must be greater than or equal to start date.", null, 400);
    }

    const result = await computeExpectedSalary(req.user.id, data.start_date, data.end_date);

    // Generate and stream PDF
    generateExpectedSalarySlipPdf(res, result);
  } catch (error) {
    if (error.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return handleSalaryError(res, error, "Failed to generate expected salary slip");
  }
};