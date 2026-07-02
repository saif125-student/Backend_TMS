import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  parseNonNegativeInteger,
  parseBooleanLike,
  parseDateLike,
  sanitizeString,
} from "../../utils/zodValidation.js";

const TODO_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const hasField = (body, field) =>
  Object.prototype.hasOwnProperty.call(body, field);

export const validateCreateTodo = (body = {}) => {
  const schema = z.object({
    employeeId: z
      .any()
      .transform((value) => parsePositiveBigInt(value))
      .refine((value) => value !== undefined, {
        message: "A valid employeeId is required.",
      }),
    title: z
      .any()
      .transform((value) => sanitizeString(value))
      .refine((value) => Boolean(value), { message: "title is required." })
      .refine((value) => value.length <= 255, {
        message: "title must not exceed 255 characters.",
      }),
    description: z.any().optional().transform((value) => sanitizeString(value) || undefined),
    dueTime: z
      .any()
      .optional()
      .transform((value) => parseDateLike(value))
      .refine(
        (value) => value !== undefined || body.dueTime === undefined || body.dueTime === null || sanitizeString(body.dueTime) === "",
        { message: "dueTime must be a valid date and time." }
      ),
    priority: z.any().optional().transform((value) => sanitizeString(value) || undefined),
    sortOrder: z
      .any()
      .optional()
      .transform((value) => (value === undefined ? 0 : parseNonNegativeInteger(value)))
      .refine((value) => value !== undefined, {
        message: "sortOrder must be a non-negative integer.",
      }),
  }).superRefine((data, ctx) => {
    if (data.priority && !TODO_PRIORITIES.includes(data.priority)) {
      ctx.addIssue({
        code: "custom",
        message: `priority must be one of: ${TODO_PRIORITIES.join(", ")}.`,
      });
    }
  });

  return parseWithSchema(schema, body ?? {});
};

export const validateUpdateTodo = (id, body = {}) => {
  const todoId = parsePositiveBigInt(id);

  if (!todoId) {
    throw {
      status: 400,
      message: "A valid todo id is required.",
    };
  }

  const allowedFields = [
    "employeeId",
    "title",
    "description",
    "dueTime",
    "priority",
    "sortOrder",
    "isCompleted",
  ];

  const hasUpdate = allowedFields.some((field) =>
    hasField(body, field)
  );

  if (!hasUpdate) {
    throw {
      status: 400,
      message: "At least one field is required to update the todo.",
    };
  }

  const data = {};

  if (hasField(body, "employeeId")) {
    const employeeId = parsePositiveBigInt(body.employeeId);

    if (!employeeId) {
      throw {
        status: 400,
        message: "A valid employeeId is required.",
      };
    }

    data.employeeId = employeeId;
  }

  if (hasField(body, "title")) {
    const title = sanitizeString(body.title);

    if (!title) {
      throw {
        status: 400,
        message: "title cannot be empty.",
      };
    }

    if (title.length > 255) {
      throw {
        status: 400,
        message: "title must not exceed 255 characters.",
      };
    }

    data.title = title;
  }

  if (hasField(body, "description")) {
    data.description = sanitizeString(body.description) || null;
  }

  if (hasField(body, "dueTime")) {
    if (
      body.dueTime === null ||
      sanitizeString(body.dueTime) === ""
    ) {
      data.dueTime = null;
    } else {
      const dueTime = parseDateLike(body.dueTime);
      

      if (!dueTime) {
        throw {
          status: 400,
          message: "dueTime must be a valid date and time.",
        };
      }

      data.dueTime = dueTime;
    }
  }

  if (hasField(body, "priority")) {
    const priority = sanitizeString(body.priority);

    if (priority && !TODO_PRIORITIES.includes(priority)) {
      throw {
        status: 400,
        message: `priority must be one of: ${TODO_PRIORITIES.join(", ")}.`,
      };
    }

    data.priority = priority || null;
  }

  if (hasField(body, "sortOrder")) {
    const sortOrder = parseNonNegativeInteger(body.sortOrder);

    if (sortOrder === undefined) {
      throw {
        status: 400,
        message: "sortOrder must be a non-negative integer.",
      };
    }

    data.sortOrder = sortOrder;
  }

  if (hasField(body, "isCompleted")) {
    const isCompleted = parseBooleanLike(body.isCompleted);

    if (isCompleted === undefined) {
      throw {
        status: 400,
        message: "isCompleted must be true or false.",
      };
    }

    data.isCompleted = isCompleted;
  }

  return {
    todoId,
    data,
  };
};

export const validateTodoId = (id) => {
  const todoId = parsePositiveBigInt(id);

  if (!todoId) {
    throw {
      status: 400,
      message: "A valid todo id is required.",
    };
  }

  return todoId;
};

export const validateEmployeeId = (id) => {
  const employeeId = parsePositiveBigInt(id);

  if (!employeeId) {
    throw {
      status: 400,
      message: "A valid employee id is required.",
    };
  }

  return employeeId;
};

export const validateTodoCompletion = (id, body = {}) => {
  const todoId = validateTodoId(id);
  const isCompleted = parseBooleanLike(body.isCompleted);

  if (isCompleted === undefined) {
    throw {
      status: 400,
      message: "isCompleted must be true or false.",
    };
  }

  return {
    todoId,
    isCompleted,
  };
};

export const validateTodoFilters = (query = {}) => {
  const filters = {};

  if (query.employeeId !== undefined) {
    const employeeId = parsePositiveBigInt(query.employeeId);

    if (!employeeId) {
      throw {
        status: 400,
        message: "A valid employeeId is required.",
      };
    }

    filters.employee_id = employeeId;
  }

  if (query.isCompleted !== undefined) {
    const isCompleted = parseBooleanLike(query.isCompleted);

    if (isCompleted === undefined) {
      throw {
        status: 400,
        message: "isCompleted must be true or false.",
      };
    }

    filters.is_completed = isCompleted;
  }

  if (query.priority !== undefined) {
    const priority = sanitizeString(query.priority);

    if (!TODO_PRIORITIES.includes(priority)) {
      throw {
        status: 400,
        message: `priority must be one of: ${TODO_PRIORITIES.join(", ")}.`,
      };
    }

    filters.priority = priority;
  }

  return filters;
};

export const getTodoPriorities = () => [...TODO_PRIORITIES];