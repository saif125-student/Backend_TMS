// sockets/socketAuth.js

import jwt from "jsonwebtoken";
import prisma from "../prisma/client.js";
import { getAuthUserId } from "../utils/auth.js";

export const socketAuth = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      return next(new Error("Socket access token missing"));
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const userId = getAuthUserId(payload);

    if (!userId) {
      return next(new Error("User ID missing in token"));
    }

    const user = await prisma.user.findUnique({
      where: {
        id: BigInt(userId),
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.user = user;
    socket.userId = user.id;

    return next();
  } catch (error) {
    return next(new Error("Socket authentication failed"));
  }
};