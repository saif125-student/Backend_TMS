import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  sanitizeNullableString,
  sanitizeString,
} from "../../utils/zodValidation.js";

const employeeIdSchema = z
  .any()
  .transform((value) => parsePositiveBigInt(value))
  .refine((value) => value !== undefined, {
    message: "A valid employee id is required.",
  });

const salaryIdSchema = z
  .any()
  .transform((value) => parsePositiveBigInt(value))
  .refine((value) => value !== undefined, {
    message: "A valid salary id is required.",
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
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const cleaned = sanitizeString(value);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      throw new Error(`${field} must be in YYYY-MM-DD format.`);
    }

    return cleaned;
  });

const numberSchema = (field) =>
  z
    .any()
    .transform((value) => {
      const number = Number(value);
      return Number.isFinite(number) && number >= 0 ? number : undefined;
    })
    .refine((value) => value !== undefined, {
      message: `${field} must be a valid number.`,
    });

const optionalNumberSchema = (field) =>
  z.any().optional().transform((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
      throw new Error(`${field} must be a valid number.`);
    }

    return number;
  });

const salaryItemSchema = z.object({
  name: z
    .any()
    .transform((value) => sanitizeString(value))
    .refine((value) => Boolean(value), {
      message: "Name is required.",
    }),

  amount: numberSchema("Amount"),
});

const salarySchema = z.object({
  employee_id: employeeIdSchema,

  start_date: dateSchema("Start date"),
  end_date: dateSchema("End date"),

  allowances: z.array(salaryItemSchema).optional().default([]),
  deductions: z.array(salaryItemSchema).optional().default([]),

  remarks: z
    .any()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return sanitizeNullableString(value);
    }),
});

const updateSalarySchema = z.object({
  start_date: dateSchema("Start date").optional(),
  end_date: dateSchema("End date").optional(),

  allowances: z.array(salaryItemSchema).optional(),
  deductions: z.array(salaryItemSchema).optional(),

  remarks: z
    .any()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return sanitizeNullableString(value);
    }),
});

const bulkGenerateSalarySchema = z.object({
  start_date: dateSchema("Start date"),
  end_date: dateSchema("End date"),

  remarks: z
    .any()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return sanitizeNullableString(value);
    }),
});

export const validateBulkGenerateSalary = (body) => {
  return parseWithSchema(
    bulkGenerateSalarySchema,
    body ?? {}
  );
};

export const validateComputeSalary = (body) => {
  return parseWithSchema(salarySchema, body ?? {});
};

export const validateCreateSalary = (body) => {
  return parseWithSchema(salarySchema, body ?? {});
};

export const validateSalaryEmployeeId = (id) => {
  return parseWithSchema(employeeIdSchema, id);
};

export const validateUpdateSalary = (body) => {
  return parseWithSchema(updateSalarySchema, body ?? {});
};

export const validateSalaryId = (id) => {
  return parseWithSchema(salaryIdSchema, id);
};

const expectedSalarySchema = z.object({
  start_date: dateSchema("Start date"),
  end_date: dateSchema("End date"),
});

export const validateExpectedSalary = (body) => {
  return parseWithSchema(expectedSalarySchema, body ?? {});
};