import prisma from "../../prisma/client.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  validateCreateResignation,
  validateUpdateResignation,
  validateResignationId,
  validateEmployeeId,
} from "./resignation.validation.js";

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
    where: { id: employeeId },
  });
};

export const createResignation = async (req, res) => {
  try {
    const data = validateCreateResignation(req.body);

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
        message: "Employee date of joining is required before resignation.",
      });
    }

    const existingResignation = await prisma.resignations.findFirst({
      where: {
        employee_id: data.employee_id,
      },
    });

    if (existingResignation) {
      return errorResponse(res, "Resignation already exists", {
        status: 409,
        message: "Resignation already exists for this employee.",
      });
    }

    const resignation = await prisma.resignations.create({
      data: {
        employee_id: data.employee_id,
        date_of_joining: employee.dateOfJoining,
        resignation_date: toDateOnly(data.resignation_date),
        last_working_day: toDateOnly(data.last_working_day),
        resignation_reason: data.resignation_reason,
        resignation_status: data.resignation_status,
        notes: data.notes,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return successResponse(
      res,
      "Resignation created successfully",
      serialize(resignation),
      201
    );
  } catch (error) {
    return errorResponse(res, "Failed to create resignation", error);
  }
};

export const getResignations = async (req, res) => {
  try {
    const resignations = await prisma.resignations.findMany({
      include: {
        employees: {
          include: {
            user: true,
            designation: true,
          },
        },
      },
      orderBy: {
        resignation_date: "desc",
      },
    });

    return successResponse(
      res,
      "Resignations fetched successfully",
      serialize(resignations)
    );
  } catch (error) {
    return errorResponse(res, "Failed to fetch resignations", error);
  }
};

export const getResignationByEmployeeId = async (req, res) => {
  try {
    const employeeId = validateEmployeeId(req.params.employeeId);

    const employee = await getEmployee(employeeId);

    if (!employee) {
      return errorResponse(res, "Employee not found", {
        status: 404,
        message: "Employee not found.",
      });
    }

    const resignations = await prisma.resignations.findMany({
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
        resignation_date: "desc",
      },
    });

    return successResponse(
      res,
      "Employee resignations fetched successfully",
      serialize(resignations)
    );
  } catch (error) {
    return errorResponse(res, "Failed to fetch employee resignations", error);
  }
};

export const updateResignation = async (req, res) => {
  try {
    const id = validateResignationId(req.params.id);
    const data = validateUpdateResignation(req.body);

    const oldResignation = await prisma.resignations.findUnique({
      where: { id },
    });
    console.log("Old Resignation:", oldResignation);

    if (!oldResignation) {
      return errorResponse(res, "Resignation not found", {
        status: 404,
        message: "Resignation not found.",
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

      if (!employee.date_of_joining) {
        return errorResponse(res, "Employee joining date not found", {
          status: 400,
          message: "Employee date of joining is required before resignation.",
        });
      }
    }

    const updatedResignation = await prisma.resignations.update({
      where: { id },
      data: {
        ...(data.employee_id !== undefined && {
          employee_id: data.employee_id,
          date_of_joining: employee.date_of_joining,
        }),

        ...(data.resignation_date !== undefined && {
          resignation_date: toDateOnly(data.resignation_date),
        }),

        ...(data.last_working_day !== undefined && {
          last_working_day: toDateOnly(data.last_working_day),
        }),

        ...(data.resignation_reason !== undefined && {
          resignation_reason: data.resignation_reason,
        }),

        ...(data.resignation_status !== undefined && {
          resignation_status: data.resignation_status,
        }),

        ...(data.notes !== undefined && {
          notes: data.notes,
        }),

        updated_at: new Date(),
      },
    });

    return successResponse(
      res,
      "Resignation updated successfully",
      serialize(updatedResignation)
    );
  } catch (error) {
    return errorResponse(res, "Failed to update resignation", error);
  }
};

export const deleteResignation = async (req, res) => {
  try {
    const id = validateResignationId(req.params.id);

    const resignation = await prisma.resignations.findUnique({
      where: { id },
    });

    if (!resignation) {
      return errorResponse(res, "Resignation not found", {
        status: 404,
        message: "Resignation not found.",
      });
    }

    await prisma.resignations.delete({
      where: { id },
    });

    return successResponse(res, "Resignation deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete resignation", error);
  }
};



export const updateResignationByEmployeeId = async (req, res) => {
  try {
    const employeeId = validateEmployeeId(req.params.employeeId);
    const data = validateUpdateResignation(req.body);

    const employee = await getEmployee(employeeId);

    if (!employee) {
      return errorResponse(res, "Employee not found", {
        status: 404,
        message: "Employee not found.",
      });
    }

    const oldResignation = await prisma.resignations.findFirst({
      where: {
        employee_id: employeeId,
      },
    });

    if (!oldResignation) {
      return errorResponse(res, "Resignation not found", {
        status: 404,
        message: "Resignation not found for this employee.",
      });
    }

    const updatedResignation = await prisma.resignations.update({
      where: {
        id: oldResignation.id,
      },
      data: {
        ...(data.resignation_date !== undefined && {
          resignation_date: toDateOnly(data.resignation_date),
        }),

        ...(data.last_working_day !== undefined && {
          last_working_day: toDateOnly(data.last_working_day),
        }),

        ...(data.resignation_reason !== undefined && {
          resignation_reason: data.resignation_reason,
        }),

        ...(data.resignation_status !== undefined && {
          resignation_status: data.resignation_status,
        }),

        ...(data.notes !== undefined && {
          notes: data.notes,
        }),

        updated_at: new Date(),
      },
    });

    return successResponse(
      res,
      "Resignation updated successfully",
      serialize(updatedResignation)
    );
  } catch (error) {
    return errorResponse(res, "Failed to update resignation", error);
  }
};

export const createResignationByEmployeeId = async (req, res) => {
  try {
    const employeeId = validateEmployeeId(req.params.employeeId);
    const data = validateCreateResignation({
      ...req.body,
      employee_id: employeeId,
    });

    const employee = await getEmployee(employeeId);

    if (!employee) {
      return errorResponse(res, "Employee not found", {
        status: 404,
        message: "Employee not found.",
      });
    }

    if (!employee.dateOfJoining) {
      return errorResponse(res, "Employee joining date not found", {
        status: 400,
        message: "Employee date of joining is required before resignation.",
      });
    }

    const existingResignation = await prisma.resignations.findFirst({
      where: {
        employee_id: employeeId,
      },
    });

    if (existingResignation) {
      return errorResponse(res, "Resignation already exists", {
        status: 409,
        message: "Resignation already exists for this employee.",
      });
    }

    const resignation = await prisma.resignations.create({
      data: {
        employee_id: employeeId,
        date_of_joining: employee.dateOfJoining,
        resignation_date: toDateOnly(data.resignation_date),
        last_working_day: toDateOnly(data.last_working_day),
        resignation_reason: data.resignation_reason,
        resignation_status: data.resignation_status,
        notes: data.notes,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return successResponse(
      res,
      "Resignation created successfully",
      serialize(resignation),
      201
    );
  } catch (error) {
    return errorResponse(res, "Failed to create resignation", error);
  }
};