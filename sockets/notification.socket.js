// sockets/notification.socket.js

import { getUserSocketId } from "./onlineUsers.js";
import { safePayload } from "../utils/chatHelpers.js";

export const emitTaskAssignedNotification = (io, userId, task) => {
  const socketId = getUserSocketId(userId);

  if (!socketId) return;

  io.to(socketId).emit(
    "task_assigned",
    safePayload({
      type: "TASK_ASSIGNED",
      title: "New Task Assigned",
      message: `You have been assigned a new task: ${task.name}`,
      task,
      createdAt: new Date(),
    })
  );
};