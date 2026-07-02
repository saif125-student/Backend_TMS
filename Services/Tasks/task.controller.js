import prisma from "../../prisma/client.js";
import {
  successResponse,
  errorResponse,
} from "../../utils/response.js";
import {
  validateCreateTask,
  validateUpdateTask,
  validateTaskId,
  validateOptionsDepartmentId,
} from "./task.validation.js";

import { getIo } from "../../sockets/io.js";
import { getUserSocketId } from "../../sockets/onlineUsers.js";
import { safePayload } from "../../utils/chatHelpers.js";

const taskInclude = {
  projects: {
    select: {
      id: true,
      name: true,
    },
  },
  departments: {
    select: {
      id: true,
      name: true,
    },
  },
  employees: {
    select: {
      id: true,
      profile: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  assigner: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  work_details: true,
};

const getAuthenticatedUserId = (req) => {
  const value = req.user?.id ?? req.user?.userId;

  if (!value) return null;

  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

const validateTaskRelations = async ({
  projectId,
  departmentId,
  employeeId,
}) => {
  const [project, department, employee, membership] =
    await Promise.all([
      prisma.projects.findUnique({
        where: { id: projectId },
        select: { id: true },
      }),
      prisma.departments.findUnique({
        where: { id: departmentId },
        select: { id: true },
      }),
      prisma.employees.findUnique({
        where: { id: employeeId },
        select: { id: true },
      }),
      prisma.department_employee.findFirst({
        where: {
          departmentId,
          employeeId,
        },
        select: { id: true },
      }),
    ]);

  if (!project) {
    throw {
      status: 404,
      message: "Project not found.",
    };
  }

  if (!department) {
    throw {
      status: 404,
      message: "Department not found.",
    };
  }

  if (!employee) {
    throw {
      status: 404,
      message: "Employee not found.",
    };
  }

  if (!membership) {
    throw {
      status: 400,
      message: "The selected employee does not belong to this department.",
    };
  }
};

const handleControllerError = (
  res,
  error,
  defaultMessage
) => {
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
      "Task not found",
      null,
      404
    );
  }

  if (error?.code === "P2003") {
    return errorResponse(
      res,
      "Invalid project, department, employee, or assigner reference.",
      null,
      400
    );
  }

  return errorResponse(res, defaultMessage, error);
};

export const createTask = async (req, res) => {
  try {
    const {
      name,
      description,
      projectId,
      departmentId,
      employeeId,
      hours,
      minutes,
    } = validateCreateTask(req.body);

    await validateTaskRelations({
      projectId,
      departmentId,
      employeeId,
    });

    const assignerId = getAuthenticatedUserId(req);
    const now = new Date();

        const task = await prisma.tasks.create({
      data: {
        name,
        description,
        project_id: projectId,
        department_id: departmentId,
        employee_id: employeeId,
        assigner_id: assignerId,
        hours,
        minutes,
        status: "Pending",
        created_at: now,
        updated_at: now,
      },
      include: taskInclude,
    });

    const assignedUserId = task.employees?.user?.id;

    const io = getIo();

    if (io && assignedUserId) {
      const assignedSocketId = getUserSocketId(assignedUserId);

      if (assignedSocketId) {
        io.to(assignedSocketId).emit(
          "task_assigned",
          safePayload({
            type: "TASK_ASSIGNED",
            title: "New Task Assigned",
            message: `You have been assigned a new task: ${task.name}`,
            task,
          })
        );
      }
    }

    return successResponse(
      res,
      "Task created successfully",
      task,
      201
    );
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to create task"
    );
  }
};

export const getTasks = async (req, res) => {
  try {
    const tasks = await prisma.tasks.findMany({
      include: taskInclude,
      orderBy: {
        id: "desc",
      },
    });

    return successResponse(
      res,
      "Tasks fetched successfully",
      tasks
    );
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to fetch tasks"
    );
  }
};

export const getTaskById = async (req, res) => {
  try {
    const taskId = validateTaskId(req.params.id);

    const task = await prisma.tasks.findUnique({
      where: {
        id: taskId,
      },
      include: taskInclude,
    });

    if (!task) {
      return errorResponse(
        res,
        "Task not found",
        null,
        404
      );
    }

    return successResponse(
      res,
      "Task fetched successfully",
      task
    );
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to fetch task"
    );
  }
};

export const updateTask = async (req, res) => {
  try {
    const { taskId, data } = validateUpdateTask(
      req.params.id,
      req.body
    );

    const existingTask = await prisma.tasks.findUnique({
      where: {
        id: taskId,
      },
    });

    if (!existingTask) {
      return errorResponse(
        res,
        "Task not found",
        null,
        404
      );
    }

    const projectId =
      data.projectId ?? existingTask.project_id;

    const departmentId =
      data.departmentId ?? existingTask.department_id;

    const employeeId =
      data.employeeId ?? existingTask.employee_id;

    await validateTaskRelations({
      projectId,
      departmentId,
      employeeId,
    });

    const task = await prisma.tasks.update({
      where: {
        id: taskId,
      },
      data: {
        ...(data.name !== undefined && {
          name: data.name,
        }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.projectId !== undefined && {
          project_id: data.projectId,
        }),
        ...(data.departmentId !== undefined && {
          department_id: data.departmentId,
        }),
        ...(data.employeeId !== undefined && {
          employee_id: data.employeeId,
        }),
        ...(data.hours !== undefined && {
          hours: data.hours,
        }),
        ...(data.minutes !== undefined && {
          minutes: data.minutes,
        }),
        ...(data.status !== undefined && {
          status: data.status,
        }),
        updated_at: new Date(),
      },
      include: taskInclude,
    });

    return successResponse(
      res,
      "Task updated successfully",
      task
    );
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to update task"
    );
  }
};

export const updateTaskStatus = async (req, res) => {
  try {
    const { taskId, status } = validateUpdateTaskStatus(
      req.params.id,
      req.body
    );

    const task = await prisma.tasks.update({
      where: {
        id: taskId,
      },
      data: {
        status,
        updated_at: new Date(),
      },
      include: taskInclude,
    });

    return successResponse(
      res,
      "Task status updated successfully",
      task
    );
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to update task status"
    );
  }
};

export const deleteTask = async (req, res) => {
  try {
    const taskId = validateTaskId(req.params.id);

    await prisma.tasks.delete({
      where: {
        id: taskId,
      },
    });

    return successResponse(
      res,
      "Task deleted successfully"
    );
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to delete task"
    );
  }
};

export const getTaskOptions = async (req, res) => {
  try {
    const departmentId = validateOptionsDepartmentId(
      req.query.departmentId
    );

    const [projects, departments, employees] =
      await Promise.all([
        prisma.projects.findMany({
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name: "asc",
          },
        }),
        prisma.departments.findMany({
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name: "asc",
          },
        }),
        prisma.employees.findMany({
          where: departmentId
            ? {
                departments: {
                  some: {
                    departmentId,
                  },
                },
              }
            : undefined,
          select: {
            id: true,
            profile: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            id: "desc",
          },
        }),
      ]);

    return successResponse(
      res,
      "Task options fetched successfully",
      {
        projects,
        departments,
        employees,
        statuses: [
          "Pending",
          "In_Progress",
          "Completed",
        ],
      }
    );
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to fetch task options"
    );
  }
};

export const getTasksByEmployeeId = async (req, res) => {
  try {
    const employeeId = validateEmployeeId(
      req.params.employeeId
    );

    const employee = await prisma.employees.findUnique({
      where: {
        id: employeeId,
      },
      select: {
        id: true,
      },
    });

    if (!employee) {
      return errorResponse(
        res,
        "Employee not found",
        null,
        404
      );
    }

    const tasks = await prisma.tasks.findMany({
      where: {
        employee_id: employeeId,
      },
      include: taskInclude,
      orderBy: {
        id: "desc",
      },
    });

    return successResponse(
      res,
      "Employee tasks fetched successfully",
      tasks
    );
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to fetch employee tasks"
    );
  }
};

export const getTasksByAssignerId = async (req, res) => {
  try {
    const assignerId = validateAssignerId(
      req.params.assignerId
    );

    const assigner = await prisma.user.findUnique({
      where: {
        id: assignerId,
      },
      select: {
        id: true,
      },
    });

    if (!assigner) {
      return errorResponse(
        res,
        "Assigner not found",
        null,
        404
      );
    }

    const tasks = await prisma.tasks.findMany({
      where: {
        assigner_id: assignerId,
      },
      include: taskInclude,
      orderBy: {
        id: "desc",
      },
    });

    return successResponse(
      res,
      "Assigned tasks fetched successfully",
      tasks
    );
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to fetch tasks by assigner"
    );
  }
};

export const getTasksByProjectId = async (req, res) => {
  try {
    const projectId = validateProjectId(
      req.params.projectId
    );

    const project = await prisma.projects.findUnique({
      where: {
        id: projectId,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      return errorResponse(
        res,
        "Project not found",
        null,
        404
      );
    }

    const tasks = await prisma.tasks.findMany({
      where: {
        project_id: projectId,
      },
      include: taskInclude,
      orderBy: {
        id: "desc",
      },
    });

    return successResponse(
      res,
      "Project tasks fetched successfully",
      tasks
    );
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to fetch project tasks"
    );
  }
};