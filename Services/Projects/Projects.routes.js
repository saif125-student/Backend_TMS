import express from "express";
import {
  createProject,
  getProjects,
  updateProject,
  deleteProject,
} from "./projects.controller.js";
import {
  authenticateToken,
  authorize,
} from "../../utils/auth.js";

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  authorize("project.create"),
  createProject
);

router.get(
  "/",
  authenticateToken,
  authorize("project.view"),
  getProjects
);

router.put(
  "/:id",
  authenticateToken,
  authorize("project.edit"),
  updateProject
);

router.delete(
  "/:id",
  authenticateToken,
  authorize("project.delete"),
  deleteProject
);

export default router;