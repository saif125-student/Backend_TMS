import {
  z,
  parseWithSchema,
  parsePositiveBigInt,
  parseBooleanLike,
  parseDateLike,
  sanitizeString,
} from "../../utils/zodValidation.js";

const eventIdSchema = z
  .any()
  .transform((value) => parsePositiveBigInt(value))
  .refine((value) => value !== undefined, {
    message: "A valid event id is required.",
  });

const createTitleSchema = z
  .any()
  .transform((value) => sanitizeString(value))
  .refine((value) => Boolean(value), {
    message: "title is required.",
  })
  .refine((value) => value.length <= 255, {
    message: "title must not exceed 255 characters.",
  });

const getField = (body, names) => {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(body, name)) {
      return body[name];
    }
  }

  return undefined;
};

const hasField = (body, names) =>
  names.some((name) => Object.prototype.hasOwnProperty.call(body, name));

const parseNullableBigInt = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = parsePositiveBigInt(value);
  if (!parsed) {
    throw { status: 400, message: "A valid departmentId is required." };
  }

  return parsed;
};

const parseNullableDate = (value, label) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = parseDateLike(value);
  if (!parsed) {
    throw { status: 400, message: `${label} must be a valid date.` };
  }

  return parsed;
};

const parseNullableText = (value, label) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = sanitizeString(value);
  if (label === "backgroundColor" && parsed.length > 255) {
    throw { status: 400, message: "backgroundColor must not exceed 255 characters." };
  }

  return parsed;
};

const parseEventData = (body, { partial = false } = {}) => {
  const departmentId = parseNullableBigInt(getField(body, ["departmentId", "department_id"]));
  const hasDepartmentId = hasField(body, ["departmentId", "department_id"]);

  const titleValue = getField(body, ["title"]);
  const hasTitle = hasField(body, ["title"]);
  const title = hasTitle ? parseWithSchema(createTitleSchema, titleValue) : undefined;

  const start = parseNullableDate(getField(body, ["start"]), "start");
  const end = parseNullableDate(getField(body, ["end"]), "end");
  const hasStart = hasField(body, ["start"]);
  const hasEnd = hasField(body, ["end"]);

  if (!partial && !hasTitle) {
    throw { status: 400, message: "title is required." };
  }

  if (!partial && !hasTitle && title === undefined) {
    throw { status: 400, message: "title is required." };
  }

  if (hasStart && start === undefined) {
    throw { status: 400, message: "start must be a valid date." };
  }

  if (hasEnd && end === undefined) {
    throw { status: 400, message: "end must be a valid date." };
  }

  if (start && end && end < start) {
    throw { status: 400, message: "end must not be earlier than start." };
  }

  const hasAllDay = hasField(body, ["allDay", "all_day"]);
  const allDayValue = getField(body, ["allDay", "all_day"]);
  const allDay = hasAllDay ? parseBooleanLike(allDayValue) : undefined;

  if (hasAllDay && allDay === undefined) {
    throw { status: 400, message: "allDay must be true or false." };
  }

  const backgroundColor = parseNullableText(
    getField(body, ["backgroundColor", "background_color"]),
    "backgroundColor"
  );
  const hasBackgroundColor = hasField(body, ["backgroundColor", "background_color"]);

  const description = parseNullableText(getField(body, ["description"]), "description");
  const hasDescription = hasField(body, ["description"]);

  const data = {};

  if (hasDepartmentId) {
    data.department_id = departmentId;
  }

  if (hasTitle) {
    data.title = title;
  }

  if (hasStart) {
    data.start = start;
  }

  if (hasEnd) {
    data.end = end;
  }

  if (hasAllDay) {
    data.all_day = allDay;
  }

  if (hasBackgroundColor) {
    data.background_color = backgroundColor;
  }

  if (hasDescription) {
    data.description = description;
  }

  return data;
};

export const validateCreateEvent = (body = {}) => {
  return parseEventData(body, { partial: false });
};

export const validateUpdateEvent = (id, body = {}) => {
  const eventId = parseWithSchema(eventIdSchema, id);

  if (!hasField(body, ["departmentId", "department_id", "title", "start", "end", "allDay", "all_day", "backgroundColor", "background_color", "description"])) {
    throw { status: 400, message: "At least one field is required to update the event." };
  }

  return {
    eventId,
    data: parseEventData(body, { partial: true }),
  };
};

export const validateEventId = (id) => parseWithSchema(eventIdSchema, id);