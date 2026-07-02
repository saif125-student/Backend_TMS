import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  sanitizeString,
} from "../../utils/zodValidation.js";

const emailSchema = z
  .any()
  .transform((value) => sanitizeString(value))
  .refine((value) => /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value), {
    message: "A valid email is required.",
  });

const requiredString = (field) =>
  z
    .any()
    .transform((value) => sanitizeString(value))
    .refine((value) => Boolean(value), {
      message: `${field} is required.`,
    });

const adminIdSchema = z
  .any()
  .transform((value) => parsePositiveBigInt(value))
  .refine((value) => value !== undefined, {
    message: "A valid admin id is required.",
  });

const createAdminSchema = z.object({
  name: requiredString("name"),
  email: emailSchema,
  password: requiredString("password"),
  phone: requiredString("phone"),
  roleId: z
    .any()
    .transform((value) => parsePositiveBigInt(value))
    .refine((value) => value !== undefined, {
      message: "A valid roleId is required.",
    }),
});

const updateAdminSchema = z.object({
  name: z.any().optional().transform(v => sanitizeString(v) || undefined),
  email: z.any().optional().transform(v => sanitizeString(v) || undefined),
  password: z.any().optional().transform(v => sanitizeString(v) || undefined),
  phone: z.any().optional().transform(v => sanitizeString(v) || undefined),

  roleId: z.any().optional().transform(val => {
    if (val === undefined || val === null || val === "") return undefined;

    const num = Number(val);
    if (!Number.isInteger(num) || num <= 0) {
      throw new Error("roleId must be a positive integer.");
    }

    return num;
  }),

  profile: z.any().optional(),
}).superRefine((data, ctx) => {
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    ctx.addIssue({
      code: "custom",
      message: "email must be valid.",
    });
  }
});
  
export const validateCreateAdmin = (body) => {
  return parseWithSchema(createAdminSchema, body ?? {});
};

export const validateUpdateAdmin = (body) => {
  return parseWithSchema(updateAdminSchema, body ?? {});
};

export const validateAdminId = (id) => {
  return parseWithSchema(adminIdSchema, id);
};
