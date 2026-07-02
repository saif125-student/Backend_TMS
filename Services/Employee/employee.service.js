import bcrypt from "bcrypt";
import prisma from '../../prisma/client.js'

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const createServiceError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeEmployeeType = (value) => {
  return String(value || "EMPLOYEE")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
};

const normalizeDepartmentIds = (...sources) => {
  const collectedIds = [];

  for (const source of sources) {
    if (source === undefined || source === null || source === "") {
      continue;
    }

    if (Array.isArray(source)) {
      collectedIds.push(...source);
    } else {
      collectedIds.push(source);
    }
  }

  try {
    const uniqueIds = [
      ...new Set(
        collectedIds
          .filter(
            (id) =>
              id !== undefined &&
              id !== null &&
              String(id).trim() !== ""
          )
          .map((id) => String(id))
      ),
    ];

    return uniqueIds.map((id) => BigInt(id));
  } catch {
    throw createServiceError(
      "One or more department IDs are invalid."
    );
  }
};

/*
|--------------------------------------------------------------------------
| Create employee
|--------------------------------------------------------------------------
*/

export const createEmployeeWithRelated = async (
  employeeData,
  profilePath,
  documentRecords = [],
  departmentIds = []
) => {
  return prisma.$transaction(async (tx) => {
    /*
    |--------------------------------------------------------------------------
    | 1. Determine employee type
    |--------------------------------------------------------------------------
    */

    const employeeType = normalizeEmployeeType(
      employeeData.type
    );

    const allowedTypes = [
      "EMPLOYEE",
      "ADMIN_EMPLOYEE",
    ];

    if (!allowedTypes.includes(employeeType)) {
      throw createServiceError(
        "Type must be EMPLOYEE or ADMIN_EMPLOYEE."
      );
    }

    const isAdminEmployee =
      employeeType === "ADMIN_EMPLOYEE";

    /*
    |--------------------------------------------------------------------------
    | 2. Resolve role
    |--------------------------------------------------------------------------
    */

    let selectedRole;

    if (isAdminEmployee) {
      /*
       * Admin Employee:
       * role frontend ke Assign Role field se ayega.
       */

      if (!employeeData.roleId) {
        throw createServiceError(
          "Role is required for an admin employee."
        );
      }

      let roleId;

      try {
        roleId = BigInt(employeeData.roleId);
      } catch {
        throw createServiceError("Invalid role ID.");
      }

      selectedRole = await tx.role.findUnique({
        where: {
          id: roleId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!selectedRole) {
        throw createServiceError(
          "Selected role does not exist.",
          404
        );
      }

      /*
       * Optional security:
       * Employee creation se Super Admin assign na ho.
       */
      if (
        selectedRole.name
          ?.trim()
          .toLowerCase() === "super admin"
      ) {
        throw createServiceError(
          "Super Admin role cannot be assigned through employee creation.",
          403
        );
      }
    } else {
      /*
       * Normal Employee:
       * frontend ka roleId ignore hoga.
       * Backend automatically Employee role assign karega.
       */

      selectedRole = await tx.role.findFirst({
        where: {
          name: "employee",
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!selectedRole) {
        throw createServiceError(
          'Default "employee" role does not exist.',
          500
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | 3. Prepare department IDs
    |--------------------------------------------------------------------------
    |
    | Because you want only one department_employee table:
    |
    | employeeData.departmentId
    | employeeData.departmentIds
    | employeeData.assignedDepartmentIds
    |
    | All will be merged into one department list.
    |--------------------------------------------------------------------------
    */

    const normalizedDepartmentIds =
      normalizeDepartmentIds(
        employeeData.departmentId,
        departmentIds,
        employeeData.departmentIds,
        employeeData.assignedDepartmentIds
      );

    /*
     * Admin Employee ke liye at least one department.
     */
    if (
      isAdminEmployee &&
      normalizedDepartmentIds.length === 0
    ) {
      throw createServiceError(
        "At least one department must be assigned to an admin employee."
      );
    }

    /*
    |--------------------------------------------------------------------------
    | 4. Validate departments
    |--------------------------------------------------------------------------
    */

    if (normalizedDepartmentIds.length > 0) {
      const existingDepartments =
        await tx.departments.findMany({
          where: {
            id: {
              in: normalizedDepartmentIds,
            },
          },
          select: {
            id: true,
          },
        });

      if (
        existingDepartments.length !==
        normalizedDepartmentIds.length
      ) {
        throw createServiceError(
          "One or more selected departments do not exist.",
          404
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | 5. Hash password
    |--------------------------------------------------------------------------
    */

    const hashedPassword = await bcrypt.hash(
      employeeData.password,
      10
    );

    /*
    |--------------------------------------------------------------------------
    | 6. Create user
    |--------------------------------------------------------------------------
    |
    | Role exactly yahan assign ho raha hai:
    |
    | roleId: selectedRole.id
    |--------------------------------------------------------------------------
    */

    const user = await tx.user.create({
      data: {
        name: employeeData.name,
        email: employeeData.email,
        password: hashedPassword,
        roleId: selectedRole.id,
      },
    });

    /*
    |--------------------------------------------------------------------------
    | 7. Create employee
    |--------------------------------------------------------------------------
    */

    const employee = await tx.employees.create({
      data: {
        userId: user.id,

        /*
         * EMPLOYEE or ADMIN_EMPLOYEE
         */
        type: employeeType,

        profile: profilePath || null,
        fatherName: employeeData.fatherName || null,
        personalEmail:
          employeeData.personalEmail || null,
        phone: employeeData.phone || null,
        maritalStatus:
          employeeData.maritalStatus || null,
        bloodGroup: employeeData.bloodGroup || null,
        nationality:
          employeeData.nationality || null,
        religion: employeeData.religion || null,
        gender: employeeData.gender || null,
        dateOfBirth:
          employeeData.dateOfBirth || null,
        cnic: employeeData.cnic || null,
        cnicExpiry:
          employeeData.cnicExpiry || null,
        dateOfJoining:
          employeeData.dateOfJoining || null,
        designationId:
          employeeData.designationId || null,
        address: employeeData.address || null,
        status: employeeData.status || "active",
        basicSalary:
          employeeData.basicSalary ?? null,
        currency: employeeData.currency || null,

        qualifications:
          employeeData.qualifications?.length
            ? {
                create:
                  employeeData.qualifications,
              }
            : undefined,

        experiences:
          employeeData.experiences?.length
            ? {
                create: employeeData.experiences,
              }
            : undefined,

        children: employeeData.children?.length
          ? {
              create: employeeData.children,
            }
          : undefined,

        emergencyContacts:
          employeeData.emergencyContacts?.length
            ? {
                create:
                  employeeData.emergencyContacts,
              }
            : undefined,

        bankDetails:
          employeeData.bankDetails?.length
            ? {
                create: employeeData.bankDetails,
              }
            : undefined,

        documents: documentRecords.length
          ? {
              create: documentRecords,
            }
          : undefined,
      },
    });




      let admin = null;

      if (isAdminEmployee) {
        admin = await tx.admin.create({
          data: {
            userId: user.id,
            phone: employeeData.phone || null,
            profile: profilePath || null,
          },
        });
      }

    /*
    |--------------------------------------------------------------------------
    | 8. Assign departments
    |--------------------------------------------------------------------------
    */

    if (normalizedDepartmentIds.length > 0) {
      const currentDate = new Date();

      await tx.department_employee.createMany({
        data: normalizedDepartmentIds.map(
          (departmentId) => ({
            departmentId,
            employeeId: employee.id,
            createdAt: currentDate,
            updatedAt: currentDate,
          })
        ),
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 9. Return created data
    |--------------------------------------------------------------------------
    */

    return {
      user,
      employee,
      admin,
      role: selectedRole,
      employeeType,
      departmentIds: normalizedDepartmentIds,
    };
  });
};


export const updateEmployeeWithRelated = async (
  employeeId,
  employeeData,
  profilePath,
  documentRecords = [],
  departmentIds,
  options = {}
) => {
  const {
    departmentsProvided = false,
    documentsProvided = false,
  } = options;

  return prisma.$transaction(async (tx) => {
    /*
    |--------------------------------------------------------------------------
    | 1. Normalize employee ID
    |--------------------------------------------------------------------------
    */

    let normalizedEmployeeId;

    try {
      normalizedEmployeeId = BigInt(employeeId);

      if (normalizedEmployeeId <= 0n) {
        throw new Error();
      }
    } catch {
      throw createServiceError(
        "A valid employee ID is required.",
        400
      );
    }

    /*
    |--------------------------------------------------------------------------
    | 2. Find existing employee with user
    |--------------------------------------------------------------------------
    */

    const existingEmployee =
      await tx.employees.findUnique({
        where: {
          id: normalizedEmployeeId,
        },
        include: {
          user: {
            select: {
              id: true,
              roleId: true,
              name: true,
              email: true,
            },
          },
        },
      });

    if (!existingEmployee) {
      throw createServiceError(
        "Employee not found.",
        404
      );
    }

    /*
    |--------------------------------------------------------------------------
    | 3. Determine updated employee type
    |--------------------------------------------------------------------------
    */

    const employeeType =
      employeeData.type !== undefined
        ? normalizeEmployeeType(employeeData.type)
        : existingEmployee.type;

    const allowedTypes = [
      "EMPLOYEE",
      "ADMIN_EMPLOYEE",
    ];

    if (!allowedTypes.includes(employeeType)) {
      throw createServiceError(
        "Type must be EMPLOYEE or ADMIN_EMPLOYEE."
      );
    }

    const isAdminEmployee =
      employeeType === "ADMIN_EMPLOYEE";

    /*
    |--------------------------------------------------------------------------
    | 4. Resolve role
    |--------------------------------------------------------------------------
    */

    let selectedRole;

    if (isAdminEmployee) {
      /*
       * ADMIN_EMPLOYEE:
       *
       * New roleId provided:
       * → validate and assign selected role.
       *
       * Existing ADMIN_EMPLOYEE without roleId:
       * → keep existing role.
       *
       * EMPLOYEE changing to ADMIN_EMPLOYEE:
       * → roleId is required.
       */

      if (
        employeeData.roleId !== undefined &&
        employeeData.roleId !== null &&
        String(employeeData.roleId).trim() !== ""
      ) {
        let roleId;

        try {
          roleId = BigInt(employeeData.roleId);

          if (roleId <= 0n) {
            throw new Error();
          }
        } catch {
          throw createServiceError(
            "Invalid role ID."
          );
        }

        selectedRole = await tx.role.findUnique({
          where: {
            id: roleId,
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (!selectedRole) {
          throw createServiceError(
            "Selected role does not exist.",
            404
          );
        }

        if (
          selectedRole.name
            ?.trim()
            .toLowerCase() === "super admin"
        ) {
          throw createServiceError(
            "Super Admin role cannot be assigned through employee update.",
            403
          );
        }
      } else {
        /*
         * Employee ko admin mein convert kiya ja raha hai,
         * lekin roleId nahi mila.
         */
        if (
          existingEmployee.type !==
          "ADMIN_EMPLOYEE"
        ) {
          throw createServiceError(
            "Role is required when converting an employee to admin employee."
          );
        }

        /*
         * Existing admin ka current role preserve karna.
         */
        selectedRole = await tx.role.findUnique({
          where: {
            id: existingEmployee.user.roleId,
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (!selectedRole) {
          throw createServiceError(
            "The employee's existing role no longer exists.",
            404
          );
        }
      }
    } else {
      /*
       * Simple EMPLOYEE:
       * frontend ka roleId ignore hoga.
       * Default employee role assign hoga.
       */

      selectedRole = await tx.role.findFirst({
        where: {
          name: "employee",
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!selectedRole) {
        throw createServiceError(
          'Default "employee" role does not exist.',
          500
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | 5. Prepare and validate departments
    |--------------------------------------------------------------------------
    */

    let normalizedDepartmentIds;

    if (departmentsProvided) {
      normalizedDepartmentIds =
        normalizeDepartmentIds(departmentIds);

      if (
        isAdminEmployee &&
        normalizedDepartmentIds.length === 0
      ) {
        throw createServiceError(
          "At least one department must be assigned to an admin employee."
        );
      }

      if (normalizedDepartmentIds.length > 0) {
        const existingDepartments =
          await tx.departments.findMany({
            where: {
              id: {
                in: normalizedDepartmentIds,
              },
            },
            select: {
              id: true,
            },
          });

        if (
          existingDepartments.length !==
          normalizedDepartmentIds.length
        ) {
          throw createServiceError(
            "One or more selected departments do not exist.",
            404
          );
        }
      }
    } else if (isAdminEmployee) {
      /*
       * Admin update mein departments send nahi huay,
       * existing department assignments check karo.
       */

      const existingDepartmentCount =
        await tx.department_employee.count({
          where: {
            employeeId: normalizedEmployeeId,
          },
        });

      if (existingDepartmentCount === 0) {
        throw createServiceError(
          "Admin employee must have at least one assigned department."
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | 6. Prepare user update
    |--------------------------------------------------------------------------
    */

    const userUpdateData = {
      roleId: selectedRole.id,
    };

    if (employeeData.name !== undefined) {
      userUpdateData.name = employeeData.name;
    }

    if (employeeData.email !== undefined) {
      userUpdateData.email = employeeData.email;
    }

    if (
      employeeData.password !== undefined &&
      employeeData.password !== null &&
      String(employeeData.password).trim() !== ""
    ) {
      userUpdateData.password = await bcrypt.hash(
        employeeData.password,
        10
      );
    }

    const updatedUser = await tx.user.update({
      where: {
        id: existingEmployee.userId,
      },
      data: userUpdateData,
    });

    /*
    |--------------------------------------------------------------------------
    | 7. Update employee
    |--------------------------------------------------------------------------
    */

    const updatedEmployee =
      await tx.employees.update({
        where: {
          id: normalizedEmployeeId,
        },
        data: {
          type: employeeType,

          ...(profilePath !== undefined && {
            profile: profilePath,
          }),

          ...(employeeData.fatherName !==
            undefined && {
            fatherName: employeeData.fatherName,
          }),

          ...(employeeData.personalEmail !==
            undefined && {
            personalEmail:
              employeeData.personalEmail,
          }),

          ...(employeeData.phone !== undefined && {
            phone: employeeData.phone,
          }),

          ...(employeeData.maritalStatus !==
            undefined && {
            maritalStatus:
              employeeData.maritalStatus,
          }),

          ...(employeeData.bloodGroup !==
            undefined && {
            bloodGroup: employeeData.bloodGroup,
          }),

          ...(employeeData.nationality !==
            undefined && {
            nationality: employeeData.nationality,
          }),

          ...(employeeData.religion !==
            undefined && {
            religion: employeeData.religion,
          }),

          ...(employeeData.gender !== undefined && {
            gender: employeeData.gender,
          }),

          ...(employeeData.dateOfBirth !==
            undefined && {
            dateOfBirth: employeeData.dateOfBirth,
          }),

          ...(employeeData.cnic !== undefined && {
            cnic: employeeData.cnic,
          }),

          ...(employeeData.cnicExpiry !==
            undefined && {
            cnicExpiry: employeeData.cnicExpiry,
          }),

          ...(employeeData.dateOfJoining !==
            undefined && {
            dateOfJoining:
              employeeData.dateOfJoining,
          }),

          ...(employeeData.designationId !==
            undefined && {
            designationId:
              employeeData.designationId,
          }),

          ...(employeeData.address !== undefined && {
            address: employeeData.address,
          }),

          ...(employeeData.status !== undefined && {
            status: employeeData.status,
          }),

          ...(employeeData.basicSalary !==
            undefined && {
            basicSalary: employeeData.basicSalary,
          }),

          ...(employeeData.currency !==
            undefined && {
            currency: employeeData.currency,
          }),
        },
      });

    /*
    |--------------------------------------------------------------------------
    | 8. Sync admin table
    |--------------------------------------------------------------------------
    */

    let admin = null;

    if (isAdminEmployee) {
      /*
       * Admin already exists:
       * → update
       *
       * Admin does not exist:
       * → create
       */

      const adminUpdateData = {};

      if (employeeData.phone !== undefined) {
        adminUpdateData.phone =
          employeeData.phone;
      }

      if (profilePath !== undefined) {
        adminUpdateData.profile = profilePath;
      }

      admin = await tx.admin.upsert({
        where: {
          userId: existingEmployee.userId,
        },
        update: adminUpdateData,
        create: {
          userId: existingEmployee.userId,
          phone:
            employeeData.phone !== undefined
              ? employeeData.phone
              : existingEmployee.phone,
          profile:
            profilePath !== undefined
              ? profilePath
              : existingEmployee.profile,
        },
      });
    } else {
      /*
       * Admin employee ko simple employee banaya gaya:
       * admin table ki entry remove kar do.
       */

      await tx.admin.deleteMany({
        where: {
          userId: existingEmployee.userId,
        },
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 9. Replace qualifications only when provided
    |--------------------------------------------------------------------------
    */

    if (employeeData.qualifications !== undefined) {
      await tx.qualifications.deleteMany({
        where: {
          employeeId: normalizedEmployeeId,
        },
      });

      if (employeeData.qualifications.length > 0) {
        await tx.qualifications.createMany({
          data: employeeData.qualifications.map(
            (qualification) => ({
              ...qualification,
              employeeId: normalizedEmployeeId,
            })
          ),
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | 10. Replace experiences only when provided
    |--------------------------------------------------------------------------
    */

    if (employeeData.experiences !== undefined) {
      await tx.experiences.deleteMany({
        where: {
          employeeId: normalizedEmployeeId,
        },
      });

      if (employeeData.experiences.length > 0) {
        await tx.experiences.createMany({
          data: employeeData.experiences.map(
            (experience) => ({
              ...experience,
              employeeId: normalizedEmployeeId,
            })
          ),
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | 11. Replace children only when provided
    |--------------------------------------------------------------------------
    */

    if (employeeData.children !== undefined) {
      await tx.child_infos.deleteMany({
        where: {
          employeeId: normalizedEmployeeId,
        },
      });

      if (employeeData.children.length > 0) {
        await tx.child_infos.createMany({
          data: employeeData.children.map(
            (child) => ({
              ...child,
              employeeId: normalizedEmployeeId,
            })
          ),
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | 12. Replace emergency contacts only when provided
    |--------------------------------------------------------------------------
    */

    if (
      employeeData.emergencyContacts !== undefined
    ) {
      await tx.emergency_contacts.deleteMany({
        where: {
          employeeId: normalizedEmployeeId,
        },
      });

      if (
        employeeData.emergencyContacts.length > 0
      ) {
        await tx.emergency_contacts.createMany({
          data: employeeData.emergencyContacts.map(
            (contact) => ({
              ...contact,
              employeeId: normalizedEmployeeId,
            })
          ),
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | 13. Replace bank details only when provided
    |--------------------------------------------------------------------------
    */

    if (employeeData.bankDetails !== undefined) {
      await tx.bank_details.deleteMany({
        where: {
          employeeId: normalizedEmployeeId,
        },
      });

      if (employeeData.bankDetails.length > 0) {
        await tx.bank_details.createMany({
          data: employeeData.bankDetails.map(
            (bankDetail) => ({
              ...bankDetail,
              employeeId: normalizedEmployeeId,
            })
          ),
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | 14. Replace documents only when provided
    |--------------------------------------------------------------------------
    */

    if (documentsProvided) {
      await tx.employee_documents.deleteMany({
        where: {
          employeeId: normalizedEmployeeId,
        },
      });

      if (documentRecords.length > 0) {
        await tx.employee_documents.createMany({
          data: documentRecords.map((document) => ({
            ...document,
            employeeId: normalizedEmployeeId,
          })),
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | 15. Replace departments only when provided
    |--------------------------------------------------------------------------
    */

    if (departmentsProvided) {
      await tx.department_employee.deleteMany({
        where: {
          employeeId: normalizedEmployeeId,
        },
      });

      if (normalizedDepartmentIds.length > 0) {
        const currentDate = new Date();

        await tx.department_employee.createMany({
          data: normalizedDepartmentIds.map(
            (departmentId) => ({
              employeeId: normalizedEmployeeId,
              departmentId,
              createdAt: currentDate,
              updatedAt: currentDate,
            })
          ),
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | 16. Get final department IDs
    |--------------------------------------------------------------------------
    */

    const finalDepartmentRecords =
      await tx.department_employee.findMany({
        where: {
          employeeId: normalizedEmployeeId,
        },
        select: {
          departmentId: true,
        },
      });

    return {
      user: updatedUser,
      employee: updatedEmployee,
      admin,
      role: selectedRole,
      employeeType,
      departmentIds: finalDepartmentRecords.map(
        (record) => record.departmentId
      ),
    };
  });
};


export const getAllEmployeesService = async () => {
  const employees = await prisma.employees.findMany({
    include: {
      user: true,

      departments: {
        include: {
          department: true, 
        },
      },

      qualifications: true,
      experiences: true,
      children: true,
      emergencyContacts: true,
      bankDetails: true,
      documents: true,
    },
  });

  return employees;
};

export const getEmployeeByIdService = async (employeeId) => {
  const employee = await prisma.employees.findUnique({
    where: { id: employeeId },
    include: {
      user: true,
      qualifications: true,
      experiences: true,
      children: true,
      emergencyContacts: true,
      bankDetails: true,
      documents: true,
    },
  });

  if (!employee) {
    throw { status: 404, message: "Employee not found." };
  }

  return employee;
};

export const getEmployeeByUserIdService = async (userId) => {
  const employee = await prisma.employees.findFirst({
    where: { userId: BigInt(userId) }, // important if you're using BigInt IDs
    include: {
      user: true,
      qualifications: true,
      experiences: true,
      children: true,
      emergencyContacts: true,
      bankDetails: true,
      documents: true,
    },
  });

  if (!employee) {
    throw { status: 404, message: "Employee not found for this user." };
  }

  return employee;
};


export const getEmployeeByDepartmentIdService = async (departmentId) => {
  const employees = await prisma.employees.findMany({
    where: {
      departments: {
        some: {
          departmentId: BigInt(departmentId),
        },
      },
    },
    include: {
      user: true,
       departments: {
        include: {
          department: true, 
        },
    },
  }
  });

  return employees;
};
