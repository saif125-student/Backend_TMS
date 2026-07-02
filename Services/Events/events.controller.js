import prisma from "../../prisma/client.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import {
	validateCreateEvent,
	validateUpdateEvent,
	validateEventId,
} from "./event.validation.js";

const eventInclude = {
	departments: {
		select: {
			id: true,
			name: true,
		},
	},
};

import { getIo } from "../../sockets/io.js";
import { safePayload } from "../../utils/chatHelpers.js";
import { getUserSocketId } from "../../sockets/onlineUsers.js";


const ensureDepartmentExists = async (departmentId) => {
	if (departmentId === undefined || departmentId === null) return;

	const department = await prisma.departments.findUnique({
		where: { id: departmentId },
		select: { id: true },
	});

	if (!department) {
		throw { status: 404, message: "Department not found." };
	}
};

export const createEvent = async (req, res) => {
	try {
		const data = validateCreateEvent(req.body);
		await ensureDepartmentExists(data.department_id);

		const now = new Date();
		const event = await prisma.events.create({
			data: {
				department_id: data.department_id,
				title: data.title,
				start: data.start,
				end: data.end,
				all_day: data.all_day ?? false,
				background_color: data.background_color,
				description: data.description,
				created_at: now,
				updated_at: now,
			},
			include: eventInclude,
		});

			const io = getIo();

		if (io) {
		const departmentEmployees = await prisma.department_employee.findMany({
			where: {
			departmentId: data.department_id,
			},
			include: {
			employee: {
				include: {
				user: {
					select: {
					id: true,
					},
				},
				},
			},
			},
		});
        console.log(departmentEmployees);
		
		for (const record of departmentEmployees) {
			const userId = record.employee?.user?.id;

			if (!userId) continue;

			const socketId = getUserSocketId(userId);

			if (!socketId) continue;

			io.to(socketId).emit(
			"event_created",
			safePayload({
				type: "EVENT_CREATED",
				title: "New Department Event",
				message: `A new event "${event.title}" has been created for your department.`,
				event,
			})
			);
		}
		}

		return successResponse(res, "Event created successfully", event, 201);
	} catch (error) {
		if (error?.status) {
			return errorResponse(res, error.message, null, error.status);
		}

		if (error?.code === "P2003") {
			return errorResponse(res, "Invalid department reference.", null, 400);
		}

		return errorResponse(res, "Failed to create event", error);
	}
};

export const getEvents = async (req, res) => {
	try {
		const events = await prisma.events.findMany({
			include: eventInclude,
			orderBy: { id: "desc" },
		});

		return successResponse(res, "Events fetched successfully", events);
	} catch (error) {
		return errorResponse(res, "Failed to fetch events", error);
	}
};

export const getEventById = async (req, res) => {
	try {
		const eventId = validateEventId(req.params.id);

		const event = await prisma.events.findUnique({
			where: { id: eventId },
			include: eventInclude,
		});

		if (!event) {
			return errorResponse(res, "Event not found", null, 404);
		}

		return successResponse(res, "Event fetched successfully", event);
	} catch (error) {
		if (error?.status) {
			return errorResponse(res, error.message, null, error.status);
		}

		return errorResponse(res, "Failed to fetch event", error);
	}
};

export const updateEvent = async (req, res) => {
	try {
		const { eventId, data } = validateUpdateEvent(req.params.id, req.body);

		const existing = await prisma.events.findUnique({
			where: { id: eventId },
			select: { id: true },
		});

		if (!existing) {
			return errorResponse(res, "Event not found", null, 404);
		}

		if (Object.prototype.hasOwnProperty.call(data, "department_id")) {
			await ensureDepartmentExists(data.department_id);
		}

		const event = await prisma.events.update({
			where: { id: eventId },
			data: {
				...(data.department_id !== undefined && { department_id: data.department_id }),
				...(data.title !== undefined && { title: data.title }),
				...(data.start !== undefined && { start: data.start }),
				...(data.end !== undefined && { end: data.end }),
				...(data.all_day !== undefined && { all_day: data.all_day }),
				...(data.background_color !== undefined && { background_color: data.background_color }),
				...(data.description !== undefined && { description: data.description }),
				updated_at: new Date(),
			},
			include: eventInclude,
		});

		return successResponse(res, "Event updated successfully", event);
	} catch (error) {
		if (error?.status) {
			return errorResponse(res, error.message, null, error.status);
		}

		if (error?.code === "P2025") {
			return errorResponse(res, "Event not found", null, 404);
		}

		if (error?.code === "P2003") {
			return errorResponse(res, "Invalid department reference.", null, 400);
		}

		return errorResponse(res, "Failed to update event", error);
	}
};

export const deleteEvent = async (req, res) => {
	try {
		const eventId = validateEventId(req.params.id);

		await prisma.events.delete({
			where: { id: eventId },
		});

		return successResponse(res, "Event deleted successfully");
	} catch (error) {
		if (error?.status) {
			return errorResponse(res, error.message, null, error.status);
		}

		if (error?.code === "P2025") {
			return errorResponse(res, "Event not found", null, 404);
		}

		return errorResponse(res, "Failed to delete event", error);
	}
};

export const getEventsByDepartment = async (req, res) => {
	try {
		let departmentId;
		try {
			departmentId = BigInt(req.params.id);
		} catch (e) {
			return errorResponse(res, "Invalid department ID", null, 400);
		}

		const events = await prisma.events.findMany({
			where: { department_id: departmentId },
			include: eventInclude,
			orderBy: { id: "desc" },
		});

		return successResponse(res, "Events fetched successfully", events);
	} catch (error) {
		return errorResponse(res, "Failed to fetch events", error);
	}
};
