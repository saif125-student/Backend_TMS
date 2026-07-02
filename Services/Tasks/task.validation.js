import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  parseNonNegativeInteger,
  sanitizeString,
} from "../../utils/zodValidation.js";

const TASK_STATUSES = ["Pending", "In_Progress", "Completed"];

const requiredBigInt = (label) =>
  z
    .any()
    .transform((value) => parsePositiveBigInt(value))
    .refine((value) => value !== undefined, {
      message: `A valid ${label} is required.`,
    });

const taskIdSchema = requiredBigInt("task id");

export const validateCreateTask = (body = {}) => {
  const schema = z.object({
    name: z
      .any()
      .transform((value) => sanitizeString(value))
      .refine((value) => Boolean(value), { message: "name is required." })
      .refine((value) => value.length <= 255, {
        message: "name must not exceed 255 characters.",
      }),
    description: z.any().optional().transform((value) => sanitizeString(value) || undefined),
    projectId: requiredBigInt("projectId"),
    departmentId: requiredBigInt("departmentId"),
    employeeId: requiredBigInt("employeeId"),
    hours: z
      .any()
      .transform((value) => parseNonNegativeInteger(value))
      .refine((value) => value !== undefined, {
        message: "hours must be a non-negative integer.",
      }),
    minutes: z
      .any()
      .transform((value) => parseNonNegativeInteger(value))
      .refine((value) => value !== undefined && value <= 59, {
        message: "minutes must be between 0 and 59.",
      }),
  });

  return parseWithSchema(schema, body ?? {});
};

export const validateUpdateTask = (id, body = {}) => {
  const taskId = parseWithSchema(taskIdSchema, id);

  const allowedFields = [
    "name",
    "description",
    "projectId",
    "departmentId",
    "employeeId",
    "hours",
    "minutes",
    "status",
  ];

  const hasUpdateField = allowedFields.some((field) =>
    Object.prototype.hasOwnProperty.call(body, field)
  );

  if (!hasUpdateField) {
    throw {
      status: 400,
      message: "At least one field is required to update the task.",
    };
  }

  const data = {};

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = sanitizeString(body.name);

    if (!name) {
      throw {
        status: 400,
        message: "name cannot be empty.",
      };
    }

    if (name.length > 255) {
      throw {
        status: 400,
        message: "name must not exceed 255 characters.",
      };
    }

    data.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    data.description = sanitizeString(body.description) || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "projectId")) {
    const projectId = parsePositiveBigInt(body.projectId);

    if (!projectId) {
      throw {
        status: 400,
        message: "A valid projectId is required.",
      };
    }

    data.projectId = projectId;
  }

  if (Object.prototype.hasOwnProperty.call(body, "departmentId")) {
    const departmentId = parsePositiveBigInt(body.departmentId);

    if (!departmentId) {
      throw {
        status: 400,
        message: "A valid departmentId is required.",
      };
    }

    data.departmentId = departmentId;
  }

  if (Object.prototype.hasOwnProperty.call(body, "employeeId")) {
    const employeeId = parsePositiveBigInt(body.employeeId);

    if (!employeeId) {
      throw {
        status: 400,
        message: "A valid employeeId is required.",
      };
    }

    data.employeeId = employeeId;
  }

  if (Object.prototype.hasOwnProperty.call(body, "hours")) {
    const hours = parseNonNegativeInteger(body.hours);

    if (hours === undefined) {
      throw {
        status: 400,
        message: "hours must be a non-negative integer.",
      };
    }

    data.hours = hours;
  }

  if (Object.prototype.hasOwnProperty.call(body, "minutes")) {
    const minutes = parseNonNegativeInteger(body.minutes);

    if (minutes === undefined || minutes > 59) {
      throw {
        status: 400,
        message: "minutes must be between 0 and 59.",
      };
    }

    data.minutes = minutes;
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const status = sanitizeString(body.status);

    if (!TASK_STATUSES.includes(status)) {
      throw {
        status: 400,
        message: `status must be one of: ${TASK_STATUSES.join(", ")}.`,
      };
    }

    data.status = status;
  }

  return {
    taskId,
    data,
  };
};

export const validateTaskId = (id) => {
  return parseWithSchema(taskIdSchema, id);
};

export const validateOptionsDepartmentId = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const departmentId = parsePositiveBigInt(value);

  if (!departmentId) {
    throw {
      status: 400,
      message: "A valid departmentId is required.",
    };
  }

  return departmentId;
};

export const validateUpdateTaskStatus = (id, body = {}) => {
  const taskId = parseWithSchema(taskIdSchema, id);
  const status = sanitizeString(body.status);

  if (!status) {
    throw {
      status: 400,
      message: "status is required.",
    };
  }

  if (!TASK_STATUSES.includes(status)) {
    throw {
      status: 400,
      message: `status must be one of: ${TASK_STATUSES.join(", ")}.`,
    };
  }

  return {
    taskId,
    status,
  };
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

export const validateAssignerId = (id) => {
  const assignerId = parsePositiveBigInt(id);

  if (!assignerId) {
    throw {
      status: 400,
      message: "A valid assigner id is required.",
    };
  }

  return assignerId;
};

export const validateProjectId = (id) => {
  const projectId = parsePositiveBigInt(id);

  if (!projectId) {
    throw {
      status: 400,
      message: "A valid project id is required.",
    };
  }

  return projectId;
};