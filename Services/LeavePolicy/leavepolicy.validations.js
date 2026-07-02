import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  sanitizeString,
} from "../../utils/zodValidation.js";

const leavePolicyIdSchema = z
  .any()
  .transform((value) => parsePositiveBigInt(value))
  .refine((value) => value !== undefined, {
    message: "A valid leave policy id is required.",
  });

const parseAnnualDays = (value) => {
  if (value === undefined || value === null || value === "") return undefined;

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return undefined;
  }

  return numberValue;
};

const parseBooleanValue = (value) => {
  if (value === true || value === false) return value;

  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;

  return undefined;
};

export const validateLeavePolicyId = (id) => {
  return parseWithSchema(leavePolicyIdSchema, id);
};

export const validateCreateLeavePolicy = (body) => {
  const schema = z
    .object({
      leave_type: z.any().transform((value) => sanitizeString(value)),
      annual_days: z.any().transform((value) => parseAnnualDays(value)),
      is_active: z.any().transform((value) => parseBooleanValue(value)),
    })
    .superRefine((data, ctx) => {
      if (!data.leave_type) {
        ctx.addIssue({
          code: "custom",
          message: "leave_type is required.",
        });
      }

      if (data.annual_days === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "annual_days must be a valid non-negative integer.",
        });
      }

      if (data.is_active === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "is_active must be true or false.",
        });
      }
    });

  return parseWithSchema(schema, body ?? {});
};

export const validateUpdateLeavePolicy = (id, body) => {
  const schema = z
    .object({
      leave_type: z
        .any()
        .optional()
        .transform((value) => sanitizeString(value) || undefined),

      annual_days: z
        .any()
        .optional()
        .transform((value) => {
          if (value === undefined) return undefined;
          return parseAnnualDays(value);
        }),

      is_active: z
        .any()
        .optional()
        .transform((value) => {
          if (value === undefined) return undefined;
          return parseBooleanValue(value);
        }),
    })
    .superRefine((data, ctx) => {
      if (
        !data.leave_type &&
        data.annual_days === undefined &&
        data.is_active === undefined
      ) {
        ctx.addIssue({
          code: "custom",
          message: "At least one field is required to update the leave policy.",
        });
      }
    });

  return {
    leavePolicyId: parseWithSchema(leavePolicyIdSchema, id),
    ...parseWithSchema(schema, body ?? {}),
  };
};