import prisma from "../../prisma/client.js";
import {
  successResponse,
  errorResponse,
} from "../../utils/response.js";
import {
  validateCreateHoliday,
  validateUpdateHoliday,
  validateHolidayId,
  validateHolidayIds,
} from "./holidays.validation.js";

const handleHolidayError = (res, error, defaultMessage) => {
  if (error?.status) {
    return errorResponse(
      res,
      error.message,
      null,
      error.status
    );
  }

  if (error?.code === "P2002") {
    return errorResponse(
      res,
      "A holiday with the same start date or end date already exists.",
      null,
      409
    );
  }

  if (error?.code === "P2025") {
    return errorResponse(
      res,
      "Holiday not found",
      null,
      404
    );
  }

  return errorResponse(res, defaultMessage, error);
};

export const createHoliday = async (req, res) => {
  try {
    const {
      name,
      startDate,
      endDate,
      remarks,
    } = validateCreateHoliday(req.body);

    const now = new Date();

    const holiday = await prisma.holidays.create({
      data: {
        name,
        start_date: startDate,
        end_date: endDate,
        remarks,
        created_at: now,
        updated_at: now,
      },
    });

    return successResponse(
      res,
      "Holiday created successfully",
      holiday,
      201
    );
  } catch (error) {
    return handleHolidayError(
      res,
      error,
      "Failed to create holiday"
    );
  }
};

export const getHolidays = async (req, res) => {
  try {
    const holidays = await prisma.holidays.findMany({
      orderBy: [
        {
          start_date: "asc",
        },
        {
          id: "desc",
        },
      ],
    });

    return successResponse(
      res,
      "Holidays fetched successfully",
      holidays
    );
  } catch (error) {
    return handleHolidayError(
      res,
      error,
      "Failed to fetch holidays"
    );
  }
};

export const getHolidayById = async (req, res) => {
  try {
    const holidayId = validateHolidayId(req.params.id);

    const holiday = await prisma.holidays.findUnique({
      where: {
        id: holidayId,
      },
    });

    if (!holiday) {
      return errorResponse(
        res,
        "Holiday not found",
        null,
        404
      );
    }

    return successResponse(
      res,
      "Holiday fetched successfully",
      holiday
    );
  } catch (error) {
    return handleHolidayError(
      res,
      error,
      "Failed to fetch holiday"
    );
  }
};

export const updateHoliday = async (req, res) => {
  try {
    const {
      holidayId,
      data,
    } = validateUpdateHoliday(req.params.id, req.body);

    const existingHoliday = await prisma.holidays.findUnique({
      where: {
        id: holidayId,
      },
    });

    if (!existingHoliday) {
      return errorResponse(
        res,
        "Holiday not found",
        null,
        404
      );
    }

    const startDate =
      data.startDate ?? existingHoliday.start_date;

    const endDate =
      data.endDate ?? existingHoliday.end_date;

    if (endDate < startDate) {
      return errorResponse(
        res,
        "endDate cannot be earlier than startDate.",
        null,
        400
      );
    }

    const holiday = await prisma.holidays.update({
      where: {
        id: holidayId,
      },
      data: {
        ...(data.name !== undefined && {
          name: data.name,
        }),
        ...(data.startDate !== undefined && {
          start_date: data.startDate,
        }),
        ...(data.endDate !== undefined && {
          end_date: data.endDate,
        }),
        ...(data.remarks !== undefined && {
          remarks: data.remarks,
        }),
        updated_at: new Date(),
      },
    });

    return successResponse(
      res,
      "Holiday updated successfully",
      holiday
    );
  } catch (error) {
    return handleHolidayError(
      res,
      error,
      "Failed to update holiday"
    );
  }
};

export const deleteHolidays = async (req, res) => {
  console.log("Body:", req.body);
console.log("ids:", req.body?.ids);
console.log("isArray:", Array.isArray(req.body?.ids));
  try {
    const holidayIds = validateHolidayIds(req.body);

    const result = await prisma.holidays.deleteMany({
      where: {
        id: {
          in: holidayIds,
        },
      },
    });

    if (result.count === 0) {
      return errorResponse(
        res,
        "No matching holidays were found",
        null,
        404
      );
    }

    return successResponse(
      res,
      `${result.count} holiday(s) deleted successfully`,
      {
        requested: holidayIds.length,
        deleted: result.count,
      }
    );
  } catch (error) {
    return handleHolidayError(
      res,
      error,
      "Failed to delete holidays"
    );
  }
};