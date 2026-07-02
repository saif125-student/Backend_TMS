import prisma from '../../prisma/client.js'
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  validateCreateRole,
  validateUpdateRole,
  validateAssignPermissions,
  validateRoleId,
} from "./role.validation.js";

// CREATE ROLE
export const createRole = async (req, res) => {
  try {
    const { name, guardName } = validateCreateRole(req.body);

    const role = await prisma.role.create({
      data: { name, guardName },
    });

    return successResponse(res, "Role created successfully", role, 201);
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return errorResponse(res, "Failed to create role", error);
  }
};

export const getRoles = async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return successResponse(res, "Roles fetched successfully", roles);
  } catch (error) {
    return errorResponse(res, "Failed to fetch roles", error);
  }
};

export const updateRole = async (req, res) => {
  try {
    const { roleId, name, guardName } = validateUpdateRole(req.params.id, req.body);

    const role = await prisma.role.update({
      where: { id: roleId },
      data: { ...(name && { name }), ...(guardName && { guardName }) },
    });

    return successResponse(res, "Role updated successfully", role);
  } catch (error) {
    return errorResponse(res, "Failed to update role", error);
  }
};

export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.role.delete({
      where: { id: BigInt(id) },
    });

    return successResponse(res, "Role deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete role", error);
  }
};

export const assignPermissionsToRole = async (req, res) => {
  try {
    const { roleId, permissionIds } = req.body;

    await prisma.roleHasPermission.deleteMany({
      where: { roleId: BigInt(roleId) },
    });

    const data = permissionIds.map((pid) => ({
      roleId: BigInt(roleId),
      permissionId: BigInt(pid),
    }));

    await prisma.roleHasPermission.createMany({ data });

    return successResponse(
      res,
      "Permissions assigned to role successfully"
    );
  } catch (error) {
    return errorResponse(res, "Failed to assign permissions", error);
  }
};