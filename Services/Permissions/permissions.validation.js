import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  sanitizeString,
} from "../../utils/zodValidation.js";

const permissionIdSchema = z
  .any()
  .transform((value) => parsePositiveBigInt(value))
  .refine((value) => value !== undefined, {
    message: "A valid permission id is required.",
  });

export const validateCreatePermission = (body) => {
  const schema = z.object({
    name: z.any().transform((value) => sanitizeString(value)),
    guardName: z.any().transform((value) => sanitizeString(value)),
    groupName: z.any().optional().transform((value) => sanitizeString(value) || undefined),
  }).superRefine((data, ctx) => {
    if (!data.name || !data.guardName) {
      ctx.addIssue({
        code: "custom",
        message: "name and guardName are required.",
      });
    }
  });

  return parseWithSchema(schema, body ?? {});
};

export const validateUpdatePermission = (id, body) => {
  const schema = z
    .object({
      name: z.any().optional().transform((value) => sanitizeString(value) || undefined),
      guardName: z.any().optional().transform((value) => sanitizeString(value) || undefined),
      groupName: z.any().optional().transform((value) => sanitizeString(value) || undefined),
    })
    .superRefine((data, ctx) => {
      if (!data.name && !data.guardName && !data.groupName) {
        ctx.addIssue({
          code: "custom",
          message: "At least one field is required to update the permission.",
        });
      }
    });

  return {
    permissionId: parseWithSchema(permissionIdSchema, id),
    ...parseWithSchema(schema, body ?? {}),
  };
};
