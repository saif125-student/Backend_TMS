import express from "express";
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTaskOptions,
  updateTaskStatus,
  getTasksByEmployeeId,
  getTasksByAssignerId,
  getTasksByProjectId,  
} from "./task.controller.js";
import {
  authenticateToken,
  authorize,
} from "../../utils/auth.js";

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  authorize("task.create"),
  createTask
);

router.get(
  "/options",
  authenticateToken,
  authorize("task.view"),
  getTaskOptions
);

router.get(
  "/employee/:employeeId",
  authenticateToken,
  authorize("task.view"),
  getTasksByEmployeeId
);

router.get(
  "/assigner/:assignerId",
  authenticateToken,
  authorize("task.view"),
  getTasksByAssignerId
);

router.get(
  "/project/:projectId",
  authenticateToken,
  authorize("task.view"),
  getTasksByProjectId
);

router.get(
  "/",
  authenticateToken,
  authorize("task.view"),
  getTasks
);

router.get(
  "/:id",
  authenticateToken,
  authorize("task.view"),
  getTaskById
);

router.patch(
  "/:id/status",
  authenticateToken,
  authorize("task.edit"),
  updateTaskStatus
);

router.put(
  "/:id",
  authenticateToken,
  authorize("task.edit"),
  updateTask
);

router.delete(
  "/:id",
  authenticateToken,
  authorize("task.delete"),
  deleteTask
);


export default router;