const sanitizeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const parseBigInt = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const candidate = String(value).trim();

  if (!/^[1-9][0-9]*$/.test(candidate)) {
    return undefined;
  }

  return BigInt(candidate);
};

const parseDateOnly = (value) => {
  if (typeof value !== "string") return undefined;

  const candidate = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(candidate);

  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  // Prevent values such as 2026-02-30 being converted to March.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return date;
};

const hasField = (body, field) =>
  Object.prototype.hasOwnProperty.call(body, field);

export const validateCreateHoliday = (body = {}) => {
  const name = sanitizeString(body.name);
  const startDate = parseDateOnly(body.startDate);
  const endDate = parseDateOnly(body.endDate);
  const remarks = sanitizeString(body.remarks);

  const errors = [];

  if (!name) {
    errors.push("name is required.");
  }

  if (name.length > 255) {
    errors.push("name must not exceed 255 characters.");
  }

  if (!startDate) {
    errors.push("startDate must use YYYY-MM-DD format.");
  }

  if (!endDate) {
    errors.push("endDate must use YYYY-MM-DD format.");
  }

  if (remarks.length > 255) {
    errors.push("remarks must not exceed 255 characters.");
  }

  if (startDate && endDate && endDate < startDate) {
    errors.push("endDate cannot be earlier than startDate.");
  }

  if (errors.length) {
    throw {
      status: 400,
      message: errors.join(" "),
    };
  }

  return {
    name,
    startDate,
    endDate,
    remarks: remarks || undefined,
  };
};

export const validateUpdateHoliday = (id, body = {}) => {
  const holidayId = parseBigInt(id);

  if (!holidayId) {
    throw {
      status: 400,
      message: "A valid holiday id is required.",
    };
  }

  const allowedFields = [
    "name",
    "startDate",
    "endDate",
    "remarks",
  ];

  const hasUpdate = allowedFields.some((field) =>
    hasField(body, field)
  );

  if (!hasUpdate) {
    throw {
      status: 400,
      message: "At least one field is required to update the holiday.",
    };
  }

  const data = {};

  if (hasField(body, "name")) {
    const name = sanitizeString(body.name);

    if (!name) {
      throw {
        status: 400,
        message: "name cannot be empty.",
      };
    }

    if (name.length > 255) {
      throw {
        status: 400,
        message: "name must not exceed 255 characters.",
      };
    }

    data.name = name;
  }

  if (hasField(body, "startDate")) {
    const startDate = parseDateOnly(body.startDate);

    if (!startDate) {
      throw {
        status: 400,
        message: "startDate must use YYYY-MM-DD format.",
      };
    }

    data.startDate = startDate;
  }

  if (hasField(body, "endDate")) {
    const endDate = parseDateOnly(body.endDate);

    if (!endDate) {
      throw {
        status: 400,
        message: "endDate must use YYYY-MM-DD format.",
      };
    }

    data.endDate = endDate;
  }

  if (hasField(body, "remarks")) {
    const remarks = sanitizeString(body.remarks);

    if (remarks.length > 255) {
      throw {
        status: 400,
        message: "remarks must not exceed 255 characters.",
      };
    }

    data.remarks = remarks || null;
  }

  return {
    holidayId,
    data,
  };
};

export const validateHolidayId = (id) => {
  const holidayId = parseBigInt(id);

  if (!holidayId) {
    throw {
      status: 400,
      message: "A valid holiday id is required.",
    };
  }

  return holidayId;
};

export const validateHolidayIds = (body = {}) => {
  if (!Array.isArray(body.ids)) {
    throw {
      status: 400,
      message: "ids must be an array.",
    };
  }

  if (body.ids.length === 0) {
    throw {
      status: 400,
      message: "At least one holiday id is required.",
    };
  }

  if (body.ids.length > 500) {
    throw {
      status: 400,
      message: "A maximum of 500 holidays can be deleted at once.",
    };
  }

  const ids = body.ids.map(parseBigInt);

  if (ids.some((id) => !id)) {
    throw {
      status: 400,
      message: "Every holiday id must be a valid positive integer.",
    };
  }

  // Remove duplicate IDs.
  return [...new Map(ids.map((id) => [id.toString(), id])).values()];
};