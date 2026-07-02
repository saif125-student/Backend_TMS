import prisma from '../../prisma/client.js'
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  validateCreateDepartment,
  validateUpdateDepartment,
  validateDepartmentId,
} from "./department.validation.js";

export const createDepartment = async (req, res) => {
  try {
    const { name, description } = validateCreateDepartment(req.body);

    const department = await prisma.departments.create({
      data: { name, description },
    });

    return successResponse(res, "Department created successfully", department, 201);
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return errorResponse(res, "Failed to create department", error);
  }
};

export const getDepartments = async (req, res) => {
  try {
    const departments = await prisma.departments.findMany({
      orderBy: { id: "desc" },
    });

    return successResponse(res, "Departments fetched successfully", departments);
  } catch (error) {
    return errorResponse(res, "Failed to fetch departments", error);
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const { departmentId, name, description } = validateUpdateDepartment(req.params.id, req.body);

    const department = await prisma.departments.update({
      where: { id: departmentId },
      data: { ...(name && { name }), ...(description && { description }) },
    });

    return successResponse(res, "Department updated successfully", department);
  } catch (error) {
    return errorResponse(res, "Failed to update department", error);
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const departmentId = validateDepartmentId(req.params.id);

    await prisma.departments.delete({
      where: { id: departmentId },
    });

    return successResponse(res, "Department deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete department", error);
  }
};
