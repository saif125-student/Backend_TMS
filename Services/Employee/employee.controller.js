import prisma from "../../prisma/client.js";
import { successResponse, errorResponse } from "../../utils/response.js";

import { validateEmployeeCreateRequest,validateEmployeeUpdateRequest } from "./employee.validation.js";
import { createEmployeeWithRelated,updateEmployeeWithRelated,getAllEmployeesService,getEmployeeByIdService ,getEmployeeByUserIdService,getEmployeeByDepartmentIdService} from "./employee.service.js";

import {
  cleanupUploadedFiles,
  moveSavedFile,
  makeRelativePath,
  PROFILE_STORAGE_DIR,
  DOCUMENT_STORAGE_DIR,
} from "./employee.upload.js";

const safeResponse = (user, employee, documentCount, departmentIds) => ({
  user: {
    id: user.id.toString(),
    name: user.name,
    email: user.email,
    roleId: user.roleId.toString(),
  },
  employee: {
    id: employee.id.toString(),
    userId: employee.userId.toString(),
    designationId: employee.designationId ? employee.designationId.toString() : null,
    personalEmail: employee.personalEmail,
    phone: employee.phone,
    status: employee.status,
  },
  documentCount,
  departmentIds: departmentIds.map((id) => id.toString()),
});
export const createEmployee = async (req, res) => {
  const files = req.files || {};

  try {
    /*
    |--------------------------------------------------------------------------
    | 1. Validate request
    |--------------------------------------------------------------------------
    */

    const {
      employeeData,
      profileFile,
      documentFiles,
      documentMetadata,
    } = await validateEmployeeCreateRequest(
      req.body.data,
      files
    );

    /*
    |--------------------------------------------------------------------------
    | 2. Save profile image
    |--------------------------------------------------------------------------
    */

    const profileRelativePath = profileFile
      ? makeRelativePath(
          await moveSavedFile(
            profileFile,
            PROFILE_STORAGE_DIR
          )
        )
      : null;

    /*
    |--------------------------------------------------------------------------
    | 3. Save employee documents
    |--------------------------------------------------------------------------
    */

    const documentRecords = [];

    for (
      let index = 0;
      index < documentFiles.length;
      index += 1
    ) {
      const file = documentFiles[index];
      const metadata = documentMetadata[index];

      const savedPath = makeRelativePath(
        await moveSavedFile(
          file,
          DOCUMENT_STORAGE_DIR
        )
      );

      documentRecords.push({
        documentName: metadata.documentName,
        document: savedPath,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 4. Create employee
    |--------------------------------------------------------------------------
    */

    const {
      user,
      employee,
      role,
      employeeType,
      departmentIds,
    } = await createEmployeeWithRelated(
      employeeData,
      profileRelativePath,
      documentRecords,
      employeeData.departmentIds || []
    );

    /*
    |--------------------------------------------------------------------------
    | 5. Prepare response
    |--------------------------------------------------------------------------
    */

    const employeeResponse = safeResponse(
      user,
      employee,
      documentRecords.length,
      departmentIds.map((id) => id.toString())
    );

    const responseData = {
      ...employeeResponse,

      type: employeeType,

      role: {
        id: role.id.toString(),
        name: role.name,
      },

      departmentIds: departmentIds.map((id) =>
        id.toString()
      ),
    };

    return successResponse(
      res,
      "Employee created successfully",
      responseData,
      201
    );
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | 6. Clean uploaded files when creation fails
    |--------------------------------------------------------------------------
    */

    await cleanupUploadedFiles(files);

    const status = error?.status || 500;

    let message = "Failed to create employee.";

    if (error?.code === "P2002") {
      const target = Array.isArray(
        error.meta?.target
      )
        ? error.meta.target.join(",")
        : String(error.meta?.target || "");

      if (target.includes("email")) {
        message =
          "A user with this email or personal email already exists.";
      } else if (target.includes("cnic")) {
        message =
          "An employee with this CNIC already exists.";
      } else if (
        target.includes("departmentId") &&
        target.includes("employeeId")
      ) {
        message =
          "The employee is already assigned to this department.";
      } else {
        message =
          "A unique constraint was violated.";
      }
    } else if (error?.code === "P2003") {
      message =
        "A foreign key constraint failed. One of the provided role, designation, or department IDs does not exist.";
    } else if (error?.code === "P2025") {
      message =
        "A required related record was not found.";
    } else if (error?.message) {
      message = error.message;
    }

    return errorResponse(
      res,
      message,
      null,
      status
    );
  }
};

export const updateEmployee = async (req, res) => {
  const files = req.files || {};

  try {
    /*
    |--------------------------------------------------------------------------
    | 1. Validate employee ID
    |--------------------------------------------------------------------------
    */

    let employeeId;

    try {
      employeeId = BigInt(req.params.id);

      if (employeeId <= 0n) {
        throw new Error();
      }
    } catch {
      return errorResponse(
        res,
        "A valid employee ID is required.",
        null,
        400
      );
    }

    /*
    |--------------------------------------------------------------------------
    | 2. Validate update request
    |--------------------------------------------------------------------------
    */

    const {
      employeeData,
      profileFile,
      documentFiles,
      documentMetadata,
      departmentIds,
      departmentsProvided,
      documentsProvided,
    } = await validateEmployeeUpdateRequest(
      req.body.data,
      files
    );

    /*
    |--------------------------------------------------------------------------
    | 3. Save new profile
    |--------------------------------------------------------------------------
    */

    const profileRelativePath = profileFile
      ? makeRelativePath(
          await moveSavedFile(
            profileFile,
            PROFILE_STORAGE_DIR
          )
        )
      : undefined;

    /*
    |--------------------------------------------------------------------------
    | 4. Save new documents
    |--------------------------------------------------------------------------
    */

    const documentRecords = [];

    for (
      let index = 0;
      index < documentFiles.length;
      index += 1
    ) {
      const file = documentFiles[index];
      const metadata = documentMetadata[index];

      const savedPath = makeRelativePath(
        await moveSavedFile(
          file,
          DOCUMENT_STORAGE_DIR
        )
      );

      documentRecords.push({
        documentName: metadata.documentName,
        document: savedPath,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 5. Update employee
    |--------------------------------------------------------------------------
    */

    const {
      employee,
      admin,
      role,
      employeeType,
      departmentIds: finalDepartmentIds,
    } = await updateEmployeeWithRelated(
      employeeId,
      employeeData,
      profileRelativePath,
      documentRecords,
      departmentIds,
      {
        departmentsProvided,
        documentsProvided,
      }
    );

    /*
    |--------------------------------------------------------------------------
    | 6. Response
    |--------------------------------------------------------------------------
    */

    return successResponse(
      res,
      "Employee updated successfully",
      {
        employeeId: employee.id.toString(),

        type: employeeType,

        role: {
          id: role.id.toString(),
          name: role.name,
        },

        admin: admin
          ? {
              id: admin.id.toString(),
              userId: admin.userId.toString(),
              phone: admin.phone,
              profile: admin.profile,
            }
          : null,

        departmentIds: finalDepartmentIds.map(
          (id) => id.toString()
        ),
      },
      200
    );
  } catch (error) {
    await cleanupUploadedFiles(files);

    const status = error?.status || 500;

    let message =
      error?.message ||
      "Failed to update employee.";

    if (error?.code === "P2002") {
      const target = Array.isArray(
        error.meta?.target
      )
        ? error.meta.target.join(",")
        : String(error.meta?.target || "");

      if (target.includes("email")) {
        message =
          "A user with this email already exists.";
      } else if (target.includes("personalEmail")) {
        message =
          "An employee with this personal email already exists.";
      } else if (target.includes("cnic")) {
        message =
          "An employee with this CNIC already exists.";
      } else {
        message =
          "A unique constraint was violated.";
      }
    } else if (error?.code === "P2003") {
      message =
        "A foreign key constraint failed. One of the provided IDs does not exist.";
    } else if (error?.code === "P2025") {
      message =
        "The employee or related record was not found.";
    }

    return errorResponse(
      res,
      message,
      null,
      status
    );
  }
};

export const getAllEmployees = async (req, res) => {
  try {
    const employees = await getAllEmployeesService();

    return successResponse(
      res,
      "Employees fetched successfully",
      employees,
      200
    );
  } catch (error) {
    return errorResponse(
      res,
      error?.message || "Failed to fetch employees",
      null,
      error?.status || 500
    );
  }
};


export const getEmployeeById = async (req, res) => {
  try {
    const employeeId = Number(req.params.id);

    const employee = await getEmployeeByIdService(employeeId);

    return successResponse(
      res,
      "Employee fetched successfully",
      employee,
      200
    );
  } catch (error) {
    return errorResponse(
      res,
      error?.message || "Failed to fetch employee",
      null,
      error?.status || 500
    );
  }
};


export const getEmployeeByUserId = async (req, res) => {
  try {
    const userId = req.params.userId;

    const employee = await getEmployeeByUserIdService(userId);

    return successResponse(
      res,
      "Employee fetched successfully",
      employee,
      200
    );
  } catch (error) {
    return errorResponse(
      res,
      error?.message || "Failed to fetch employee",
      null,
      error?.status || 500
    );
  }
};





export const getEmployeeByDepartmentId = async (req, res) => {
  try {
    const departmentId = req.params.departmentId;

    const employee = await getEmployeeByDepartmentIdService(departmentId);

    return successResponse(
      res,
      "Employee fetched successfully",
      employee,
      200
    );
  } catch (error) {
    return errorResponse(
      res,
      error?.message || "Failed to fetch employee",
      null,
      error?.status || 500
    );
  }
};

