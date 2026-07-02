
import fs from "fs";
import path from "path";
import prisma from "../../prisma/client.js";
import {
  successResponse,
  errorResponse,
} from "../../utils/response.js";
import {
  validateCreateLeave,
  validateUpdateLeave,
  validateLeaveId,
} from "./leaves.validation.js";

/* ======================================================
   BASIC HELPERS
====================================================== */

const toDateOnly = (date) => new Date(`${date}T00:00:00.000Z`);

const serialize = (data) => {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

const handleLeaveError = (res, error, defaultMessage) => {
  if (error?.status) {
    return errorResponse(
      res,
      error.message,
      null,
      error.status
    );
  }

  if (error?.code === "P2025") {
    return errorResponse(
      res,
      "Leave not found",
      null,
      404
    );
  }

  return errorResponse(res, defaultMessage, error);
};

const leaveInclude = {
  employees: {
    include: {
      user: true,
      designation: true,
    },
  },
  users_leaves_added_byTousers: true,
  users_leaves_reviewed_byTousers: true,
  leave_attachments: true,
};

const getTotalDays = (startDate, endDate) => {
  return Math.floor(
    (endDate - startDate) / (1000 * 60 * 60 * 24)
  ) + 1;
};

const validateDateRange = (startDate, endDate) => {
  if (endDate < startDate) {
    throw {
      status: 400,
      message: "End date must be greater than or equal to start date.",
    };
  }
};

/* ======================================================
   DATABASE HELPERS
====================================================== */

const getEmployeeById = async (employeeId) => {
  return prisma.employees.findUnique({
    where: {
      id: employeeId,
    },
  });
};

const getLeaveById = async (leaveId) => {
  return prisma.leaves.findUnique({
    where: {
      id: leaveId,
    },
    include: {
      leave_attachments: true,
    },
  });
};

const getLeavePolicyById = async (leavePolicyId) => {
  return prisma.leave_policies.findUnique({
    where: {
      id: leavePolicyId,
    },
  });
};

const checkLeavePolicy = async (leavePolicyId) => {
  const leavePolicy = await getLeavePolicyById(leavePolicyId);

  if (!leavePolicy) {
    throw {
      status: 404,
      message: "Leave policy not found.",
    };
  }

  if (!leavePolicy.is_active) {
    throw {
      status: 400,
      message: "Leave policy is not active.",
    };
  }

  return leavePolicy;
};

const checkEmployee = async (employeeId) => {
  const employee = await getEmployeeById(employeeId);

  if (!employee) {
    throw {
      status: 404,
      message: "Employee not found.",
    };
  }

  return employee;
};

const checkOverlappingLeave = async ({
  employeeId,
  startDate,
  endDate,
  leaveId = null,
}) => {
  return prisma.leaves.findFirst({
    where: {
      employee_id: employeeId,

      ...(leaveId && {
        id: {
          not: leaveId,
        },
      }),

      status: {
        not: "rejected",
      },

      start_date: {
        lte: endDate,
      },

      end_date: {
        gte: startDate,
      },
    },
  });
};

const validateLeaveAllowedDays = ({
  requestedDays,
  allowedDays,
}) => {
  if (requestedDays > allowedDays) {
    throw {
      status: 400,
      message: `You cannot apply more than ${allowedDays} day(s) for this leave type.`,
    };
  }
};

/* ======================================================
   ATTACHMENT HELPERS
====================================================== */

const saveLeaveAttachment = async (file) => {
  if (!file) return null;

  const uploadDir = path.join(process.cwd(), "uploads", "leaves");

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {
      recursive: true,
    });
  }

  const fileExtension = path.extname(file.originalname);

  const fileName = `leave-${Date.now()}-${Math.round(
    Math.random() * 1e9
  )}${fileExtension}`;

  const filePath = path.join(uploadDir, fileName);

  fs.writeFileSync(filePath, file.buffer);

  return `uploads/leaves/${fileName}`;
};

const deleteLeaveAttachmentFiles = (attachments = []) => {
  for (const file of attachments) {
    if (!file.attachment) continue;

    const filePath = path.join(process.cwd(), file.attachment);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

const replaceLeaveAttachment = async ({
  tx,
  leaveId,
  oldAttachments,
  newAttachmentPath,
  now,
}) => {
  if (!newAttachmentPath) return;

  deleteLeaveAttachmentFiles(oldAttachments);

  await tx.leave_attachments.deleteMany({
    where: {
      leave_id: leaveId,
    },
  });

  await tx.leave_attachments.create({
    data: {
      leave_id: leaveId,
      attachment: newAttachmentPath,
      created_at: now,
      updated_at: now,
    },
  });
};

/* ======================================================
   PAYLOAD BUILDERS
====================================================== */

const buildCreateLeaveData = ({
  data,
  leavePolicy,
  startDate,
  endDate,
  attachmentPath,
  userId,
  now,
}) => {
  return {
    employee_id: data.employee_id,
    leave_type: leavePolicy.leave_type,

    start_date: startDate,
    end_date: endDate,

    description: data.description,

    added_by: userId || null,
    reviewed_by: userId || null,

    created_at: now,
    updated_at: now,

    ...(attachmentPath && {
      leave_attachments: {
        create: {
          attachment: attachmentPath,
          created_at: now,
          updated_at: now,
        },
      },
    }),
  };
};

const buildUpdateLeaveData = ({
  data,
  leavePolicy,
  startDate,
  endDate,
  userId,
  now,
}) => {
  return {
    ...(leavePolicy && {
      leave_type: leavePolicy.leave_type,
    }),

    ...(data.start_date !== undefined && {
      start_date: startDate,
    }),

    ...(data.end_date !== undefined && {
      end_date: endDate,
    }),

    ...(data.description !== undefined && {
      description: data.description,
    }),

    ...(data.status !== undefined && {
      status: data.status,
      reviewed_by: userId || null,
    }),

    ...(data.review_remarks !== undefined && {
      review_remarks: data.review_remarks,
      reviewed_by: userId || null,
    }),

    updated_at: now,
  };
};

/* ======================================================
   CREATE LEAVE
====================================================== */

/* ======================================================
   GET LEAVES
====================================================== */

export const getLeaves = async (req, res) => {
  try {
    const leaves = await prisma.leaves.findMany({
      include: leaveInclude,
      orderBy: {
        created_at: "desc",
      },
    });

    return successResponse(
      res,
      "Leaves fetched successfully",
      serialize(leaves)
    );
  } catch (error) {
    return handleLeaveError(
      res,
      error,
      "Failed to fetch leaves"
    );
  }
};

/* ======================================================
   UPDATE LEAVE
====================================================== */

export const updateLeave = async (req, res) => {
  try {
    const leaveId = validateLeaveId(req.params.id);
    const data = validateUpdateLeave(req.body);

    const existingLeave = await getLeaveById(leaveId);

    if (!existingLeave) {
      return errorResponse(
        res,
        "Leave not found",
        null,
        404
      );
    }

    let leavePolicy = null;

    if (data.leave_policy_id !== undefined) {
      leavePolicy = await checkLeavePolicy(data.leave_policy_id);
    }

    const startDate = data.start_date
      ? toDateOnly(data.start_date)
      : existingLeave.start_date;

    const endDate = data.end_date
      ? toDateOnly(data.end_date)
      : existingLeave.end_date;

    validateDateRange(startDate, endDate);

    const overlappingLeave = await checkOverlappingLeave({
      employeeId: existingLeave.employee_id,
      startDate,
      endDate,
      leaveId,
    });

    if (overlappingLeave) {
      return errorResponse(
        res,
        "Employee already has an overlapping leave for these dates.",
        null,
        409
      );
    }

    if (leavePolicy) {
      const requestedDays = getTotalDays(startDate, endDate);

      validateLeaveAllowedDays({
        requestedDays,
        allowedDays: leavePolicy.annual_days,
      });
    }

    const attachmentPath = await saveLeaveAttachment(req.file);
    const now = new Date();

    const updatedLeave = await prisma.$transaction(async (tx) => {
      await replaceLeaveAttachment({
        tx,
        leaveId,
        oldAttachments: existingLeave.leave_attachments,
        newAttachmentPath: attachmentPath,
        now,
      });

      const leave = await tx.leaves.update({
        where: {
          id: leaveId,
        },
        data: buildUpdateLeaveData({
          data,
          leavePolicy,
          startDate,
          endDate,
          userId: req.user?.id,
          now,
        }),
        include: leaveInclude,
      });

      return leave;
    });

    return successResponse(
      res,
      "Leave updated successfully",
      serialize(updatedLeave)
    );
  } catch (error) {
    return handleLeaveError(
      res,
      error,
      "Failed to update leave"
    );
  }
};

/* ======================================================
   DELETE LEAVE
====================================================== */

export const deleteLeave = async (req, res) => {
  try {
    const leaveId = validateLeaveId(req.params.id);

    const existingLeave = await getLeaveById(leaveId);

    if (!existingLeave) {
      return errorResponse(
        res,
        "Leave not found",
        null,
        404
      );
    }

    deleteLeaveAttachmentFiles(existingLeave.leave_attachments);

    await prisma.$transaction(async (tx) => {
      await tx.leave_attachments.deleteMany({
        where: {
          leave_id: leaveId,
        },
      });

      await tx.leaves.delete({
        where: {
          id: leaveId,
        },
      });
    });

    return successResponse(
      res,
      "Leave deleted successfully"
    );
  } catch (error) {
    return handleLeaveError(
      res,
      error,
      "Failed to delete leave"
    );
  }
};


export const updateStatusById = async (req, res) => {
  try {
    const id = validateLeaveId(req.params.id);
    const { status } = req.body;

    
    const allowedStatuses = ["pending", "approved", "rejected"];

    if (!status || !allowedStatuses.includes(status)) {
      return errorResponse(
        res,
        "Invalid status value",
        null,
        400
      );
    }

    const existing = await prisma.leaves.findUnique({
      where: { id },
    });

    if (!existing) {
      return errorResponse(
        res,
        "Leave not found",
        null,
        404
      );
    }

    const updated = await prisma.leaves.update({
      where: { id },
      data: {
        status,
        reviewed_by: req.user?.id || null,
        updated_at: new Date(),
      },
    });

    return successResponse(
      res,
      "Status updated successfully",
      updated
    );
  } catch (error) {
    return errorResponse(res, "Failed to update status", error);
  }
};


export const createLeave = async (req, res) => {
  try {
    const data = validateCreateLeave(req.body);

    const authUserId =
      req.user?.id !== undefined && req.user?.id !== null
        ? BigInt(req.user.id)
        : null;

    if (!authUserId) {
      return errorResponse(res, "Unauthorized user", null, 401);
    }

    const authUser = await prisma.user.findUnique({
      where: {
        id: authUserId,
      },
      include: {
        role: true,
      },
    });

    if (!authUser) {
      return errorResponse(res, "Authenticated user not found", null, 404);
    }

    const roleName = authUser?.role?.name || "";
    const normalizedRole = roleName.toLowerCase().replace(/[\s_-]/g, "");

    const isSuperAdmin = normalizedRole === "superadmin";
    const isAdmin = normalizedRole === "admin";
    const isEmployee = normalizedRole === "employee";

    let employeeId;

    if (isEmployee) {
      const employee = await prisma.employees.findFirst({
        where: {
          userId: authUserId,
        },
      });

      if (!employee) {
        return errorResponse(res, "Employee profile not found", null, 404);
      }

      employeeId = employee.id;
    } else if (isAdmin || isSuperAdmin) {
      if (!data.employee_id) {
        return errorResponse(res, "employee_id is required", null, 400);
      }

      employeeId = data.employee_id;
    } else {
      return errorResponse(res, "You are not allowed to create leave", null, 403);
    }

    await checkEmployee(employeeId);

    const leavePolicy = await checkLeavePolicy(data.leave_policy_id);

    const startDate = toDateOnly(data.start_date);
    const endDate = toDateOnly(data.end_date);

    validateDateRange(startDate, endDate);

    const requestedDays = getTotalDays(startDate, endDate);

    validateLeaveAllowedDays({
      requestedDays,
      allowedDays: leavePolicy.annual_days,
    });

    const overlappingLeave = await checkOverlappingLeave({
      employeeId,
      startDate,
      endDate,
    });

    if (overlappingLeave) {
      return errorResponse(
        res,
        "Employee already has an overlapping leave for these dates.",
        null,
        409
      );
    }

    const attachmentPath = req.file
      ? await saveLeaveAttachment(req.file)
      : null;

    const now = new Date();

    const leaveStatus = isSuperAdmin ? "approved" : "pending";

    const leave = await prisma.leaves.create({
      data: buildCreateLeaveData({
        employeeId,
        leavePolicy,
        startDate,
        endDate,
        description: data.description,
        attachmentPath,
        addedBy: authUserId,
        reviewedBy: isSuperAdmin ? authUserId : null,
        status: leaveStatus,
        now,
      }),
      include: leaveInclude,
    });

    return successResponse(
      res,
      "Leave created successfully",
      serialize({
        leave,
        requested_days: requestedDays,
        allowed_days: leavePolicy.annual_days,
      }),
      201
    );
  } catch (error) {
    return handleLeaveError(res, error, "Failed to create leave");
  }
};

