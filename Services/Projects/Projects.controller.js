import prisma from "../../prisma/client.js";
import {
  successResponse,
  errorResponse,
} from "../../utils/response.js";
import {
  validateCreateProject,
  validateUpdateProject,
  validateProjectId,
} from "./Projects.validation.js";

export const createProject = async (req, res) => {
  try {
    const { name, description } = validateCreateProject(req.body);

    const now = new Date();

    const project = await prisma.projects.create({
      data: {
        name,
        description,
        created_at: now,
        updated_at: now,
      },
    });

    return successResponse(
      res,
      "Project created successfully",
      project,
      201
    );
  } catch (error) {
    if (error?.status) {
      return errorResponse(
        res,
        error.message,
        null,
        error.status
      );
    }

    return errorResponse(res, "Failed to create project", error);
  }
};

export const getProjects = async (req, res) => {
  try {
    const projects = await prisma.projects.findMany({
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    return successResponse(
      res,
      "Projects fetched successfully",
      projects
    );
  } catch (error) {
    return errorResponse(res, "Failed to fetch projects", error);
  }
};

export const updateProject = async (req, res) => {
  try {
    const {
      projectId,
      name,
      description,
    } = validateUpdateProject(req.params.id, req.body);

    const project = await prisma.projects.update({
      where: {
        id: projectId,
      },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        updated_at: new Date(),
      },
    });

    return successResponse(
      res,
      "Project updated successfully",
      project
    );
  } catch (error) {
    if (error?.status) {
      return errorResponse(
        res,
        error.message,
        null,
        error.status
      );
    }

    if (error?.code === "P2025") {
      return errorResponse(
        res,
        "Project not found",
        null,
        404
      );
    }

    return errorResponse(res, "Failed to update project", error);
  }
};

export const deleteProject = async (req, res) => {
  try {
    const projectId = validateProjectId(req.params.id);

    await prisma.projects.delete({
      where: {
        id: projectId,
      },
    });

    return successResponse(
      res,
      "Project deleted successfully"
    );
  } catch (error) {
    if (error?.status) {
      return errorResponse(
        res,
        error.message,
        null,
        error.status
      );
    }

    if (error?.code === "P2025") {
      return errorResponse(
        res,
        "Project not found",
        null,
        404
      );
    }

    return errorResponse(res, "Failed to delete project", error);
  }
};