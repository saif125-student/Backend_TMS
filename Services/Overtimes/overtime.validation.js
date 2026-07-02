import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  sanitizeNullableString,
  sanitizeString,
} from "../../utils/zodValidation.js";

// ─── Reusable field schemas ───────────────────────────────────────────────────

const positiveBigIntSchema = (field) =>
  z
    .any()
    .transform((value) => parsePositiveBigInt(value))
    .refine((value) => value !== undefined, {
      message: `A valid ${field} is required.`,
    });

const optionalBigIntSchema = z.any().optional().transform((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = parsePositiveBigInt(value);
  if (parsed === undefined) throw new Error("A valid employee id is required.");
  return parsed;
});

const dateSchema = z
  .any()
  .transform((value) => sanitizeString(value))
  .refine((value) => Boolean(value), { message: "Date is required." })
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Date must be in YYYY-MM-DD format.",
  });

const optionalDateSchema = z.any().optional().transform((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const cleaned = sanitizeString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned))
    throw new Error("Date must be in YYYY-MM-DD format.");
  return cleaned;
});

const requiredTimeSchema = (field) =>
  z
    .any()
    .transform((value) => {
      if (value === undefined || value === null || value === "")
        throw new Error(`${field} is required.`);
      const cleaned = sanitizeString(value);
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(cleaned))
        throw new Error(`${field} must be in HH:mm format.`);
      return cleaned;
    });

const optionalTimeSchema = (field) =>
  z.any().optional().transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const cleaned = sanitizeString(value);
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(cleaned))
      throw new Error(`${field} must be in HH:mm format.`);
    return cleaned;
  });

const remarksSchema = z
  .any()
  .optional()
  .transform((value) => sanitizeNullableString(value));

// ─── Exported ID schemas ──────────────────────────────────────────────────────

export const overtimeIdSchema    = positiveBigIntSchema("overtime id");
export const employeeIdSchema    = positiveBigIntSchema("employee id");

// ─── Employee Self-Service Schemas ────────────────────────────────────────────

/**
 * Employee overtime check-in — only optional remarks allowed.
 * employee_id, date, and check_in_time are derived server-side.
 */
const employeeCheckinSchema = z.object({
  remarks: remarksSchema,
});

/**
 * Employee overtime checkout — only optional remarks allowed.
 */
const employeeCheckoutSchema = z.object({
  remarks: remarksSchema,
});

// ─── Admin Schemas ────────────────────────────────────────────────────────────

/**
 * Admin manual overtime creation.
 * Requires employee_id, date, check_in_time, check_out_time.
 */
const adminCreateOvertimeSchema = z.object({
  employee_id:    positiveBigIntSchema("employee id"),
  date:           dateSchema,
  check_in_time:  requiredTimeSchema("check_in_time"),
  check_out_time: requiredTimeSchema("check_out_time"),
  remarks:        remarksSchema,
});

/**
 * Admin update overtime — all fields optional.
 */
const adminUpdateOvertimeSchema = z.object({
  employee_id:    optionalBigIntSchema,
  date:           optionalDateSchema,
  check_in_time:  optionalTimeSchema("check_in_time"),
  check_out_time: optionalTimeSchema("check_out_time"),
  remarks:        z.any().optional().transform((value) => {
    if (value === undefined) return undefined;
    return sanitizeNullableString(value);
  }),
});

// ─── Month Param Schema ───────────────────────────────────────────────────────

/**
 * Validates route param :month — must be "YYYY-MM" format.
 */
const monthParamSchema = z
  .any()
  .transform((value) => sanitizeString(value))
  .refine((value) => /^\d{4}-\d{2}$/.test(value), {
    message: "Month must be in YYYY-MM format.",
  });

// ─── Exported Validators ──────────────────────────────────────────────────────

export const validateEmployeeCheckin    = (body) =>
  parseWithSchema(employeeCheckinSchema, body ?? {});

export const validateEmployeeCheckout   = (body) =>
  parseWithSchema(employeeCheckoutSchema, body ?? {});

export const validateAdminCreateOvertime = (body) =>
  parseWithSchema(adminCreateOvertimeSchema, body ?? {});

export const validateAdminUpdateOvertime = (body) =>
  parseWithSchema(adminUpdateOvertimeSchema, body ?? {});

export const validateOvertimeId = (id) =>
  parseWithSchema(overtimeIdSchema, id);

export const validateEmployeeId = (id) =>
  parseWithSchema(employeeIdSchema, id);

export const validateMonthParam = (month) =>
  parseWithSchema(monthParamSchema, month);