import express from "express";
import {
	createEvent,
	getEvents,
	getEventById,
	updateEvent,
	deleteEvent,
	getEventsByDepartment,
} from "./events.controller.js";
import { authenticateToken, authorize } from "../../utils/auth.js";

const router = express.Router();

router.post("/", authenticateToken, authorize("event.create"), createEvent);
router.get("/", authenticateToken, authorize("event.view"), getEvents);
router.get("/:id", authenticateToken, authorize("event.view"), getEventById);
router.get("/department/:id", authenticateToken, authorize("event.view"), getEventsByDepartment);
router.put("/:id", authenticateToken, authorize("event.edit"), updateEvent);
router.delete("/:id", authenticateToken, authorize("event.delete"), deleteEvent);

export default router;
