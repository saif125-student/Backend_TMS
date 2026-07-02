import prisma from '../../prisma/client.js'
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  validateCreateDesignation,
  validateUpdateDesignation,
  validateDesignationId,
} from "./designation.validation.js";

export const createDesignation = async (req, res) => {
  try {
    const { name, departmentId, description } = validateCreateDesignation(req.body);

    const designation = await prisma.designations.create({
      data: {
        name,
        description,
        departmentId,
      },
    });

    return successResponse(res, "Designation created successfully", designation, 201);
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return errorResponse(res, "Failed to create designation", error);
  }
};

export const getDesignations = async (req, res) => {
  try {
    const designations = await prisma.designations.findMany({
      include: { department: true },
      orderBy: { id: "desc" },
    });

    return successResponse(res, "Designations fetched successfully", designations);
  } catch (error) {
    return errorResponse(res, "Failed to fetch designations", error);
  }
};

export const updateDesignation = async (req, res) => {
  try {
    const { designationId, name, departmentId, description } = validateUpdateDesignation(req.params.id, req.body);

    const designation = await prisma.designations.update({
      where: { id: designationId },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(departmentId && { departmentId }),
      },
    });

    return successResponse(res, "Designation updated successfully", designation);
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return errorResponse(res, "Failed to update designation", error);
  }
};

export const deleteDesignation = async (req, res) => {
  try {
    const designationId = validateDesignationId(req.params.id);

    await prisma.designations.delete({
      where: { id: designationId },
    });

    return successResponse(res, "Designation deleted successfully");
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return errorResponse(res, "Failed to delete designation", error);
  }
};
