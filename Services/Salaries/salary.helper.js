export const getNumber = (value) => {
  if (value === null || value === undefined) return 0;

  if (
    typeof value === "object" &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }

  return Number(value || 0);
};

export const toMoney = (value) => {
  return Number(Number(value || 0).toFixed(2));
};

export const sumSalaryItems = (items = []) => {
  return toMoney(
    items.reduce((total, item) => {
      return total + getNumber(item.amount);
    }, 0)
  );
};

export const getMinutesFromTime = (time) => {
  if (!time) return 0;

  const date = new Date(time);

  return date.getUTCHours() * 60 + date.getUTCMinutes();
};

const calculateMinutesDifference = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;

  const startMinutes = getMinutesFromTime(startTime);
  let endMinutes = getMinutesFromTime(endTime);

  // Supports shifts or overtime sessions crossing midnight.
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return Math.max(endMinutes - startMinutes, 0);
};

const calculatePaidRegularMinutes = (attendance) => {
  if (
    attendance.status !== "Present" ||
    !attendance.check_in_time ||
    !attendance.check_out_time ||
    !attendance.duty_start_time ||
    !attendance.duty_end_time
  ) {
    return 0;
  }

  let checkInMinutes = getMinutesFromTime(
    attendance.check_in_time
  );

  let checkOutMinutes = getMinutesFromTime(
    attendance.check_out_time
  );

  const dutyStartMinutes = getMinutesFromTime(
    attendance.duty_start_time
  );

  let dutyEndMinutes = getMinutesFromTime(
    attendance.duty_end_time
  );

  const isOvernightDuty =
    dutyEndMinutes <= dutyStartMinutes;

  if (isOvernightDuty) {
    dutyEndMinutes += 24 * 60;

    // Example: duty 22:00–06:00 and check-in at 01:00.
    if (checkInMinutes < dutyStartMinutes) {
      checkInMinutes += 24 * 60;
    }
  }

  if (checkOutMinutes <= checkInMinutes) {
    checkOutMinutes += 24 * 60;
  }

  const paidStartMinutes = Math.max(
    checkInMinutes,
    dutyStartMinutes
  );

  const paidEndMinutes = Math.min(
    checkOutMinutes,
    dutyEndMinutes
  );

  return Math.max(
    paidEndMinutes - paidStartMinutes,
    0
  );
};

const getDateKey = (date) => {
  return new Date(date).toISOString().slice(0, 10);
};

export const calculatePayrollTotals = ({
  employee,
  attendanceRows = [],
  overtimeRows = [],
  allowances = [],
  deductions = [],
  overtimeMultiplier = 1.5,
  paidLeave = false,
}) => {
  const basicSalary = getNumber(
    employee.basicSalary ??
      employee.basic_salary ??
      0
  );

  const presentRows = attendanceRows.filter(
    (row) => row.status === "Present"
  );

  const absentRows = attendanceRows.filter(
    (row) => row.status === "Absent"
  );

  const leaveRows = attendanceRows.filter(
    (row) => row.status === "On_Leave"
  );

  const holidayRows = attendanceRows.filter(
    (row) => row.status === "Holiday"
  );

  const weekendRows = attendanceRows.filter(
    (row) => row.status === "Weekend"
  );

  /*
   * Weekend and Holiday are excluded.
   * Present, Absent and On_Leave are scheduled working days.
   */
  const workingDays =
    presentRows.length +
    absentRows.length +
    leaveRows.length;

  const dailySalary =
    workingDays > 0
      ? basicSalary / workingDays
      : 0;

  /*
   * Present-day salary is prorated using time worked inside
   * the employee's regular duty interval.
   */
let attendanceSalary = 0;

for (const attendance of presentRows) {
  const dutyMinutes = calculateMinutesDifference(
    attendance.duty_start_time,
    attendance.duty_end_time
  );

  if (dutyMinutes <= 0) continue;

  const paidRegularMinutes =
    calculatePaidRegularMinutes(attendance);

  const payableMinutes = Math.min(
    paidRegularMinutes,
    dutyMinutes
  );

  const perMinuteRate = dailySalary / dutyMinutes;

  attendanceSalary += payableMinutes * perMinuteRate;
}

// Approved leave receives full daily salary
const paidLeaveDays = leaveRows.length;

attendanceSalary += paidLeaveDays * dailySalary;

  /*
   * Set paidLeave=true if approved leave should receive
   * one complete day's salary.
   */
  if (paidLeave) {
    attendanceSalary +=
      leaveRows.length * dailySalary;
  }

  const attendanceByDate = new Map(
    attendanceRows.map((attendance) => [
      getDateKey(attendance.date),
      attendance,
    ])
  );

  /*
   * Get an average duty duration for overtime entries that
   * do not have a matching attendance row.
   */
  const validDutyMinutes = attendanceRows
    .map((attendance) =>
      calculateMinutesDifference(
        attendance.duty_start_time,
        attendance.duty_end_time
      )
    )
    .filter((minutes) => minutes > 0);

  const fallbackDutyMinutes =
    validDutyMinutes.length > 0
      ? validDutyMinutes.reduce(
          (total, minutes) => total + minutes,
          0
        ) / validDutyMinutes.length
      : 480;

  let totalOvertimeMinutes = 0;
  let overtimeSalary = 0;

  for (const overtime of overtimeRows) {
    const overtimeMinutes =
      Number(overtime.overtime_minutes || 0) ||
      calculateMinutesDifference(
        overtime.check_in_time,
        overtime.check_out_time
      );

    if (overtimeMinutes <= 0) continue;

    totalOvertimeMinutes += overtimeMinutes;

    const attendance = attendanceByDate.get(
      getDateKey(overtime.date)
    );

    const attendanceDutyMinutes = attendance
      ? calculateMinutesDifference(
          attendance.duty_start_time,
          attendance.duty_end_time
        )
      : 0;

    const dutyMinutes =
      attendanceDutyMinutes > 0
        ? attendanceDutyMinutes
        : fallbackDutyMinutes;

    const dutyHours = dutyMinutes / 60;

    const regularHourlyRate =
      dutyHours > 0
        ? dailySalary / dutyHours
        : 0;

    const overtimeHourlyRate =
      regularHourlyRate * overtimeMultiplier;

    overtimeSalary +=
      (overtimeMinutes / 60) *
      overtimeHourlyRate;
  }

  const totalAllowances =
    sumSalaryItems(allowances);

  const totalDeductions =
    sumSalaryItems(deductions);

  const totalLateMinutes = attendanceRows.reduce(
    (total, attendance) =>
      total +
      Number(attendance.late_minutes || 0),
    0
  );

  const totalEarlyLeaveMinutes =
    attendanceRows.reduce(
      (total, attendance) =>
        total +
        Number(
          attendance.early_leave_minutes || 0
        ),
    0
  );

  const netSalary = toMoney(
    attendanceSalary +
      overtimeSalary +
      totalAllowances -
      totalDeductions
  );

  return {
    basicSalary,

    workingDays,
    presentDays: presentRows.length,
    absentDays: absentRows.length,
    leaveDays: leaveRows.length,
    holidayDays: holidayRows.length,
    weekendDays: weekendRows.length,

    dailySalary: toMoney(dailySalary),

    attendanceDays: presentRows.length,
    attendanceSalary: toMoney(
      attendanceSalary
    ),

    totalLateMinutes,
    totalEarlyLeaveMinutes,

    overtimeMinutes: totalOvertimeMinutes,
    overtimeHours: toMoney(
      totalOvertimeMinutes / 60
    ),
    overtimeSalary: toMoney(
      overtimeSalary
    ),

    totalAllowances,
    totalDeductions,
    netSalary,
  };
};

export const buildSalaryCreateData = ({
  employee,
  startDate,
  endDate,
  totals,
  allowances = [],
  deductions = [],
  remarks,
  now,
}) => {
  return {
    employee_id: employee.id,

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

    remarks:
      remarks ||
      "Salary generated from attendance and overtime records",

    created_at: now,
    updated_at: now,

    ...(allowances.length > 0 && {
      salary_allowances: {
        create: allowances.map((allowance) => ({
          name: allowance.name,
          amount: getNumber(allowance.amount),
          created_at: now,
          updated_at: now,
        })),
      },
    }),

    ...(deductions.length > 0 && {
      salary_deductions: {
        create: deductions.map((deduction) => ({
          name: deduction.name,
          amount: getNumber(deduction.amount),
          created_at: now,
          updated_at: now,
        })),
      },
    }),
  };
};

export const formatSalaryResult = ({
  employee,
  salary,
  totals,
}) => {
  return {
    employee_id: employee.id.toString(),
    employee_name: employee.user?.name || null,
    salary_id: salary.id.toString(),

    basic_salary: totals.basicSalary,
    currency: employee.currency || null,

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
  };
};