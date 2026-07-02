// sockets/chat.socket.js

import prisma from "../prisma/client.js";
import { safePayload } from "../utils/chatHelpers.js";
import { socketAuth } from "./socketAuth.js";
import {
  addOnlineUser,
  getUserSocketId,
  removeOnlineUserIfSameSocket,
} from "./onlineUsers.js";
import {
  findOrCreateConversation,
  markConversationMessagesAsRead,
  markMessageAsDelivered,
  markSingleMessageAsDeliveredByReceiver,
  saveChatMessage,
  updateUserPresence,
} from "../Services/Chat/Chat.controller.js";
import {
  messageDeliveredSchema,
  messageReadSchema,
  sendMessageSchema,
} from "../Services/Chat/Chat.validations.js";
import { parseWithSchema } from "../utils/zodValidation.js";

export const initChatSocket = (io) => {
  io.use(socketAuth);

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("register_user", async (callback) => {
      try {
        const userId = socket.userId.toString();

        addOnlineUser(userId, socket.id);

        await updateUserPresence(userId, true);

        const payload = {
          userId,
          socketId: socket.id,
          is_online: true,
          last_seen: null,
        };

        socket.emit("registered", payload);

        io.emit("user_presence_changed", {
          userId,
          is_online: true,
          last_seen: null,
        });

        return callback?.({
          success: true,
          message: "User registered successfully",
          data: payload,
        });
      } catch (error) {
        console.error("register_user error:", error);

        return callback?.({
          success: false,
          message: "Failed to register user",
          error: error.message,
        });
      }
    });

    socket.on("send_message", async (payload = {}, callback) => {
      try {
        const data = parseWithSchema(sendMessageSchema, payload);

        const senderId = socket.userId;
        const receiverId = data.toUserId;

        if (senderId === receiverId) {
          return callback?.({
            success: false,
            message: "You cannot send message to yourself",
          });
        }

        const hasText = data.message && data.message.trim() !== "";
        const hasAttachment = Boolean(data.attachmentUrl);

        if (!hasText && !hasAttachment) {
          return callback?.({
            success: false,
            message: "Message or attachment is required",
          });
        }

        const receiver = await prisma.user.findUnique({
          where: {
            id: receiverId,
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });

        if (!receiver) {
          return callback?.({
            success: false,
            message: "Receiver user not found",
          });
        }

        const conversation = await findOrCreateConversation(
          senderId,
          receiverId
        );

        const savedMessage = await saveChatMessage({
          conversationId: conversation.id,
          senderId,
          receiverId,
          message: data.message,
          messageType: data.messageType,
          attachmentUrl: data.attachmentUrl,
          attachmentName: data.attachmentName,
          attachmentType: data.attachmentType,
          attachmentSize: data.attachmentSize,
        });

        const receiverSocketId = getUserSocketId(receiverId);

        if (receiverSocketId) {
          io.to(receiverSocketId).emit(
            "receive_message",
            safePayload(savedMessage)
          );

          const deliveredMessage = await markMessageAsDelivered(savedMessage.id);

          const deliveredPayload = {
            messageId: deliveredMessage.id,
            conversationId: deliveredMessage.conversationId,
            status: deliveredMessage.status,
            deliveredAt: deliveredMessage.deliveredAt,
          };

          socket.emit("message_delivered", safePayload(deliveredPayload));

          io.to(receiverSocketId).emit(
            "message_delivered",
            safePayload(deliveredPayload)
          );
        }

        socket.emit("message_saved", safePayload(savedMessage));

        return callback?.({
          success: true,
          message: "Message sent successfully",
          data: safePayload(savedMessage),
        });
      } catch (error) {
        console.error("send_message error:", error);

        return callback?.({
          success: false,
          message: error.message || "Failed to send message",
          error: error.message,
        });
      }
    });

    socket.on("message_delivered", async (payload = {}, callback) => {
      try {
        const data = parseWithSchema(messageDeliveredSchema, payload);

        const receiverId = socket.userId;

        const updatedMessage = await markSingleMessageAsDeliveredByReceiver({
          messageId: data.messageId,
          receiverId,
        });

        const senderSocketId = getUserSocketId(updatedMessage.senderId);

        const deliveredPayload = {
          messageId: updatedMessage.id,
          conversationId: updatedMessage.conversationId,
          status: updatedMessage.status,
          deliveredAt: updatedMessage.deliveredAt,
        };

        if (senderSocketId) {
          io.to(senderSocketId).emit(
            "message_delivered",
            safePayload(deliveredPayload)
          );
        }

        return callback?.({
          success: true,
          message: "Message marked as delivered",
          data: safePayload(deliveredPayload),
        });
      } catch (error) {
        console.error("message_delivered error:", error);

        return callback?.({
          success: false,
          message: error.message || "Failed to update delivered status",
          error: error.message,
        });
      }
    });

    socket.on("message_read", async (payload = {}, callback) => {
      try {
        const data = parseWithSchema(messageReadSchema, payload);

        const readerId = socket.userId;

        const result = await markConversationMessagesAsRead({
          conversationId: data.conversationId,
          readerId,
        });

        const readPayload = {
          conversationId: result.conversationId,
          readByUserId: result.readByUserId,
          messageIds: result.messageIds,
          readAt: result.readAt,
        };

        const otherUserSocketId = getUserSocketId(result.otherUserId);

        if (otherUserSocketId) {
          io.to(otherUserSocketId).emit(
            "message_read",
            safePayload(readPayload)
          );
        }

        socket.emit("message_read", safePayload(readPayload));

        return callback?.({
          success: true,
          message: "Messages marked as read",
          data: safePayload(readPayload),
        });
      } catch (error) {
        console.error("message_read error:", error);

        return callback?.({
          success: false,
          message: error.message || "Failed to update read status",
          error: error.message,
        });
      }
    });

    socket.on("typing", (payload = {}) => {
      const fromUserId = socket.userId.toString();
      const toUserId = payload.toUserId?.toString();

      if (!toUserId) return;

      const receiverSocketId = getUserSocketId(toUserId);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing", {
          fromUserId,
          conversationId: payload.conversationId || null,
        });
      }
    });

    socket.on("stop_typing", (payload = {}) => {
      const fromUserId = socket.userId.toString();
      const toUserId = payload.toUserId?.toString();

      if (!toUserId) return;

      const receiverSocketId = getUserSocketId(toUserId);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("stop_typing", {
          fromUserId,
          conversationId: payload.conversationId || null,
        });
      }
    });

    socket.on("disconnect", async () => {
      try {
        const userId = socket.userId?.toString();

        if (!userId) return;

        const removed = removeOnlineUserIfSameSocket(userId, socket.id);

        if (removed) {
          const presence = await updateUserPresence(userId, false);

          io.emit("user_presence_changed", {
            userId,
            is_online: false,
            last_seen: presence.lastSeen,
          });
        }

        console.log("Socket disconnected:", socket.id);
      } catch (error) {
        console.error("disconnect error:", error);
      }
    });
  });
};