import prisma from '../../prisma/client.js'
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  validateCreatePermission,
  validateUpdatePermission,
} from "./permissions.validation.js";

// CREATE PERMISSION
export const createPermission = async (req, res) => {
  try {
    const { name, guardName, groupName } = validateCreatePermission(req.body);

    const permission = await prisma.permission.create({
      data: { name, guardName, groupName },
    });

    return successResponse(
      res,
      "Permission created successfully",
      permission,
      201
    );
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return errorResponse(res, "Failed to create permission", error);
  }
};




export const getPermissions = async (req, res) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: { id: "desc" },
    });

    return successResponse(
      res,
      "Permissions fetched successfully",
      permissions
    );
  } catch (error) {
    return errorResponse(res, "Failed to fetch permissions", error);
  }
};



export const updatePermission = async (req, res) => {
  try {
    const { permissionId, name, guardName, groupName } = validateUpdatePermission(req.params.id, req.body);

    const permission = await prisma.permission.update({
      where: { id: permissionId },
      data: { ...(name && { name }), ...(guardName && { guardName }), ...(groupName && { groupName }) },
    });

    return successResponse(
      res,
      "Permission updated successfully",
      permission
    );
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return errorResponse(res, "Failed to update permission", error);
  }
};




export const deletePermission = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.permission.delete({
      where: { id: BigInt(id) },
    });

    return successResponse(res, "Permission deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete permission", error);
  }
};