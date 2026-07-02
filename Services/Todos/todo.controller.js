import prisma from "../../prisma/client.js";
import {
  successResponse,
  errorResponse,
} from "../../utils/response.js";
import {
  validateCreateTodo,
  validateUpdateTodo,
  validateTodoId,
  validateEmployeeId,
  validateTodoCompletion,
  validateTodoFilters,
  getTodoPriorities,
} from "./todo.validation.js";

import { getIo } from "../../sockets/io.js";
import { getUserSocketId } from "../../sockets/onlineUsers.js";
import { safePayload } from "../../utils/chatHelpers.js";

const todoInclude = {
  employees: {
    select: {
      id: true,
      profile: true,
      status: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
};

const handleTodoError = (res, error, defaultMessage) => {
  if (error?.status) {
    return errorResponse(
      res,
      error.message,
      null,
      error.status
    );
  }

  if (error?.code === "P2025") {
    return errorResponse(res, "Todo not found", null, 404);
  }

  if (error?.code === "P2003") {
    return errorResponse(
      res,
      "Invalid employee reference",
      null,
      400
    );
  }

  return errorResponse(res, defaultMessage, error);
};

const ensureEmployeeExists = async (employeeId) => {
  const employee = await prisma.employees.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
    },
  });

  if (!employee) {
    throw {
      status: 404,
      message: "Employee not found.",
    };
  }
};

export const createTodo = async (req, res) => {
  try {
    const {
      employeeId,
      title,
      description,
      dueTime,
      priority,
      sortOrder,
    } = validateCreateTodo(req.body);

    await ensureEmployeeExists(employeeId);
    const authUserId = req.user?.id ?? req.user?.userId;
    console.log("authUserId:", authUserId);
    const now = new Date();

    const todo = await prisma.todos.create({
      data: {
        employee_id: employeeId,
        title,
        description,
        due_time: dueTime,
        priority,
        sort_order: sortOrder,
        is_completed: false,
        created_at: now,
        updated_at: now,
      },
      include: todoInclude,
    });

       const assignedUserId = todo.employees?.user?.id;
      const io = getIo();

      if (
        io &&
        assignedUserId &&
        authUserId &&
        assignedUserId.toString() !== authUserId.toString()
      ) {
        const assignedSocketId = getUserSocketId(assignedUserId);

        if (assignedSocketId) {
          io.to(assignedSocketId).emit(
            "todo_assigned",
            safePayload({
              type: "TODO_ASSIGNED",
              title: "New Todo Assigned",
              message: `You have been assigned a new todo: ${todo.title}`,
              todo,
            })
          );
        }
      }

    return successResponse(
      res,
      "Todo created successfully",
      todo,
      201
    );
  } catch (error) {
    return handleTodoError(
      res,
      error,
      "Failed to create todo"
    );
  }
};



export const getTodos = async (req, res) => {
  try {
    const filters = validateTodoFilters(req.query);

    const todos = await prisma.todos.findMany({
      where: filters,
      include: todoInclude,
      orderBy: [
        {
          sort_order: "asc",
        },
        {
          id: "desc",
        },
      ],
    });

    return successResponse(
      res,
      "Todos fetched successfully",
      todos
    );
  } catch (error) {
    return handleTodoError(
      res,
      error,
      "Failed to fetch todos"
    );
  }
};

export const getTodoById = async (req, res) => {
  try {
    const todoId = validateTodoId(req.params.id);

    const todo = await prisma.todos.findUnique({
      where: {
        id: todoId,
      },
      include: todoInclude,
    });

    if (!todo) {
      return errorResponse(
        res,
        "Todo not found",
        null,
        404
      );
    }

    return successResponse(
      res,
      "Todo fetched successfully",
      todo
    );
  } catch (error) {
    return handleTodoError(
      res,
      error,
      "Failed to fetch todo"
    );
  }
};

export const getTodosByEmployeeId = async (req, res) => {
  try {
    const employeeId = validateEmployeeId(
      req.params.employeeId
    );

    await ensureEmployeeExists(employeeId);

    const todos = await prisma.todos.findMany({
      where: {
        employee_id: employeeId,
      },
      include: todoInclude,
      orderBy: [
        {
          is_completed: "asc",
        },
        {
          sort_order: "asc",
        },
        {
          id: "desc",
        },
      ],
    });

    return successResponse(
      res,
      "Employee todos fetched successfully",
      todos
    );
  } catch (error) {
    return handleTodoError(
      res,
      error,
      "Failed to fetch employee todos"
    );
  }
};

export const updateTodo = async (req, res) => {
  try {
    const { todoId, data } = validateUpdateTodo(
      req.params.id,
      req.body
    );

    if (data.employeeId !== undefined) {
      await ensureEmployeeExists(data.employeeId);
    }

    const todo = await prisma.todos.update({
      where: {
        id: todoId,
      },
      data: {
        ...(data.employeeId !== undefined && {
          employee_id: data.employeeId,
        }),
        ...(data.title !== undefined && {
          title: data.title,
        }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.dueTime !== undefined && {
          due_time: data.dueTime,
        }),
        ...(data.priority !== undefined && {
          priority: data.priority,
        }),
        ...(data.sortOrder !== undefined && {
          sort_order: data.sortOrder,
        }),
        ...(data.isCompleted !== undefined && {
          is_completed: data.isCompleted,
        }),
        updated_at: new Date(),
      },
      include: todoInclude,
    });

    return successResponse(
      res,
      "Todo updated successfully",
      todo
    );
  } catch (error) {
    return handleTodoError(
      res,
      error,
      "Failed to update todo"
    );
  }
};

export const updateTodoCompletion = async (req, res) => {
  try {
    const { todoId, isCompleted } =
      validateTodoCompletion(req.params.id, req.body);

    const todo = await prisma.todos.update({
      where: {
        id: todoId,
      },
      data: {
        is_completed: isCompleted,
        updated_at: new Date(),
      },
      include: todoInclude,
    });

    return successResponse(
      res,
      isCompleted
        ? "Todo marked as completed"
        : "Todo marked as pending",
      todo
    );
  } catch (error) {
    return handleTodoError(
      res,
      error,
      "Failed to update todo completion"
    );
  }
};

export const deleteTodo = async (req, res) => {
  try {
    const todoId = validateTodoId(req.params.id);

    await prisma.todos.delete({
      where: {
        id: todoId,
      },
    });

    return successResponse(
      res,
      "Todo deleted successfully"
    );
  } catch (error) {
    return handleTodoError(
      res,
      error,
      "Failed to delete todo"
    );
  }
};

export const getTodoOptions = async (req, res) => {
  try {
    const employees = await prisma.employees.findMany({
      where: {
        status: "active",
      },
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
    });

    return successResponse(
      res,
      "Todo options fetched successfully",
      {
        employees,
        priorities: getTodoPriorities(),
      }
    );
  } catch (error) {
    return handleTodoError(
      res,
      error,
      "Failed to fetch todo options"
    );
  }
};