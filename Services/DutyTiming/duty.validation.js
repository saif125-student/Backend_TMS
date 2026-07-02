const sanitizeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const parseBigInt = (value) => {
  const candidate = sanitizeString(value);

  if (!/^[1-9][0-9]*$/.test(candidate)) return undefined;

  return BigInt(candidate);
};

const parseTime = (value, field) => {
  const time = sanitizeString(value);

  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)) {
    throw {
      status: 400,
      message: `${field} must use HH:mm or HH:mm:ss format.`,
    };
  }

  const normalized = time.length === 5 ? `${time}:00` : time;

  // Prisma represents MySQL TIME fields as JavaScript Date objects.
  return new Date(`1970-01-01T${normalized}.000Z`);
};

const parseDate = (value, field) => {
  const dateString = sanitizeString(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw {
      status: 400,
      message: `${field} must use YYYY-MM-DD format.`,
    };
  }

  const date = new Date(`${dateString}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateString
  ) {
    throw {
      status: 400,
      message: `${field} is invalid.`,
    };
  }

  return date;
};

const validateTimes = (startValue, endValue) => {
  const startTime = parseTime(startValue, "startTime");
  const endTime = parseTime(endValue, "endTime");

  if (startTime.getTime() === endTime.getTime()) {
    throw {
      status: 400,
      message: "startTime and endTime cannot be the same.",
    };
  }

  // endTime earlier than startTime is allowed for overnight shifts.
  return { startTime, endTime };
};

export const validateCreateDepartmentDuty = (body = {}) => {
  const departmentId = parseBigInt(
    body.departmentId ?? body.department_id
  );

  if (!departmentId) {
    throw {
      status: 400,
      message: "A valid departmentId is required.",
    };
  }

  const { startTime, endTime } = validateTimes(
    body.startTime ?? body.start_time,
    body.endTime ?? body.end_time
  );

  return {
    departmentId,
    startTime,
    endTime,
  };
};

export const validateUpdateDepartmentDuty = (id, body = {}) => {
  const dutyTimingId = parseBigInt(id);

  if (!dutyTimingId) {
    throw {
      status: 400,
      message: "A valid duty timing id is required.",
    };
  }

  const hasDepartmentId =
    body.departmentId !== undefined ||
    body.department_id !== undefined;

  const hasStartTime =
    body.startTime !== undefined ||
    body.start_time !== undefined;

  const hasEndTime =
    body.endTime !== undefined ||
    body.end_time !== undefined;

  if (!hasDepartmentId && !hasStartTime && !hasEndTime) {
    throw {
      status: 400,
      message: "At least one field is required.",
    };
  }

  const departmentId = hasDepartmentId
    ? parseBigInt(body.departmentId ?? body.department_id)
    : undefined;

  if (hasDepartmentId && !departmentId) {
    throw {
      status: 400,
      message: "A valid departmentId is required.",
    };
  }

  return {
    dutyTimingId,
    departmentId,
    startTime: hasStartTime
      ? parseTime(body.startTime ?? body.start_time, "startTime")
      : undefined,
    endTime: hasEndTime
      ? parseTime(body.endTime ?? body.end_time, "endTime")
      : undefined,
  };
};

export const validateCreateEmployeeDuty = (body = {}) => {
  const employeeId = parseBigInt(
    body.employeeId ?? body.employee_id
  );

  if (!employeeId) {
    throw {
      status: 400,
      message: "A valid employeeId is required.",
    };
  }

  const { startTime, endTime } = validateTimes(
    body.startTime ?? body.start_time,
    body.endTime ?? body.end_time
  );

  const validFrom = parseDate(
    body.validFrom ?? body.valid_from,
    "validFrom"
  );

  const validTill = parseDate(
    body.validTill ?? body.valid_till,
    "validTill"
  );

  if (validTill < validFrom) {
    throw {
      status: 400,
      message: "validTill must be equal to or after validFrom.",
    };
  }

  return {
    employeeId,
    startTime,
    endTime,
    validFrom,
    validTill,
  };
};

export const validateUpdateEmployeeDuty = (id, body = {}) => {
  const dutyTimingId = parseBigInt(id);

  if (!dutyTimingId) {
    throw {
      status: 400,
      message: "A valid duty timing id is required.",
    };
  }

  const allowedFields = [
    "employeeId",
    "employee_id",
    "startTime",
    "start_time",
    "endTime",
    "end_time",
    "validFrom",
    "valid_from",
    "validTill",
    "valid_till",
  ];

  if (!allowedFields.some((field) => body[field] !== undefined)) {
    throw {
      status: 400,
      message: "At least one field is required.",
    };
  }

  const hasEmployeeId =
    body.employeeId !== undefined ||
    body.employee_id !== undefined;

  const employeeId = hasEmployeeId
    ? parseBigInt(body.employeeId ?? body.employee_id)
    : undefined;

  if (hasEmployeeId && !employeeId) {
    throw {
      status: 400,
      message: "A valid employeeId is required.",
    };
  }

  return {
    dutyTimingId,
    employeeId,

    startTime:
      body.startTime !== undefined || body.start_time !== undefined
        ? parseTime(
            body.startTime ?? body.start_time,
            "startTime"
          )
        : undefined,

    endTime:
      body.endTime !== undefined || body.end_time !== undefined
        ? parseTime(
            body.endTime ?? body.end_time,
            "endTime"
          )
        : undefined,

    validFrom:
      body.validFrom !== undefined || body.valid_from !== undefined
        ? parseDate(
            body.validFrom ?? body.valid_from,
            "validFrom"
          )
        : undefined,

    validTill:
      body.validTill !== undefined || body.valid_till !== undefined
        ? parseDate(
            body.validTill ?? body.valid_till,
            "validTill"
          )
        : undefined,
  };
};

export const validateDutyTimingId = (id) => {
  const dutyTimingId = parseBigInt(id);

  if (!dutyTimingId) {
    throw {
      status: 400,
      message: "A valid duty timing id is required.",
    };
  }

  return dutyTimingId;
};

export const validateDepartmentId = (id) => {
  const departmentId = parseBigInt(id);

  if (!departmentId) {
    throw {
      status: 400,
      message: "A valid department id is required.",
    };
  }

  return departmentId;
};

export const validateEmployeeId = (id) => {
  const employeeId = parseBigInt(id);

  if (!employeeId) {
    throw {
      status: 400,
      message: "A valid employee id is required.",
    };
  }

  return employeeId;
};