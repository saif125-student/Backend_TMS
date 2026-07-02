import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  sanitizeString,
} from "../../utils/zodValidation.js";

const roleIdSchema = z
  .any()
  .transform((value) => parsePositiveBigInt(value))
  .refine((value) => value !== undefined, {
    message: "A valid role id is required.",
  });

const createRoleSchema = z.object({
  name: z
    .any()
    .transform((value) => sanitizeString(value))
    .refine((value) => Boolean(value), { message: "name is required." }),
  guardName: z
    .any()
    .transform((value) => sanitizeString(value))
    .refine((value) => Boolean(value), { message: "guardName is required." }),
});

const updateRoleSchema = z
  .object({
    name: z.any().optional().transform((value) => sanitizeString(value) || undefined),
    guardName: z.any().optional().transform((value) => sanitizeString(value) || undefined),
  })
  .superRefine((data, ctx) => {
    if (!data.name && !data.guardName) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field is required to update the role.",
      });
    }
  });

const assignPermissionSchema = z.object({
  roleId: z
    .any()
    .transform((value) => parsePositiveBigInt(value))
    .refine((value) => value !== undefined, {
      message: "A valid roleId is required.",
    }),
  permissionIds: z
    .array(
      z
        .any()
        .transform((value) => parsePositiveBigInt(value))
        .refine((value) => value !== undefined, {
          message: "permission id must be a positive integer.",
        })
    )
    .nonempty({ message: "permissionIds must be a non-empty array." }),
});

export const validateCreateRole = (body) => {
  return parseWithSchema(createRoleSchema, body ?? {});
};

export const validateUpdateRole = (id, body) => {
  return {
    roleId: parseWithSchema(roleIdSchema, id),
    ...parseWithSchema(updateRoleSchema, body ?? {}),
  };
};

export const validateAssignPermissions = (body) => {
  return parseWithSchema(assignPermissionSchema, body ?? {});
};

export const validateRoleId = (id) => {
  return parseWithSchema(roleIdSchema, id);
};
