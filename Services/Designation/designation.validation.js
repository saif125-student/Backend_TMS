import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  sanitizeString,
} from "../../utils/zodValidation.js";

const designationIdSchema = z
  .any()
  .transform((value) => parsePositiveBigInt(value))
  .refine((value) => value !== undefined, {
    message: "A valid designation id is required.",
  });

const requiredDepartmentIdSchema = z
  .any()
  .transform((value) => parsePositiveBigInt(value))
  .refine((value) => value !== undefined, {
    message: "A valid departmentId is required.",
  });

const createDesignationSchema = z.object({
  name: z
    .any()
    .transform((value) => sanitizeString(value))
    .refine((value) => Boolean(value), {
      message: "name is required.",
    }),
  departmentId: requiredDepartmentIdSchema,
  description: z.any().optional().transform((value) => sanitizeString(value) || undefined),
});

const updateDesignationSchema = z
  .object({
    name: z.any().optional().transform((value) => sanitizeString(value) || undefined),
    departmentId: z.any().optional().transform((value) => {
      if (value === undefined || value === null || value === "") return undefined;
      return parsePositiveBigInt(value);
    }),
    description: z.any().optional().transform((value) => sanitizeString(value) || undefined),
  })
  .superRefine((data, ctx) => {
    if (data.departmentId === undefined && data.name === undefined && data.description === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field is required to update the designation.",
      });
      return;
    }

    if (Object.prototype.hasOwnProperty.call(data, "departmentId") && data.departmentId === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "A valid departmentId is required.",
      });
    }
  });

export const validateCreateDesignation = (body) => {
  return parseWithSchema(createDesignationSchema, body ?? {});
};

export const validateUpdateDesignation = (id, body) => {
  return {
    designationId: parseWithSchema(designationIdSchema, id),
    ...parseWithSchema(updateDesignationSchema, body ?? {}),
  };
};

export const validateDesignationId = (id) => {
  return parseWithSchema(designationIdSchema, id);
};
