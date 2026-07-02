import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { runController } from "./controllerRunner.js";

import { getAttendances } from "../Attendance/attendance.controller.js";
import { getAdmins } from "../Admin/admin.controller.js";
import { getDepartments } from "../Department/department.controller.js";
import { getDesignations } from "../Designation/designation.controller.js";
import {
  getDepartmentDutyTimings,
  getEmployeeDutyTimings,
} from "../DutyTiming/dutytime.controller.js";
import { getEvents } from "../Events/events.controller.js";
import { getHolidays } from "../Holidays/holidays.controller.js";
import { getLeaves } from "../Leaves/leaves.controller.js";
import { getOvertimes } from "../Overtimes/overtime.controller.js";
import { getPermissions } from "../Permissions/Permissions.controller.js";
import { getProjects } from "../Projects/Projects.controller.js";
import { getResignations } from "../Resignation/resignation.controller.js";
import { getRoles } from "../Role/role.controller.js";
import { getAllSalaries } from "../Salaries/salaries.controller.js";
import { getTasks } from "../Tasks/task.controller.js";
import { getTodos } from "../Todos/todo.controller.js";
import { getTerminations } from "../Termination/termination.controller.js";
import {getAllUser} from "../Users/user.controller.js";

const emptySchema = z.object({});

function createControllerTool({ name, description, controller }) {
  return tool(
    async () => {
      try {
        const result = await runController(controller);
    console.log('results: ',result);
    
   const clean = JSON.parse(
  JSON.stringify(result.data, (key, value) =>
    typeof value === "bigint" ? value.toString() : value
  )
);

return JSON.stringify(
  {
    success: result.success,
    data: clean,
  },
  null,
  2
);
      } catch (error) {
        return JSON.stringify({
          success: false,
          message: error.message,
        });
      }
    },
    {
      name,
      description,
      schema: emptySchema,
    }
  );
}

export const getAttendancesTool = createControllerTool({
  name: "get_attendances",
  description:
    "Get all attendance records. Use this when the user asks about attendance, present employees, absent employees, or attendance history.",
  controller: getAttendances,
});

export const getAdminsTool = createControllerTool({
  name: "get_admins",
  description:
    "Get all admins. Use this when the user asks about admin users.",
  controller: getAdmins,
});

export const getDepartmentsTool = createControllerTool({
  name: "get_departments",
  description:
    "Get all departments. Use this when the user asks about company departments.",
  controller: getDepartments,
});

export const getDesignationsTool = createControllerTool({
  name: "get_designations",
  description:
    "Get all designations. Use this when the user asks about job titles, positions, or designations.",
  controller: getDesignations,
});

export const getDepartmentDutyTimingsTool = createControllerTool({
  name: "get_department_duty_timings",
  description:
    "Get all department duty timings. Use this when the user asks about department shifts or duty schedules.",
  controller: getDepartmentDutyTimings,
});

export const getEmployeeDutyTimingsTool = createControllerTool({
  name: "get_employee_duty_timings",
  description:
    "Get all employee duty timings. Use this when the user asks about employee shifts or work timings.",
  controller: getEmployeeDutyTimings,
});

export const getEventsTool = createControllerTool({
  name: "get_events",
  description:
    "Get all events. Use this when the user asks about company events.",
  controller: getEvents,
});

export const getHolidaysTool = createControllerTool({
  name: "get_holidays",
  description:
    "Get all holidays. Use this when the user asks about company holidays or holiday schedules.",
  controller: getHolidays,
});

export const getLeavesTool = createControllerTool({
  name: "get_leaves",
  description:
    "Get all leave records. Use this when the user asks about leaves, leave requests, approved leaves, rejected leaves, or pending leaves.",
  controller: getLeaves,
});

export const getOvertimesTool = createControllerTool({
  name: "get_overtimes",
  description:
    "Get all overtime records. Use this when the user asks about overtime or extra working hours.",
  controller: getOvertimes,
});

export const getPermissionsTool = createControllerTool({
  name: "get_permissions",
  description:
    "Get all permissions. Use this when the user asks about permissions or access rights.",
  controller: getPermissions,
});

export const getProjectsTool = createControllerTool({
  name: "get_projects",
  description:
    "Get all projects. Use this when the user asks about company projects or assigned projects.",
  controller: getProjects,
});

export const getResignationsTool = createControllerTool({
  name: "get_resignations",
  description:
    "Get all resignation records. Use this when the user asks about resignations or resignation requests.",
  controller: getResignations,
});

export const getRolesTool = createControllerTool({
  name: "get_roles",
  description:
    "Get all roles. Use this when the user asks about roles or access roles.",
  controller: getRoles,
});

export const getSalariesTool = createControllerTool({
  name: "get_salaries",
  description:
    "Get all salary records. Use this when the user asks about salaries, payroll, or employee pay.",
  controller: getAllSalaries,
});

export const getTasksTool = createControllerTool({
  name: "get_tasks",
  description:
    "Get all tasks. Use this when the user asks about assigned tasks, pending tasks, or completed tasks.",
  controller: getTasks,
});

export const getTodosTool = createControllerTool({
  name: "get_todos",
  description:
    "Get all todos. Use this when the user asks about todos or todo lists.",
  controller: getTodos,
});

export const getTerminationsTool = createControllerTool({
  name: "get_terminations",
  description:
    "Get all termination records. Use this when the user asks about terminated employees or termination records.",
  controller: getTerminations,
});


export const getAllUsersTool = createControllerTool({
  name: "get_all_users",
  description:
    "Get all user records. Use this when the user asks about users or user information.",
  controller: getAllUser,
});


export const hrTools = [
  getAttendancesTool,
  getAdminsTool,
  getDepartmentsTool,
  getDesignationsTool,
  getDepartmentDutyTimingsTool,
  getEmployeeDutyTimingsTool,
  getEventsTool,
  getHolidaysTool,
  getLeavesTool,
  getOvertimesTool,
  getPermissionsTool,
  getProjectsTool,
  getResignationsTool,
  getRolesTool,
  getSalariesTool,
  getTasksTool,
  getTodosTool,
  getTerminationsTool,
  getAllUsersTool
];