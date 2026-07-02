import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  sanitizeString,
} from "../../utils/zodValidation.js";

const projectIdSchema = z
  .any()
  .transform((value) => parsePositiveBigInt(value))
  .refine((value) => value !== undefined, {
    message: "A valid project id is required.",
  });

export const validateCreateProject = (body = {}) => {
  const schema = z.object({
    name: z
      .any()
      .transform((value) => sanitizeString(value))
      .refine((value) => Boolean(value), { message: "name is required." })
      .refine((value) => value.length <= 255, {
        message: "name must not exceed 255 characters.",
      }),
    description: z.any().optional().transform((value) => sanitizeString(value) || undefined),
  });

  return parseWithSchema(schema, body ?? {});
};

export const validateUpdateProject = (id, body = {}) => {
  const hasName = Object.prototype.hasOwnProperty.call(body, "name");
  const hasDescription = Object.prototype.hasOwnProperty.call(
    body,
    "description"
  );

  if (!hasName && !hasDescription) {
    throw {
      status: 400,
      message: "At least one field is required to update the project.",
    };
  }

  const name = hasName ? sanitizeString(body.name) : undefined;
  const description = hasDescription ? sanitizeString(body.description) : undefined;

  if (hasName && !name) {
    throw {
      status: 400,
      message: "name cannot be empty.",
    };
  }

  if (name && name.length > 255) {
    throw {
      status: 400,
      message: "name must not exceed 255 characters.",
    };
  }

  return {
    projectId: parseWithSchema(projectIdSchema, id),
    name,
    // Empty description clears the nullable database field.
    description: hasDescription ? description || null : undefined,
  };
};

export const validateProjectId = (id) => {
  return parseWithSchema(projectIdSchema, id);
};