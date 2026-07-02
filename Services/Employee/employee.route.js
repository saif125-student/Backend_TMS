import express from "express";
import { authenticateToken, authorize } from "../../utils/auth.js";
import { employeeUpload } from "./employee.upload.js";


import { createEmployee,updateEmployee,getAllEmployees,getEmployeeById,getEmployeeByUserId,getEmployeeByDepartmentId } from "./employee.controller.js";

const router = express.Router();
console.log('entered employee route');

router.post(
  "/create",
  authenticateToken,
  authorize("employee.create"),
  employeeUpload,
  createEmployee
);


router.put(
  "/:id",
  authenticateToken,
  authorize("employee.edit"),
  employeeUpload,
  updateEmployee
);

router.get(
  "/",
  authenticateToken,
  authorize("employee.view"),
  getAllEmployees
);

router.get(
  "/:id",
  authenticateToken,
  authorize("employee.view"),
  getEmployeeById
);

router.get(
  "/user/:userId",
  authenticateToken,
  authorize("employee.view"),
  getEmployeeByUserId
);

router.get(
  "/department/:departmentId",
  authenticateToken,
  authorize("employee.view"),
  getEmployeeByDepartmentId
);


export default router;
