import prisma from "../../prisma/client.js";
import { successResponse, errorResponse } from "../../utils/response.js";

import {
  validateCreateLeavePolicy,
  validateUpdateLeavePolicy,
  validateLeavePolicyId,
} from "./leavepolicy.validations.js";

const serialize = (data) => {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

// CREATE LEAVE POLICY
export const createLeavePolicy = async (req, res) => {
  try {
    const data = validateCreateLeavePolicy(req.body);

    const leavePolicy = await prisma.leave_policies.create({
      data: {
        leave_type: data.leave_type,
        annual_days: data.annual_days,
        is_active: data.is_active,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return successResponse(
      res,
      "Leave policy created successfully",
      serialize(leavePolicy),
      201
    );
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }

    return errorResponse(res, "Failed to create leave policy", error);
  }
};

// GET ALL LEAVE POLICIES
export const getLeavePolicies = async (req, res) => {
  try {
    const leavePolicies = await prisma.leave_policies.findMany({
      orderBy: { id: "desc" },
    });

    return successResponse(
      res,
      "Leave policies fetched successfully",
      serialize(leavePolicies)
    );
  } catch (error) {
    return errorResponse(res, "Failed to fetch leave policies", error);
  }
};

// UPDATE LEAVE POLICY
export const updateLeavePolicy = async (req, res) => {
  try {
    const { leavePolicyId, leave_type, annual_days, is_active } =
      validateUpdateLeavePolicy(req.params.id, req.body);

    const leavePolicy = await prisma.leave_policies.update({
      where: { id: leavePolicyId },
      data: {
        ...(leave_type && { leave_type }),
        ...(annual_days !== undefined && { annual_days }),
        ...(is_active !== undefined && { is_active }),
        updated_at: new Date(),
      },
    });

    return successResponse(
      res,
      "Leave policy updated successfully",
      serialize(leavePolicy)
    );
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }

    return errorResponse(res, "Failed to update leave policy", error);
  }
};

// DELETE LEAVE POLICY
export const deleteLeavePolicy = async (req, res) => {
  try {
    const leavePolicyId = validateLeavePolicyId(req.params.id);

    await prisma.leave_policies.delete({
      where: { id: leavePolicyId },
    });

    return successResponse(res, "Leave policy deleted successfully");
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }

    return errorResponse(res, "Failed to delete leave policy", error);
  }
};