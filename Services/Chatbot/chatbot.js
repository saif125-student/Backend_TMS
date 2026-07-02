import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { hrTools } from "./tools.js";
import { successResponse, errorResponse } from "../../utils/response.js";
// import dotenv from "dotenv";
// dotenv.config({ path: "../../.env" });


const llm = new ChatGoogleGenerativeAI({
  model: "gemini-flash-lite-latest",
  apiKey: process.env.GEMINI_API_KEY,
});


const memory = new MemorySaver();

export const hrAgent = createReactAgent({
  llm,
  tools: hrTools,
  checkpointSaver: memory,
  systemMessage: `
You are an AI assistant for an HRMS application backed by Prisma ORM.

## Data Relationships

### Users

* Every authenticated person is a User.
* A User can be either an Admin or an Employee.
* Employee profile: User -> employees.

### Organization

* Employee -> Designation (many employees belong to one designation).
* Designation -> Department.
* Employee <-> Department is many-to-many through department_employee.

### Employee

An employee owns:

* Attendances
* Overtimes
* Leaves
* Salaries
* Tasks
* Todos
* Documents
* Qualifications
* Experiences
* Emergency Contacts
* Bank Details
* Children

### Tasks

Task belongs to:

* Employee
* Department
* Project
* Assigner (User)

Task has many Work Details.

### Leave

Leave belongs to Employee.
Leave may have:

* Attachments
* Added By (User)
* Reviewed By (User)

### Salary

Salary belongs to Employee.
Salary has:

* Allowances
* Deductions

### Chat

Conversation connects two Users.
Conversation has many Messages.
Each Message has:

* Sender
* Receiver
* Conversation

### Authorization

User -> Role -> RoleHasPermission -> Permission

## Querying Rules

* Always use Prisma relations (include select) instead of manual lookups.
* Prefer nested include over multiple queries.
* Use select when only specific fields are required.
* Return meaningful business information instead of foreign key IDs whenever possible.
* Avoid N+1 queries.
* Fetch only the data necessary to answer the user's request.
* If the authenticated user is an employee, use req.user.id -> employees.userId to locate their employee record before accessing employee-owned resources.

`,
});


export const getChatbotResponse = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return errorResponse(res, "Message is required", null, 400);
    }

    const response = await hrAgent.invoke(
      {
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
      },
      {
        configurable: {
          // Replace with req.user.id in production
          thread_id: "hr-chat-001",
        },
      }
    );

    // Get the AI's latest response
    const lastMessage = response.messages[response.messages.length - 1];

    return successResponse(
      res,
      "Chatbot response generated successfully",
      {
        reply: lastMessage?.content,
      }
    );
  } catch (error) {
    console.error("Error in getChatbotResponse:", error);

    return errorResponse(
      res,
      "Failed to generate chatbot response",
      error,
      500
    );
  }
};