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

const createTerminationSchema = z.object({
  employee_id: positiveBigIntSchema("employee id"),
  termination_date: dateSchema("Termination date"),
  termination_reason: requiredString("Termination reason"),
  notes: z.any().optional().transform((value) => sanitizeNullableString(value)),
});

const updateTerminationSchema = z.object({
  employee_id: z.any().optional().transform((value) => {
    if (value === undefined || value === null || value === "") return undefined;

    const parsed = parsePositiveBigInt(value);

    if (parsed === undefined) {
      throw new Error("A valid employee id is required.");
    }

    return parsed;
  }),

  termination_date: optionalDateSchema("Termination date"),

  termination_reason: z.any().optional().transform((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return sanitizeString(value);
  }),

  notes: z.any().optional().transform((value) => {
    if (value === undefined) return undefined;
    return sanitizeNullableString(value);
  }),
});

const terminationIdSchema = positiveBigIntSchema("termination id");
const employeeIdSchema = positiveBigIntSchema("employee id");

export const validateCreateTermination = (body) => {
  return parseWithSchema(createTerminationSchema, body ?? {});
};

export const validateUpdateTermination = (body) => {
  return parseWithSchema(updateTerminationSchema, body ?? {});
};

export const validateTerminationId = (id) => {
  return parseWithSchema(terminationIdSchema, id);
};

export const validateEmployeeId = (id) => {
  return parseWithSchema(employeeIdSchema, id);
};