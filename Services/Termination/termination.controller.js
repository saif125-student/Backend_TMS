import prisma from "../../prisma/client.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  validateCreateTermination,
  validateUpdateTermination,
  validateTerminationId,
  validateEmployeeId,
} from "./termination.validation.js";

import { getIo } from "../../sockets/io.js";
import { getUserSocketId } from "../../sockets/onlineUsers.js";
import { safePayload } from "../../utils/chatHelpers.js";

const toDateOnly = (date) => new Date(`${date}T00:00:00.000Z`);

const serialize = (data) => {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

const getEmployee = async (employeeId) => {
  return prisma.employees.findUnique({
    where: {
      id: employeeId,
    },
  });
};
export const createTermination = async (req, res) => {
  try {
    const data = validateCreateTermination(req.body);

    const employee = await getEmployee(data.employee_id);

    if (!employee) {
      return errorResponse(res, "Employee not found", {
        status: 404,
        message: "Employee not found.",
      });
    }

    if (!employee.dateOfJoining) {
      return errorResponse(res, "Employee joining date not found", {
        status: 400,
        message: "Employee date of joining is required before termination.",
      });
    }

    const existingTermination = await prisma.terminations.findFirst({
      where: {
        employee_id: data.employee_id,
      },
    });

    if (existingTermination) {
      return errorResponse(res, "Termination already exists", {
        status: 409,
        message: "Termination already exists for this employee.",
      });
    }

    const termination = await prisma.terminations.create({
      data: {
        employee_id: data.employee_id,
        date_of_joining: employee.dateOfJoining,
        termination_date: toDateOnly(data.termination_date),
        termination_reason: data.termination_reason,
        notes: data.notes,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const io = getIo();
    const assignedUserId = employee.userId;
    if (io && assignedUserId) {
      const assignedSocketId = getUserSocketId(assignedUserId);

      if (assignedSocketId) {
        io.to(assignedSocketId).emit(
          "termination_created",
          safePayload({
            type: "TERMINATION_CREATED",
            title: "Termination Notice",
            message: `Your termination has been created. Reason: ${termination.termination_reason}`,
            termination,
          })
        );
      }
    }

    return successResponse(
      res,
      "Termination created successfully",
      serialize(termination),
      201
    );
  } catch (error) {
    return errorResponse(res, "Failed to create termination", error);
  }
};

export const getTerminations = async (req, res) => {
  try {
    const terminations = await prisma.terminations.findMany({
      include: {
        employees: {
          include: {
            user: true,
            designation: true,
          },
        },
      },
      orderBy: {
        termination_date: "desc",
      },
    });

    return successResponse(
      res,
      "Terminations fetched successfully",
      serialize(terminations)
    );
  } catch (error) {
    return errorResponse(res, "Failed to fetch terminations", error);
  }
};

export const getTerminationByEmployeeId = async (req, res) => {
  try {
    const employeeId = validateEmployeeId(req.params.employeeId);

    const employee = await getEmployee(employeeId);

    if (!employee) {
      return errorResponse(res, "Employee not found", {
        status: 404,
        message: "Employee not found.",
      });
    }

    const terminations = await prisma.terminations.findMany({
      where: {
        employee_id: employeeId,
      },
      include: {
        employees: {
          include: {
            user: true,
            designation: true,
          },
        },
      },
      orderBy: {
        termination_date: "desc",
      },
    });

    return successResponse(
      res,
      "Employee terminations fetched successfully",
      serialize(terminations)
    );
  } catch (error) {
    return errorResponse(res, "Failed to fetch employee terminations", error);
  }
};

export const updateTermination = async (req, res) => {
  try {
    const id = validateTerminationId(req.params.id);
    const data = validateUpdateTermination(req.body);

    const oldTermination = await prisma.terminations.findUnique({
      where: {
        id,
      },
    });

    if (!oldTermination) {
      return errorResponse(res, "Termination not found", {
        status: 404,
        message: "Termination not found.",
      });
    }

    let employee = null;

    if (data.employee_id !== undefined) {
      employee = await getEmployee(data.employee_id);

      if (!employee) {
        return errorResponse(res, "Employee not found", {
          status: 404,
          message: "Employee not found.",
        });
      }

      if (!employee.dateOfJoining) {
        return errorResponse(res, "Employee joining date not found", {
          status: 400,
          message: "Employee date of joining is required before termination.",
        });
      }
    }

    const updatedTermination = await prisma.terminations.update({
      where: {
        id,
      },
      data: {
        ...(data.employee_id !== undefined && {
          employee_id: data.employee_id,
          date_of_joining: employee.dateOfJoining,
        }),

        ...(data.termination_date !== undefined && {
          termination_date: toDateOnly(data.termination_date),
        }),

        ...(data.termination_reason !== undefined && {
          termination_reason: data.termination_reason,
        }),

        ...(data.notes !== undefined && {
          notes: data.notes,
        }),

        updated_at: new Date(),
      },
    });

    return successResponse(
      res,
      "Termination updated successfully",
      serialize(updatedTermination)
    );
  } catch (error) {
    return errorResponse(res, "Failed to update termination", error);
  }
};

export const deleteTermination = async (req, res) => {
  try {
    const id = validateTerminationId(req.params.id);

    const termination = await prisma.terminations.findUnique({
      where: {
        id,
      },
    });

    if (!termination) {
      return errorResponse(res, "Termination not found", {
        status: 404,
        message: "Termination not found.",
      });
    }

    await prisma.terminations.delete({
      where: {
        id,
      },
    });

    return successResponse(res, "Termination deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete termination", error);
  }
};