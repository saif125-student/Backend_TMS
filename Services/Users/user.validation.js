import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  sanitizeString,
} from "../../utils/zodValidation.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const requiredString = (field) =>
  z
    .any()
    .transform((value) => sanitizeString(value))
    .refine((value) => Boolean(value), {
      message: `${field} is required.`,
    });

const emailSchema = z
  .any()
  .transform((value) => sanitizeString(value))
  .refine((value) => emailPattern.test(value), {
    message: "A valid email is required.",
  });

const userIdSchema = z
  .any()
  .transform((value) => parsePositiveBigInt(value))
  .refine((value) => value !== undefined, {
    message: "A valid user id is required.",
  });

const registerSchema = z.object({
  name: requiredString("name"),
  email: emailSchema,
  password: requiredString("password"),
  roleId: z
    .any()
    .transform((value) => parsePositiveBigInt(value))
    .refine((value) => value !== undefined, {
      message: "A valid roleId is required.",
    }),
});

const loginSchema = z.object({
  email: emailSchema,
  password: requiredString("password"),
});

const refreshTokenSchema = z.object({
  refreshToken: requiredString("refreshToken"),
});

const updateUserSchema = z
  .object({
    name: z.any().optional().transform((value) => sanitizeString(value) || undefined),
    email: z.any().optional().transform((value) => sanitizeString(value) || undefined),
    password: z.any().optional().transform((value) => sanitizeString(value) || undefined),
    roleId: z.any().optional(),
  })
  .transform((data) => ({
    ...data,
    roleId:
      data.roleId === undefined || data.roleId === null || data.roleId === ""
        ? undefined
        : parsePositiveBigInt(data.roleId),
  }))
  .superRefine((data, ctx) => {
    if (!data.name && !data.email && !data.password && !data.roleId) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field is required to update the user.",
      });
    }

    if (data.email && !emailPattern.test(data.email)) {
      ctx.addIssue({
        code: "custom",
        message: "email must be valid.",
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(data, "roleId") &&
      data.roleId === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "roleId must be a positive integer.",
      });
    }
  });

export const validateRegisterUser = (body) => {
  return parseWithSchema(registerSchema, body ?? {});
};

export const validateLoginUser = (body) => {
  return parseWithSchema(loginSchema, body ?? {});
};

export const validateRefreshToken = (body) => {
  return parseWithSchema(refreshTokenSchema, body ?? {});
};

export const validateUpdateUser = (body) => {
  return parseWithSchema(updateUserSchema, body ?? {});
};

export const validateUserId = (id) => {
  return parseWithSchema(userIdSchema, id);
};
