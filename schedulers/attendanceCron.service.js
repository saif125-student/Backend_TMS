import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Karachi";

// Sunday = 0, Saturday = 6
const WEEKEND_DAYS = (process.env.WEEKEND_DAYS || "0,6")
  .split(",")
  .map(Number);

const toDateOnly = (date) => {
  return new Date(`${date}T00:00:00.000Z`);
};

export const getYesterdayDateOnly = () => {
  const date = dayjs()
    .tz(APP_TIMEZONE)
    .subtract(1, "day")
    .format("YYYY-MM-DD");

  return toDateOnly(date);
};

const getDateKey = (date) => {
  return date.toISOString().slice(0, 10);
};

const isWeekend = (date) => {
  return WEEKEND_DAYS.includes(date.getUTCDay());
};

const findApprovedLeave = async (tx, employeeId, date) => {
  return tx.leaves.findFirst({
    where: {
      employee_id: employeeId,
      status: "approved",
      start_date: {
        lte: date,
      },
      end_date: {
        gte: date,
      },
    },
  });
};

const findHoliday = async (tx, date) => {
  return tx.holidays.findFirst({
    where: {
      start_date: {
        lte: date,
      },
      end_date: {
        gte: date,
      },
    },
  });
};

const findDutyTiming = async (tx, employeeId, date) => {
  const employeeDutyTiming = await tx.employee_duty_timings.findFirst({
    where: {
      employee_id: employeeId,
      AND: [
        {
          OR: [
            { valid_from: null },
            { valid_from: { lte: date } },
          ],
        },
        {
          OR: [
            { valid_till: null },
            { valid_till: { gte: date } },
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

  const departmentEmployee = await tx.department_employee.findFirst({
    where: {
      employeeId,
    },
  });

  if (!departmentEmployee) return null;

  return tx.duty_timings.findFirst({
    where: {
      department_id: departmentEmployee.departmentId,
    },
    orderBy: {
      id: "desc",
    },
  });
};

const buildAutoAttendanceData = ({
  employeeId,
  date,
  status,
  remarks,
  dutyTiming,
  now,
}) => {
  return {
    employee_id: employeeId,
    date,

    check_in_time: null,
    check_out_time: null,

    duty_start_time: dutyTiming?.start_time || null,
    duty_end_time: dutyTiming?.end_time || null,

    worked_minutes: 0,
    late_minutes: 0,
    early_leave_minutes: 0,
    daily_pay: 0,

    status,
    remarks,

    created_at: now,
    updated_at: now,
  };
};

export const generateMissingAttendanceForDate = async ({ tx, date }) => {
  const employees = await tx.employees.findMany();

  const existingAttendances = await tx.attendances.findMany({
    where: {
      date,
    },
    select: {
      employee_id: true,
      date: true,
    },
  });

  const existingMap = new Set(
    existingAttendances.map((attendance) => {
      return `${attendance.employee_id.toString()}_${getDateKey(attendance.date)}`;
    })
  );

  const now = new Date();

  const created = [];
  const skipped = [];

  for (const employee of employees) {
    const key = `${employee.id.toString()}_${getDateKey(date)}`;

    if (existingMap.has(key)) {
      skipped.push({
        employee_id: employee.id.toString(),
        date: getDateKey(date),
        reason: "Attendance already exists",
      });

      continue;
    }

    let status = "Absent";
    let remarks = "Auto generated absent";

    const leave = await findApprovedLeave(tx, employee.id, date);

    if (leave) {
      status = "On_Leave";
      remarks = "Auto generated approved leave";
    } else {
      const holiday = await findHoliday(tx, date);

      if (holiday) {
        status = "Holiday";
        remarks = "Auto generated holiday";
      } else if (isWeekend(date)) {
        status = "Weekend";
        remarks = "Auto generated weekend";
      }
    }

    const dutyTiming = await findDutyTiming(tx, employee.id, date);

    const attendance = await tx.attendances.create({
      data: buildAutoAttendanceData({
        employeeId: employee.id,
        date,
        status,
        remarks,
        dutyTiming,
        now,
      }),
    });

    created.push({
      employee_id: employee.id.toString(),
      date: getDateKey(date),
      status,
      attendance_id: attendance.id.toString(),
    });

    existingMap.add(key);
  }

  return {
    date: getDateKey(date),
    created_count: created.length,
    skipped_count: skipped.length,
    created,
    skipped,
  };
};