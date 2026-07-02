import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  sanitizeString,
} from "../../utils/zodValidation.js";

const departmentIdSchema = z
  .any()
  .transform((value) => parsePositiveBigInt(value))
  .refine((value) => value !== undefined, {
    message: "A valid department id is required.",
  });

const createDepartmentSchema = z.object({
  name: z
    .any()
    .transform((value) => sanitizeString(value))
    .refine((value) => Boolean(value), {
      message: "name is required.",
    }),
  description: z.any().optional().transform((value) => {
    const description = sanitizeString(value);
    return description || undefined;
  }),
});

const updateDepartmentSchema = z
  .object({
    name: z.any().optional().transform((value) => {
      const name = sanitizeString(value);
      return name || undefined;
    }),
    description: z.any().optional().transform((value) => {
      const description = sanitizeString(value);
      return description || undefined;
    }),
  })
  .superRefine((data, ctx) => {
    if (!data.name && !data.description) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field is required to update the department.",
      });
    }
  });

export const validateCreateDepartment = (body) => {
  return parseWithSchema(createDepartmentSchema, body ?? {});
};

export const validateUpdateDepartment = (id, body) => {
  return {
    departmentId: parseWithSchema(departmentIdSchema, id),
    ...parseWithSchema(updateDepartmentSchema, body ?? {}),
  };
};

export const validateDepartmentId = (id) => {
  return parseWithSchema(departmentIdSchema, id);
};
