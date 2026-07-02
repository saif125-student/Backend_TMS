import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  sanitizeNullableString,
  sanitizeString,
} from "../../utils/zodValidation.js";

const attendanceStatuses = [
  "Present",
  "Absent",
  "On_Leave",
  "Holiday",
  "Weekend",
];

const positiveBigIntSchema = (field) =>
  z
    .any()
    .transform((value) => parsePositiveBigInt(value))
    .refine((value) => value !== undefined, {
      message: `A valid ${field} is required.`,
    });

const attendanceIdSchema = positiveBigIntSchema("attendance id");
const employeeIdSchema = positiveBigIntSchema("employee id");

const dateSchema = z
  .any()
  .transform((value) => sanitizeString(value))
  .refine((value) => Boolean(value), {
    message: "Date is required.",
  })
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Date must be in YYYY-MM-DD format.",
  });

const optionalDateSchema = z.any().optional().transform((value) => {
  if (value === undefined || value === null || value === "") return undefined;

  const cleaned = sanitizeString(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    throw new Error("Date must be in YYYY-MM-DD format.");
  }

  return cleaned;
});

const timeSchema = (field) =>
  z.any().optional().transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;

    const cleaned = sanitizeString(value);

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(cleaned)) {
      throw new Error(`${field} must be in HH:mm format.`);
    }

    return cleaned;
  });

const statusSchema = z
  .any()
  .transform((value) => sanitizeString(value))
  .refine((value) => attendanceStatuses.includes(value), {
    message: "Invalid attendance status.",
  });

const optionalStatusSchema = z.any().optional().transform((value) => {
  if (value === undefined || value === null || value === "") return undefined;

  const cleaned = sanitizeString(value);

  if (!attendanceStatuses.includes(cleaned)) {
    throw new Error("Invalid attendance status.");
  }

  return cleaned;
});

const markAttendanceSchema = z.object({
  employee_id: employeeIdSchema,
  date: dateSchema,
  status: statusSchema,
  check_in_time: timeSchema("check_in_time"),
  check_out_time: timeSchema("check_out_time"),
  remarks: z.any().optional().transform((value) => sanitizeNullableString(value)),
});

const updateAttendanceSchema = z.object({
  employee_id: z.any().optional().transform((value) => {
    if (value === undefined || value === null || value === "") return undefined;

    const parsed = parsePositiveBigInt(value);

    if (parsed === undefined) {
      throw new Error("A valid employee id is required.");
    }

    return parsed;
  }),

  date: optionalDateSchema,
  status: optionalStatusSchema,
  check_in_time: timeSchema("check_in_time"),
  check_out_time: timeSchema("check_out_time"),
  remarks: z.any().optional().transform((value) => {
    if (value === undefined) return undefined;
    return sanitizeNullableString(value);
  }),
});


const dateSchemaf = (field) =>
  z
    .any()
    .transform((value) => sanitizeString(value))
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: `${field} must be YYYY-MM-DD`,
    });

const schema = z.object({
  employee_id: employeeIdSchema,
  start_date: dateSchemaf("start_date"),
  end_date: dateSchemaf("end_date"),
});

const checkInAttendanceSchema = z.object({
  remarks: z.any().optional().transform((value) => {
    if (value === undefined) return undefined;
    return sanitizeNullableString(value);
  }),
});

const checkOutAttendanceSchema = z.object({
  remarks: z.any().optional().transform((value) => {
    if (value === undefined) return undefined;
    return sanitizeNullableString(value);
  }),
});


export const validateSalaryReport = (body) =>{
  return parseWithSchema(schema, body ?? {});
};

export const validateMarkAttendance = (body) => {
  return parseWithSchema(markAttendanceSchema, body ?? {});
};

export const validateUpdateAttendance = (body) => {
  return parseWithSchema(updateAttendanceSchema, body ?? {});
};

export const validateAttendanceId = (id) => {
  return parseWithSchema(attendanceIdSchema, id);
};

export const validateEmployeeId = (id) => {
  return parseWithSchema(employeeIdSchema, id);
};

export const validateCheckInAttendance = (body) => {
  return parseWithSchema(checkInAttendanceSchema, body ?? {});
};

export const validateCheckOutAttendance = (body) => {
  return parseWithSchema(checkOutAttendanceSchema, body ?? {});
};

