import prisma from "../../prisma/client.js";
import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  parseDateLike,
  parseBooleanLike,
  sanitizeNullableString,
} from "../../utils/zodValidation.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validationError = (message) => ({ status: 400, message });

const parseJson = (value) => {
  if (value === undefined || value === null) return undefined;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  return value;
};

const toNullableDate = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  return parseDateLike(value) ?? null;
};

const ensureDate = (value, fieldName) => {
  const parsed = toNullableDate(value);
  if (value !== undefined && value !== null && String(value).trim() !== "" && !parsed) {
    throw validationError(`${fieldName} must be a valid date.`);
  }
  return parsed;
};

const ensureArrayInput = (label, value) => {
  const parsed = parseJson(value);
  if (parsed === undefined || parsed === null || parsed === "") return [];

  if (!Array.isArray(parsed)) {
    throw validationError(`${label} must be an array.`);
  }

  return parsed;
};

const requiredString = (field) =>
  z
    .any()
    .transform((value) => sanitizeNullableString(value))
    .refine((value) => Boolean(value), {
      message: `${field} is required.`,
    });

const optionalString = z
  .any()
  .optional()
  .transform((value) => sanitizeNullableString(value));

const positiveBigIntField = (field) =>
  z
    .any()
    .transform((value) => parsePositiveBigInt(value))
    .refine((value) => value !== undefined, {
      message: `A valid ${field} is required.`,
    });
const optionalPositiveBigIntField = z
  .any()
  .optional()
  .transform((value) => {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return undefined;
    }

    return parsePositiveBigInt(value);
  });

const employeeBaseSchema = z
  .object({
    name: requiredString("name"),

    email: requiredString("email").refine(
      (value) => EMAIL_REGEX.test(value),
      {
        message: "A valid email is required.",
      }
    ),

    password: requiredString("password"),

    // Changed from required to optional
    roleId: optionalPositiveBigIntField,

    personalEmail: optionalString,
    cnic: optionalString,
    designationId: optionalPositiveBigIntField,
    fatherName: optionalString,
    phone: optionalString,
    maritalStatus: optionalString,
    bloodGroup: optionalString,
    nationality: optionalString,
    religion: optionalString,
    gender: optionalString,
    address: optionalString,
    status: optionalString,
    basicSalary: z.any().optional(),
    currency: optionalString,
  })
  .superRefine((data, ctx) => {
    if (
      data.personalEmail &&
      !EMAIL_REGEX.test(data.personalEmail)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "personalEmail must be a valid email.",
      });
    }

    const salary = sanitizeNullableString(
      data.basicSalary
    );

    if (salary && Number.isNaN(Number(salary))) {
      ctx.addIssue({
        code: "custom",
        message: "basicSalary must be a valid number.",
      });
    }
  });

const qualificationSchema = z
  .object({
    degree: optionalString,
    institution: optionalString,
    startDate: z.any().optional(),
    endDate: z.any().optional(),
    isEnrolled: z.any().optional(),
  })
  .transform((item) => {
    const startDate = toNullableDate(item.startDate);
    const endDate = toNullableDate(item.endDate);

    if (
      item.startDate !== undefined && item.startDate !== null && String(item.startDate).trim() !== "" &&
      !startDate
    ) {
      throw validationError("startDate must be a valid date.");
    }

    if (
      item.endDate !== undefined && item.endDate !== null && String(item.endDate).trim() !== "" &&
      !endDate
    ) {
      throw validationError("endDate must be a valid date.");
    }

    if (startDate && endDate && endDate < startDate) {
      throw validationError("endDate must not come before startDate.");
    }

    return {
      degree: item.degree,
      institution: item.institution,
      startDate,
      endDate,
      isEnrolled:
        parseBooleanLike(item.isEnrolled) === undefined
          ? null
          : parseBooleanLike(item.isEnrolled),
    };
  });

const experienceSchema = z
  .object({
    company: optionalString,
    designation: optionalString,
    startDate: z.any().optional(),
    endDate: z.any().optional(),
    description: optionalString,
  })
  .transform((item) => {
    const startDate = toNullableDate(item.startDate);
    const endDate = toNullableDate(item.endDate);

    if (
      item.startDate !== undefined && item.startDate !== null && String(item.startDate).trim() !== "" &&
      !startDate
    ) {
      throw validationError("startDate must be a valid date.");
    }

    if (
      item.endDate !== undefined && item.endDate !== null && String(item.endDate).trim() !== "" &&
      !endDate
    ) {
      throw validationError("endDate must be a valid date.");
    }

    if (startDate && endDate && endDate < startDate) {
      throw validationError("endDate must not come before startDate.");
    }

    return {
      company: item.company,
      designation: item.designation,
      startDate,
      endDate,
      description: item.description,
    };
  });

const childSchema = z
  .object({
    name: optionalString,
    dateOfBirth: z.any().optional(),
    gender: optionalString,
  })
  .transform((item) => {
    const dateOfBirth = toNullableDate(item.dateOfBirth);

    if (
      item.dateOfBirth !== undefined &&
      item.dateOfBirth !== null &&
      String(item.dateOfBirth).trim() !== "" &&
      !dateOfBirth
    ) {
      throw validationError("dateOfBirth must be a valid date.");
    }

    return {
      name: item.name,
      dateOfBirth,
      gender: item.gender,
    };
  });

const emergencyContactSchema = z.object({
  name: optionalString,
  relationship: optionalString,
  phone: optionalString,
  address: optionalString,
});

const bankDetailSchema = z.object({
  bankName: optionalString,
  accountTitle: optionalString,
  accountNumber: optionalString,
  iban: optionalString,
  swiftCode: optionalString,
});

const documentMetadataSchema = z.object({
  documentName: requiredString("documentName"),
});

const parseNestedItems = (label, schema, value) => {
  const items = ensureArrayInput(label, value);

  return items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw validationError(`${label}[${index}] must be an object.`);
    }

    const result = schema.safeParse(item);
    if (!result.success) {
      const message = result.error.issues[0]?.message || `${label}[${index}] is invalid.`;
      throw validationError(`${label}[${index}] ${message}`);
    }

    return result.data;
  });
};

const parseDepartmentIds = (value) => {
  const items = ensureArrayInput("departmentIds", value);

  return items.map((item, index) => {
    const parsed = parsePositiveBigInt(item);
    if (!parsed) {
      throw validationError(`departmentIds[${index}] must be a valid positive integer.`);
    }
    return parsed;
  });
};

const parseDocumentMetadata = (value) => {
  const items = ensureArrayInput("documents metadata", value);

  return items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw validationError(`Document metadata at index ${index} must be an object.`);
    }

    const result = documentMetadataSchema.safeParse(item);
    if (!result.success) {
      throw validationError(`Document metadata at index ${index} requires a documentName.`);
    }

    return { documentName: result.data.documentName };
  });
};
export const validateEmployeeCreateRequest = async (
  rawData,
  files
) => {
  /*
  |--------------------------------------------------------------------------
  | 1. Parse request JSON
  |--------------------------------------------------------------------------
  */

  const parsedData = parseJson(rawData);

  if (
    !parsedData ||
    typeof parsedData !== "object" ||
    Array.isArray(parsedData)
  ) {
    throw validationError(
      "Employee data must be a valid JSON object."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | 2. Normalize employee type before schema validation
  |--------------------------------------------------------------------------
  */

  const normalizedType = String(
    parsedData.type || "EMPLOYEE"
  )
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (
    !["EMPLOYEE", "ADMIN_EMPLOYEE"].includes(
      normalizedType
    )
  ) {
    throw validationError(
      "Type must be EMPLOYEE or ADMIN_EMPLOYEE."
    );
  }

  /*
   * Normalized type ko schema input mein insert kar rahe hain.
   */
  const data = parseWithSchema(employeeBaseSchema, {
    ...parsedData,
    type: normalizedType,
  });

  const isAdminEmployee =
    normalizedType === "ADMIN_EMPLOYEE";

  /*
  |--------------------------------------------------------------------------
  | 3. Conditional roleId validation
  |--------------------------------------------------------------------------
  */

  let roleId = null;

  if (isAdminEmployee) {
    if (
      parsedData.roleId === undefined ||
      parsedData.roleId === null ||
      String(parsedData.roleId).trim() === ""
    ) {
      throw validationError(
        "A valid roleId is required for an admin employee."
      );
    }

    try {
      roleId = BigInt(parsedData.roleId);

      if (roleId <= 0n) {
        throw new Error();
      }
    } catch {
      throw validationError(
        "A valid roleId is required for an admin employee."
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | 4. Parse dates
  |--------------------------------------------------------------------------
  */

  const dateOfBirth = ensureDate(
    parsedData.dateOfBirth,
    "dateOfBirth"
  );

  const cnicExpiry = ensureDate(
    parsedData.cnicExpiry,
    "cnicExpiry"
  );

  const dateOfJoining = ensureDate(
    parsedData.dateOfJoining,
    "dateOfJoining"
  );

  /*
  |--------------------------------------------------------------------------
  | 5. Parse departments and nested records
  |--------------------------------------------------------------------------
  */

  const departmentIds = parseDepartmentIds(
    parsedData.departmentIds
  );

  const qualifications = parseNestedItems(
    "qualifications",
    qualificationSchema,
    parsedData.qualifications
  );

  const experiences = parseNestedItems(
    "experiences",
    experienceSchema,
    parsedData.experiences
  );

  const children = parseNestedItems(
    "children",
    childSchema,
    parsedData.children
  );

  const emergencyContacts = parseNestedItems(
    "emergencyContacts",
    emergencyContactSchema,
    parsedData.emergencyContacts
  );

  const bankDetails = parseNestedItems(
    "bankDetails",
    bankDetailSchema,
    parsedData.bankDetails
  );

  /*
  |--------------------------------------------------------------------------
  | 6. Validate files and metadata
  |--------------------------------------------------------------------------
  */

  const documentMetadata = parseDocumentMetadata(
    parsedData.documents
  );

  const documentFiles = files?.documents || [];

  if (
    documentMetadata.length !== documentFiles.length
  ) {
    throw validationError(
      "Document metadata count must match the number of uploaded document files."
    );
  }

  if ((files?.profile || []).length > 1) {
    throw validationError(
      "Only one profile image is allowed."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | 7. Validate related database records
  |--------------------------------------------------------------------------
  */

  const rolePromise = isAdminEmployee
    ? prisma.role.findUnique({
        where: {
          id: roleId,
        },
        select: {
          id: true,
          name: true,
        },
      })
    : Promise.resolve(null);

  const designationPromise = data.designationId
    ? prisma.designations.findUnique({
        where: {
          id: data.designationId,
        },
      })
    : Promise.resolve(null);

  const departmentsPromise = departmentIds.length
    ? prisma.departments.findMany({
        where: {
          id: {
            in: departmentIds,
          },
        },
        select: {
          id: true,
        },
      })
    : Promise.resolve([]);

  const [
    roleExists,
    designationExists,
    departmentRecords,
  ] = await Promise.all([
    rolePromise,
    designationPromise,
    departmentsPromise,
  ]);

  /*
   * Role sirf Admin Employee ke liye validate hoga.
   */
  if (isAdminEmployee && !roleExists) {
    throw validationError(
      "The provided roleId does not exist."
    );
  }

  if (
    data.designationId &&
    !designationExists
  ) {
    throw validationError(
      "The provided designationId does not exist."
    );
  }

  if (
    departmentIds.length &&
    departmentRecords.length !== departmentIds.length
  ) {
    throw validationError(
      "One or more provided departmentIds do not exist."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | 8. Check unique fields
  |--------------------------------------------------------------------------
  */

  const [
    existingUserByEmail,
    existingEmployeeByPersonalEmail,
    existingEmployeeByCnic,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: {
        email: data.email,
      },
    }),

    data.personalEmail
      ? prisma.employees.findUnique({
          where: {
            personalEmail: data.personalEmail,
          },
        })
      : null,

    data.cnic
      ? prisma.employees.findUnique({
          where: {
            cnic: data.cnic,
          },
        })
      : null,
  ]);

  if (existingUserByEmail) {
    throw validationError(
      "A user with this email already exists."
    );
  }

  if (existingEmployeeByPersonalEmail) {
    throw validationError(
      "A record with this personalEmail already exists."
    );
  }

  if (existingEmployeeByCnic) {
    throw validationError(
      "A record with this CNIC already exists."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | 9. Prepare final employee data
  |--------------------------------------------------------------------------
  */

  const profileFile =
    files?.profile?.[0] || null;

  const basicSalary = sanitizeNullableString(
    data.basicSalary
  );

  return {
    employeeData: {
      name: data.name,
      email: data.email,
      password: data.password,

      /*
       * EMPLOYEE or ADMIN_EMPLOYEE
       */
      type: normalizedType,

      /*
       * Normal employee ke liye null.
       * Admin employee ke liye selected role.
       */
      roleId,

      fatherName: data.fatherName || null,
      personalEmail: data.personalEmail || null,
      phone: data.phone || null,
      maritalStatus: data.maritalStatus || null,
      bloodGroup: data.bloodGroup || null,
      nationality: data.nationality || null,
      religion: data.religion || null,
      gender: data.gender || null,

      dateOfBirth,
      cnic: data.cnic || null,
      cnicExpiry,
      dateOfJoining,

      designationId:
        data.designationId || null,

      address: data.address || null,
      status: data.status || "active",

      basicSalary: basicSalary
        ? String(basicSalary)
        : null,

      currency: data.currency || null,

      qualifications,
      experiences,
      children,
      emergencyContacts,
      bankDetails,
      departmentIds,
    },

    profileFile,
    documentFiles,
    documentMetadata,
  };
};

export const employeeUpdateSchema = z
  .object({
    type: optionalString,

    name: optionalString,
    email: optionalString,
    password: optionalString,

    /*
     * IDs ko neeche manually parse kar rahe hain,
     * taake null/empty/update behavior properly handle ho.
     */
    roleId: z.any().optional(),
    designationId: z.any().optional(),

    personalEmail: optionalString,
    cnic: optionalString,
    fatherName: optionalString,
    phone: optionalString,
    maritalStatus: optionalString,
    bloodGroup: optionalString,
    nationality: optionalString,
    religion: optionalString,
    gender: optionalString,
    address: optionalString,
    status: optionalString,

    dateOfBirth: z.any().optional(),
    cnicExpiry: z.any().optional(),
    dateOfJoining: z.any().optional(),

    basicSalary: z.any().optional(),
    currency: optionalString,
  })
  .superRefine((data, ctx) => {
    if (data.email && !EMAIL_REGEX.test(data.email)) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid email format.",
      });
    }

    if (
      data.personalEmail &&
      !EMAIL_REGEX.test(data.personalEmail)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid personal email format.",
      });
    }

    const salary = sanitizeNullableString(
      data.basicSalary
    );

    if (
      salary !== undefined &&
      salary !== null &&
      salary !== "" &&
      Number.isNaN(Number(salary))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "basicSalary must be a number.",
      });
    }
  });

export const validateEmployeeUpdateRequest = async (
  rawData,
  files
) => {
  /*
  |--------------------------------------------------------------------------
  | 1. Parse request body
  |--------------------------------------------------------------------------
  */

  const parsedData = parseJson(rawData);

  if (
    !parsedData ||
    typeof parsedData !== "object" ||
    Array.isArray(parsedData)
  ) {
    throw validationError(
      "Employee data must be a valid JSON object."
    );
  }

  const hasField = (fieldName) =>
    Object.prototype.hasOwnProperty.call(
      parsedData,
      fieldName
    );

  /*
  |--------------------------------------------------------------------------
  | 2. Normalize employee type only when provided
  |--------------------------------------------------------------------------
  */

  let normalizedType;

  if (hasField("type")) {
    normalizedType = String(parsedData.type || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");

    if (
      !["EMPLOYEE", "ADMIN_EMPLOYEE"].includes(
        normalizedType
      )
    ) {
      throw validationError(
        "Type must be EMPLOYEE or ADMIN_EMPLOYEE."
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | 3. Parse base fields
  |--------------------------------------------------------------------------
  */

  const data = parseWithSchema(
    employeeUpdateSchema,
    {
      ...parsedData,
      ...(normalizedType !== undefined && {
        type: normalizedType,
      }),
    }
  );

  /*
  |--------------------------------------------------------------------------
  | 4. Parse roleId
  |--------------------------------------------------------------------------
  |
  | roleId omitted:
  | → current role service mein preserve hoga.
  |
  | roleId provided:
  | → valid positive BigInt hona chahiye.
  |--------------------------------------------------------------------------
  */

  let roleId;

  if (hasField("roleId")) {
    /*
     * Simple employee select hone par frontend ka old roleId
     * ignore kar sakte hain.
     */
    if (normalizedType === "EMPLOYEE") {
      roleId = undefined;
    } else {
      roleId = parsePositiveBigInt(
        parsedData.roleId
      );

      if (!roleId) {
        throw validationError(
          "A valid roleId is required."
        );
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | 5. Parse designationId
  |--------------------------------------------------------------------------
  |
  | null or empty:
  | → designation clear hoga.
  |
  | valid ID:
  | → designation update hoga.
  |--------------------------------------------------------------------------
  */

  let designationId;

  if (hasField("designationId")) {
    if (
      parsedData.designationId === null ||
      parsedData.designationId === undefined ||
      String(parsedData.designationId).trim() === ""
    ) {
      designationId = null;
    } else {
      designationId = parsePositiveBigInt(
        parsedData.designationId
      );

      if (!designationId) {
        throw validationError(
          "A valid designationId is required."
        );
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | 6. Parse dates only when provided
  |--------------------------------------------------------------------------
  */

  const dateOfBirth = hasField("dateOfBirth")
    ? ensureDate(
        parsedData.dateOfBirth,
        "dateOfBirth"
      )
    : undefined;

  const cnicExpiry = hasField("cnicExpiry")
    ? ensureDate(
        parsedData.cnicExpiry,
        "cnicExpiry"
      )
    : undefined;

  const dateOfJoining = hasField(
    "dateOfJoining"
  )
    ? ensureDate(
        parsedData.dateOfJoining,
        "dateOfJoining"
      )
    : undefined;

  /*
  |--------------------------------------------------------------------------
  | 7. Parse departments only when field is provided
  |--------------------------------------------------------------------------
  */

  const departmentsProvided =
    hasField("departmentIds");

  let departmentIds;

  if (departmentsProvided) {
    const parsedDepartmentIds =
      parseDepartmentIds(
        parsedData.departmentIds
      );

    /*
     * Remove duplicate department IDs.
     */
    departmentIds = [
      ...new Map(
        parsedDepartmentIds.map((id) => [
          id.toString(),
          id,
        ])
      ).values(),
    ];
  }

  /*
  |--------------------------------------------------------------------------
  | 8. Parse nested arrays only when provided
  |--------------------------------------------------------------------------
  |
  | Field omitted:
  | → existing records remain unchanged.
  |
  | Empty array provided:
  | → existing records will be cleared.
  |--------------------------------------------------------------------------
  */

  const qualifications = hasField(
    "qualifications"
  )
    ? parseNestedItems(
        "qualifications",
        qualificationSchema,
        parsedData.qualifications
      )
    : undefined;

  const experiences = hasField("experiences")
    ? parseNestedItems(
        "experiences",
        experienceSchema,
        parsedData.experiences
      )
    : undefined;

  const children = hasField("children")
    ? parseNestedItems(
        "children",
        childSchema,
        parsedData.children
      )
    : undefined;

  const emergencyContacts = hasField(
    "emergencyContacts"
  )
    ? parseNestedItems(
        "emergencyContacts",
        emergencyContactSchema,
        parsedData.emergencyContacts
      )
    : undefined;

  const bankDetails = hasField("bankDetails")
    ? parseNestedItems(
        "bankDetails",
        bankDetailSchema,
        parsedData.bankDetails
      )
    : undefined;

  /*
  |--------------------------------------------------------------------------
  | 9. Validate profile file
  |--------------------------------------------------------------------------
  */

  if ((files?.profile || []).length > 1) {
    throw validationError(
      "Only one profile image is allowed."
    );
  }

  const profileFile =
    files?.profile?.[0] || null;

  /*
  |--------------------------------------------------------------------------
  | 10. Parse documents
  |--------------------------------------------------------------------------
  |
  | documentsProvided true when:
  | - documents metadata field exists
  | - or document files are uploaded
  |--------------------------------------------------------------------------
  */

  const documentFiles =
    files?.documents || [];

  const documentsProvided =
    hasField("documents") ||
    documentFiles.length > 0;

  const documentMetadata = documentsProvided
    ? parseDocumentMetadata(
        parsedData.documents || []
      )
    : [];

  if (
    documentsProvided &&
    documentMetadata.length !==
      documentFiles.length
  ) {
    throw validationError(
      "Document metadata count must match the number of uploaded document files."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | 11. Validate database relations
  |--------------------------------------------------------------------------
  */

  const rolePromise = roleId
    ? prisma.role.findUnique({
        where: {
          id: roleId,
        },
        select: {
          id: true,
        },
      })
    : Promise.resolve(null);

  const designationPromise =
    designationId !== undefined &&
    designationId !== null
      ? prisma.designations.findUnique({
          where: {
            id: designationId,
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve(null);

  const departmentsPromise =
    departmentsProvided &&
    departmentIds.length > 0
      ? prisma.departments.findMany({
          where: {
            id: {
              in: departmentIds,
            },
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve([]);

  const [
    roleRecord,
    designationRecord,
    departmentRecords,
  ] = await Promise.all([
    rolePromise,
    designationPromise,
    departmentsPromise,
  ]);

  if (roleId && !roleRecord) {
    throw validationError(
      "The provided roleId does not exist."
    );
  }

  if (
    designationId !== undefined &&
    designationId !== null &&
    !designationRecord
  ) {
    throw validationError(
      "The provided designationId does not exist."
    );
  }

  if (
    departmentsProvided &&
    departmentIds.length > 0 &&
    departmentRecords.length !==
      departmentIds.length
  ) {
    throw validationError(
      "One or more provided departmentIds do not exist."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | 12. Build employee update object
  |--------------------------------------------------------------------------
  |
  | Important:
  | Sirf wahi fields return hongi jo request mein provided hain.
  | Is se omitted fields accidentally null nahi hongi.
  |--------------------------------------------------------------------------
  */

  const employeeData = {};

  if (normalizedType !== undefined) {
    employeeData.type = normalizedType;
  }

  if (hasField("name")) {
    employeeData.name = data.name;
  }

  if (hasField("email")) {
    employeeData.email = data.email;
  }

  if (hasField("password")) {
    employeeData.password = data.password;
  }

  if (roleId !== undefined) {
    employeeData.roleId = roleId;
  }

  if (hasField("personalEmail")) {
    employeeData.personalEmail =
      data.personalEmail;
  }

  if (hasField("cnic")) {
    employeeData.cnic = data.cnic;
  }

  if (designationId !== undefined) {
    employeeData.designationId =
      designationId;
  }

  if (hasField("fatherName")) {
    employeeData.fatherName =
      data.fatherName;
  }

  if (hasField("phone")) {
    employeeData.phone = data.phone;
  }

  if (hasField("maritalStatus")) {
    employeeData.maritalStatus =
      data.maritalStatus;
  }

  if (hasField("bloodGroup")) {
    employeeData.bloodGroup =
      data.bloodGroup;
  }

  if (hasField("nationality")) {
    employeeData.nationality =
      data.nationality;
  }

  if (hasField("religion")) {
    employeeData.religion =
      data.religion;
  }

  if (hasField("gender")) {
    employeeData.gender = data.gender;
  }

  if (hasField("address")) {
    employeeData.address = data.address;
  }

  if (hasField("status")) {
    employeeData.status = data.status;
  }

  if (hasField("basicSalary")) {
    const basicSalary =
      sanitizeNullableString(
        data.basicSalary
      );

    employeeData.basicSalary =
      basicSalary !== undefined &&
      basicSalary !== null &&
      basicSalary !== ""
        ? String(basicSalary)
        : null;
  }

  if (hasField("currency")) {
    employeeData.currency = data.currency;
  }

  if (dateOfBirth !== undefined) {
    employeeData.dateOfBirth =
      dateOfBirth;
  }

  if (cnicExpiry !== undefined) {
    employeeData.cnicExpiry = cnicExpiry;
  }

  if (dateOfJoining !== undefined) {
    employeeData.dateOfJoining =
      dateOfJoining;
  }

  if (qualifications !== undefined) {
    employeeData.qualifications =
      qualifications;
  }

  if (experiences !== undefined) {
    employeeData.experiences =
      experiences;
  }

  if (children !== undefined) {
    employeeData.children = children;
  }

  if (emergencyContacts !== undefined) {
    employeeData.emergencyContacts =
      emergencyContacts;
  }

  if (bankDetails !== undefined) {
    employeeData.bankDetails =
      bankDetails;
  }

  /*
  |--------------------------------------------------------------------------
  | 13. Return validation result
  |--------------------------------------------------------------------------
  */

  return {
    employeeData,

    profileFile,
    documentFiles,
    documentMetadata,

    departmentIds,
    departmentsProvided,
    documentsProvided,
  };
};