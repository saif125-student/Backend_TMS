// sockets/onlineUsers.js

export const onlineUsers = new Map();

/*
  Current approach:

  userId -> socketId

  Example:
  "1" -> "socket_abc"
*/

export const addOnlineUser = (userId, socketId) => {
  onlineUsers.set(userId.toString(), socketId);
};

export const getUserSocketId = (userId) => {
  return onlineUsers.get(userId.toString());
};

export const removeOnlineUserIfSameSocket = (userId, socketId) => {
  const currentSocketId = onlineUsers.get(userId.toString());

  if (currentSocketId === socketId) {
    onlineUsers.delete(userId.toString());
    return true;
  }

  return false;
};