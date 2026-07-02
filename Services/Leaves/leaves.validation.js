import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  sanitizeNullableString,
  sanitizeString,
} from "../../utils/zodValidation.js";

const positiveBigIntSchema = (field) =>
  z
    .any()
    .transform((value) => parsePositiveBigInt(value))
    .refine((value) => value !== undefined, {
      message: `A valid ${field} is required.`,
    });

const dateSchema = (field) =>
  z
    .any()
    .transform((value) => sanitizeString(value))
    .refine((value) => Boolean(value), {
      message: `${field} is required.`,
    })
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: `${field} must be in YYYY-MM-DD format.`,
    });

/* ======================================================
   ✅ CREATE LEAVE VALIDATION
====================================================== */
const createLeaveSchema = z.object({
  employee_id: z
    .any()
    .optional()
    .transform((value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }

      const parsed = parsePositiveBigInt(value);

      if (parsed === undefined) {
        throw new Error("A valid employee id is required.");
      }

      return parsed;
    }),

  leave_policy_id: positiveBigIntSchema("leave policy id"),

  start_date: dateSchema("Start date"),
  end_date: dateSchema("End date"),

  description: z
    .any()
    .optional()
    .transform((value) => sanitizeNullableString(value)),
});
/* ======================================================
   ✅ UPDATE LEAVE VALIDATION (ADDED HERE)
====================================================== */

const optionalBigIntSchema = (field) =>
  z.any().optional().transform((value) => {
    if (value === undefined || value === null || value === "") return undefined;

    const parsed = parsePositiveBigInt(value);

    if (parsed === undefined) {
      throw new Error(`A valid ${field} is required.`);
    }

    return parsed;
  });

const optionalDateSchema = (field) =>
  z.any().optional().transform((value) => {
    if (value === undefined || value === null || value === "") return undefined;

    const cleaned = sanitizeString(value);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      throw new Error(`${field} must be in YYYY-MM-DD format.`);
    }

    return cleaned;
  });

const updateLeaveSchema = z.object({
  leave_policy_id: optionalBigIntSchema("leave policy id"),

  start_date: optionalDateSchema("Start date"),
  end_date: optionalDateSchema("End date"),

  description: z
    .any()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return sanitizeNullableString(value);
    }),
});

/* ======================================================
   ✅ EXPORT VALIDATORS
====================================================== */

export const validateCreateLeave = (body) => {
  return parseWithSchema(createLeaveSchema, body ?? {});
};

export const validateUpdateLeave = (body) => {
  return parseWithSchema(updateLeaveSchema, body ?? {});
};

export const validateLeaveId = (id) => {
  return parseWithSchema(
    z.any().transform((v) => parsePositiveBigInt(v)),
    id
  );
};