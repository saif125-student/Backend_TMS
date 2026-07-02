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

const optionalDateSchema = (field) =>
  z.any().optional().transform((value) => {
    if (value === undefined || value === null || value === "") return undefined;

    const cleaned = sanitizeString(value);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      throw new Error(`${field} must be in YYYY-MM-DD format.`);
    }

    return cleaned;
  });

const requiredString = (field) =>
  z
    .any()
    .transform((value) => sanitizeString(value))
    .refine((value) => Boolean(value), {
      message: `${field} is required.`,
    });

const createResignationSchema = z.object({
  employee_id: positiveBigIntSchema("employee id"),
  resignation_date: dateSchema("Resignation date"),
  last_working_day: dateSchema("Last working day"),
  resignation_reason: requiredString("Resignation reason"),
  resignation_status: z
    .any()
    .optional()
    .transform((value) => sanitizeNullableString(value)),
  notes: z.any().optional().transform((value) => sanitizeNullableString(value)),
});

const updateResignationSchema = z.object({
  employee_id: z.any().optional().transform((value) => {
    if (value === undefined || value === null || value === "") return undefined;

    const parsed = parsePositiveBigInt(value);

    if (parsed === undefined) {
      throw new Error("A valid employee id is required.");
    }

    return parsed;
  }),

  resignation_date: optionalDateSchema("Resignation date"),
  last_working_day: optionalDateSchema("Last working day"),

  resignation_reason: z.any().optional().transform((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return sanitizeString(value);
  }),

  resignation_status: z.any().optional().transform((value) => {
    if (value === undefined) return undefined;
    return sanitizeNullableString(value);
  }),

  notes: z.any().optional().transform((value) => {
    if (value === undefined) return undefined;
    return sanitizeNullableString(value);
  }),
});

const resignationIdSchema = positiveBigIntSchema("resignation id");
const employeeIdSchema = positiveBigIntSchema("employee id");

export const validateCreateResignation = (body) => {
  return parseWithSchema(createResignationSchema, body ?? {});
};

export const validateUpdateResignation = (body) => {
  return parseWithSchema(updateResignationSchema, body ?? {});
};

export const validateResignationId = (id) => {
  return parseWithSchema(resignationIdSchema, id);
};

export const validateEmployeeId = (id) => {
  return parseWithSchema(employeeIdSchema, id);
};