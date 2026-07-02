import prisma from "../../prisma/client.js";
import {
  successResponse,
  errorResponse,
} from "../../utils/response.js";
import {
  validateCreateDepartmentDuty,
  validateUpdateDepartmentDuty,
  validateCreateEmployeeDuty,
  validateUpdateEmployeeDuty,
  validateDutyTimingId,
  validateDepartmentId,
  validateEmployeeId,
} from "./duty.validation.js";

const handleError = (res, message, error) => {
  if (error?.status) {
    return errorResponse(res, error.message, null, error.status);
  }

  if (error?.code === "P2025") {
    return errorResponse(res, "Duty timing not found.", null, 404);
  }

  return errorResponse(res, message, error);
};

/*
|--------------------------------------------------------------------------
| Department duty timings
|--------------------------------------------------------------------------
*/

export const createDepartmentDutyTiming = async (req, res) => {
  try {
    const { departmentId, startTime, endTime } =
      validateCreateDepartmentDuty(req.body);

    const department = await prisma.departments.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });

    if (!department) {
      return errorResponse(res, "Department not found.", null, 404);
    }

    const duplicate = await prisma.duty_timings.findFirst({
      where: {
        department_id: departmentId,
        start_time: startTime,
        end_time: endTime,
      },
    });

    if (duplicate) {
      return errorResponse(
        res,
        "This department duty timing already exists.",
        null,
        409
      );
    }

    const dutyTiming = await prisma.duty_timings.create({
      data: {
        department_id: departmentId,
        start_time: startTime,
        end_time: endTime,
      },
      include: {
        departments: true,
      },
    });

    return successResponse(
      res,
      "Department duty timing created successfully.",
      dutyTiming,
      201
    );
  } catch (error) {
    return handleError(
      res,
      "Failed to create department duty timing.",
      error
    );
  }
};

export const getDepartmentDutyTimings = async (req, res) => {
  try {
    const dutyTimings = await prisma.duty_timings.findMany({
      include: {
        departments: true,
      },
      orderBy: { id: "desc" },
    });

    return successResponse(
      res,
      "Department duty timings fetched successfully.",
      dutyTimings
    );
  } catch (error) {
    return handleError(
      res,
      "Failed to fetch department duty timings.",
      error
    );
  }
};

export const getDepartmentDutyTimingById = async (req, res) => {
  try {
    const dutyTimingId = validateDutyTimingId(req.params.id);

    const dutyTiming = await prisma.duty_timings.findUnique({
      where: { id: dutyTimingId },
      include: {
        departments: true,
      },
    });

    if (!dutyTiming) {
      return errorResponse(
        res,
        "Department duty timing not found.",
        null,
        404
      );
    }

    return successResponse(
      res,
      "Department duty timing fetched successfully.",
      dutyTiming
    );
  } catch (error) {
    return handleError(
      res,
      "Failed to fetch department duty timing.",
      error
    );
  }
};

export const getDutyTimingsByDepartment = async (req, res) => {
  try {
    const departmentId = validateDepartmentId(
      req.params.departmentId
    );

    const department = await prisma.departments.findUnique({
      where: { id: departmentId },
      select: {
        id: true,
        name: true,
        duty_timings: {
          orderBy: { id: "desc" },
        },
      },
    });

    if (!department) {
      return errorResponse(res, "Department not found.", null, 404);
    }

    return successResponse(
      res,
      "Department duty timings fetched successfully.",
      department
    );
  } catch (error) {
    return handleError(
      res,
      "Failed to fetch department duty timings.",
      error
    );
  }
};

export const updateDepartmentDutyTiming = async (req, res) => {
  try {
    const data = validateUpdateDepartmentDuty(
      req.params.id,
      req.body
    );

    const existing = await prisma.duty_timings.findUnique({
      where: { id: data.dutyTimingId },
    });

    if (!existing) {
      return errorResponse(
        res,
        "Department duty timing not found.",
        null,
        404
      );
    }

    const departmentId =
      data.departmentId ?? existing.department_id;

    const department = await prisma.departments.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });

    if (!department) {
      return errorResponse(res, "Department not found.", null, 404);
    }

    const startTime = data.startTime ?? existing.start_time;
    const endTime = data.endTime ?? existing.end_time;

    if (startTime.getTime() === endTime.getTime()) {
      return errorResponse(
        res,
        "startTime and endTime cannot be the same.",
        null,
        400
      );
    }

    const duplicate = await prisma.duty_timings.findFirst({
      where: {
        id: { not: data.dutyTimingId },
        department_id: departmentId,
        start_time: startTime,
        end_time: endTime,
      },
    });

    if (duplicate) {
      return errorResponse(
        res,
        "This department duty timing already exists.",
        null,
        409
      );
    }

    const dutyTiming = await prisma.duty_timings.update({
      where: { id: data.dutyTimingId },
      data: {
        department_id: departmentId,
        start_time: startTime,
        end_time: endTime,
      },
      include: {
        departments: true,
      },
    });

    return successResponse(
      res,
      "Department duty timing updated successfully.",
      dutyTiming
    );
  } catch (error) {
    return handleError(
      res,
      "Failed to update department duty timing.",
      error
    );
  }
};

export const deleteDepartmentDutyTiming = async (req, res) => {
  try {
    const dutyTimingId = validateDutyTimingId(req.params.id);

    const result = await prisma.duty_timings.deleteMany({
      where: { id: dutyTimingId },
    });

    if (!result.count) {
      return errorResponse(
        res,
        "Department duty timing not found.",
        null,
        404
      );
    }

    return successResponse(
      res,
      "Department duty timing deleted successfully."
    );
  } catch (error) {
    return handleError(
      res,
      "Failed to delete department duty timing.",
      error
    );
  }
};

/*
|--------------------------------------------------------------------------
| Employee duty timings
|--------------------------------------------------------------------------
*/

export const createEmployeeDutyTiming = async (req, res) => {
  try {
    const data = validateCreateEmployeeDuty(req.body);

    const employee = await prisma.employees.findUnique({
      where: { id: data.employeeId },
      select: { id: true },
    });

    if (!employee) {
      return errorResponse(res, "Employee not found.", null, 404);
    }

    const overlappingDuty =
      await prisma.employee_duty_timings.findFirst({
        where: {
          employee_id: data.employeeId,
          valid_from: { lte: data.validTill },
          valid_till: { gte: data.validFrom },
        },
      });

    if (overlappingDuty) {
      return errorResponse(
        res,
        "The employee already has a duty timing within this date range.",
        null,
        409
      );
    }

    const dutyTiming =
      await prisma.employee_duty_timings.create({
        data: {
          employee_id: data.employeeId,
          start_time: data.startTime,
          end_time: data.endTime,
          valid_from: data.validFrom,
          valid_till: data.validTill,
        },
            include: {
        employees: {
            include: {
            user: true,
            designation: true,
            },
        },
        },
      });

    return successResponse(
      res,
      "Employee duty timing created successfully.",
      dutyTiming,
      201
    );
  } catch (error) {
    return handleError(
      res,
      "Failed to create employee duty timing.",
      error
    );
  }
};

export const getEmployeeDutyTimings = async (req, res) => {
  try {
    const dutyTimings =
      await prisma.employee_duty_timings.findMany({
        include: {
          employees: {
            include: {
              user: true,
              designation: true,
            },
          },
        },
        orderBy: { id: "desc" },
      });

    return successResponse(
      res,
      "Employee duty timings fetched successfully.",
      dutyTimings
    );
  } catch (error) {
    return handleError(
      res,
      "Failed to fetch employee duty timings.",
      error
    );
  }
};

export const getEmployeeDutyTimingById = async (req, res) => {
  try {
    const dutyTimingId = validateDutyTimingId(req.params.id);

    const dutyTiming =
      await prisma.employee_duty_timings.findUnique({
        where: { id: dutyTimingId },
        include: {
          employees: {
            include: {
              users: true,
              designations: true,
            },
          },
        },
      });

    if (!dutyTiming) {
      return errorResponse(
        res,
        "Employee duty timing not found.",
        null,
        404
      );
    }

    return successResponse(
      res,
      "Employee duty timing fetched successfully.",
      dutyTiming
    );
  } catch (error) {
    return handleError(
      res,
      "Failed to fetch employee duty timing.",
      error
    );
  }
};

export const getDutyTimingsByEmployee = async (req, res) => {
  try {
    const employeeId = validateEmployeeId(req.params.employeeId);

    const employee = await prisma.employees.findUnique({
      where: { id: employeeId },
      include: {
        users: true,
        employee_duty_timings: {
          orderBy: {
            valid_from: "desc",
          },
        },
      },
    });

    if (!employee) {
      return errorResponse(res, "Employee not found.", null, 404);
    }

    return successResponse(
      res,
      "Employee duty timings fetched successfully.",
      employee
    );
  } catch (error) {
    return handleError(
      res,
      "Failed to fetch employee duty timings.",
      error
    );
  }
};

export const updateEmployeeDutyTiming = async (req, res) => {
  try {
    const data = validateUpdateEmployeeDuty(
      req.params.id,
      req.body
    );

    const existing =
      await prisma.employee_duty_timings.findUnique({
        where: { id: data.dutyTimingId },
      });

    if (!existing) {
      return errorResponse(
        res,
        "Employee duty timing not found.",
        null,
        404
      );
    }

    const employeeId = data.employeeId ?? existing.employee_id;
    const startTime = data.startTime ?? existing.start_time;
    const endTime = data.endTime ?? existing.end_time;
    const validFrom = data.validFrom ?? existing.valid_from;
    const validTill = data.validTill ?? existing.valid_till;

    if (startTime.getTime() === endTime.getTime()) {
      return errorResponse(
        res,
        "startTime and endTime cannot be the same.",
        null,
        400
      );
    }

    if (validTill < validFrom) {
      return errorResponse(
        res,
        "validTill must be equal to or after validFrom.",
        null,
        400
      );
    }

    const employee = await prisma.employees.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });

    if (!employee) {
      return errorResponse(res, "Employee not found.", null, 404);
    }

    const overlappingDuty =
      await prisma.employee_duty_timings.findFirst({
        where: {
          id: { not: data.dutyTimingId },
          employee_id: employeeId,
          valid_from: { lte: validTill },
          valid_till: { gte: validFrom },
        },
      });

    if (overlappingDuty) {
      return errorResponse(
        res,
        "The employee already has another duty timing within this date range.",
        null,
        409
      );
    }

    const dutyTiming =
      await prisma.employee_duty_timings.update({
        where: { id: data.dutyTimingId },
        data: {
          employee_id: employeeId,
          start_time: startTime,
          end_time: endTime,
          valid_from: validFrom,
          valid_till: validTill,
        },
        include: {
          employees: {
            include: {
              users: true,
              designations: true,
            },
          },
        },
      });

    return successResponse(
      res,
      "Employee duty timing updated successfully.",
      dutyTiming
    );
  } catch (error) {
    return handleError(
      res,
      "Failed to update employee duty timing.",
      error
    );
  }
};

export const deleteEmployeeDutyTiming = async (req, res) => {
  try {
    const dutyTimingId = validateDutyTimingId(req.params.id);

    const result = await prisma.employee_duty_timings.deleteMany({
      where: { id: dutyTimingId },
    });

    if (!result.count) {
      return errorResponse(
        res,
        "Employee duty timing not found.",
        null,
        404
      );
    }

    return successResponse(
      res,
      "Employee duty timing deleted successfully."
    );
  } catch (error) {
    return handleError(
      res,
      "Failed to delete employee duty timing.",
      error
    );
  }
};