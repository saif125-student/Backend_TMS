import express from "express";
import {
  createTodo,
  getTodos,
  getTodoById,
  getTodosByEmployeeId,
  updateTodo,
  updateTodoCompletion,
  deleteTodo,
  getTodoOptions,
} from "./todo.controller.js";
import {
  authenticateToken,
  authorize,
} from "../../utils/auth.js";

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  authorize("todo.create"),
  createTodo
);

router.get(
  "/options",
  authenticateToken,
  authorize("todo.view"),
  getTodoOptions
);

router.get(
  "/employee/:employeeId",
  authenticateToken,
  authorize("todo.view"),
  getTodosByEmployeeId
);

router.get(
  "/",
  authenticateToken,
  authorize("todo.view"),
  getTodos
);

router.get(
  "/:id",
  authenticateToken,
  authorize("todo.view"),
  getTodoById
);

router.patch(
  "/:id/completion",
  authenticateToken,
  authorize("todo.edit"),
  updateTodoCompletion
);

router.put(
  "/:id",
  authenticateToken,
  authorize("todo.edit"),
  updateTodo
);

router.delete(
  "/:id",
  authenticateToken,
  authorize("todo.delete"),
  deleteTodo
);

export default router;