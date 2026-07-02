// Services/Chat/Chat.controller.js

import fs from "fs";
import path from "path";
import prisma from "../../prisma/client.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import { parseWithSchema } from "../../utils/zodValidation.js";
import {
  getConversationMessagesSchema,
  getConversationWithUserSchema,
} from "./Chat.validations.js";
import {
  getMessageType,
  normalizeConversationUsers,
  safePayload,
} from "../../utils/chatHelpers.js";

const chatUploadPath = path.join(process.cwd(), "uploads", "chat");

if (!fs.existsSync(chatUploadPath)) {
  fs.mkdirSync(chatUploadPath, { recursive: true });
}

export const findOrCreateConversation = async (userA, userB) => {
  const { userOneId, userTwoId } = normalizeConversationUsers(userA, userB);

  const existingConversation = await prisma.conversation.findUnique({
    where: {
      userOneId_userTwoId: {
        userOneId,
        userTwoId,
      },
    },
    include: {
      userOne: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      userTwo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (existingConversation) return existingConversation;

  try {
    return await prisma.conversation.create({
      data: {
        userOneId,
        userTwoId,
      },
      include: {
        userOne: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        userTwo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  } catch (error) {
    return await prisma.conversation.findUnique({
      where: {
        userOneId_userTwoId: {
          userOneId,
          userTwoId,
        },
      },
      include: {
        userOne: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        userTwo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }
};

export const userBelongsToConversation = async (userId, conversationId) => {
  return await prisma.conversation.findFirst({
    where: {
      id: BigInt(conversationId),
      OR: [{ userOneId: BigInt(userId) }, { userTwoId: BigInt(userId) }],
    },
  });
};

export const saveChatMessage = async ({
  conversationId,
  senderId,
  receiverId,
  message,
  messageType,
  attachmentUrl,
  attachmentName,
  attachmentType,
  attachmentSize,
}) => {
  const finalMessageType = getMessageType({
    messageType,
    attachmentUrl,
    attachmentType,
  });

  const saved = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId: BigInt(conversationId),
        senderId: BigInt(senderId),
        receiverId: BigInt(receiverId),

        message: message || null,
        messageType: finalMessageType,

        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        attachmentType: attachmentType || null,
        attachmentSize: attachmentSize ? BigInt(attachmentSize) : null,

        status: "sent",
      },
    });

    await tx.conversation.update({
      where: {
        id: BigInt(conversationId),
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return created;
  });

  return await prisma.message.findUnique({
    where: {
      id: saved.id,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      conversation: true,
    },
  });
};

export const markMessageAsDelivered = async (messageId) => {
  const message = await prisma.message.findUnique({
    where: {
      id: BigInt(messageId),
    },
  });

  if (!message) {
    throw new Error("Message not found");
  }

  if (message.status === "read") {
    return message;
  }

  return await prisma.message.update({
    where: {
      id: BigInt(messageId),
    },
    data: {
      status: "delivered",
      deliveredAt: message.deliveredAt || new Date(),
    },
  });
};

export const markSingleMessageAsDeliveredByReceiver = async ({
  messageId,
  receiverId,
}) => {
  const message = await prisma.message.findFirst({
    where: {
      id: BigInt(messageId),
      receiverId: BigInt(receiverId),
    },
  });

  if (!message) {
    throw new Error("Message not found or access denied");
  }

  if (message.status === "read") {
    return message;
  }

  return await prisma.message.update({
    where: {
      id: BigInt(messageId),
    },
    data: {
      status: "delivered",
      deliveredAt: message.deliveredAt || new Date(),
    },
  });
};

export const markConversationMessagesAsRead = async ({
  conversationId,
  readerId,
}) => {
  const conversation = await userBelongsToConversation(readerId, conversationId);

  if (!conversation) {
    throw new Error("Conversation not found or access denied");
  }

  const otherUserId =
    conversation.userOneId === BigInt(readerId)
      ? conversation.userTwoId
      : conversation.userOneId;

  const unreadMessages = await prisma.message.findMany({
    where: {
      conversationId: BigInt(conversationId),
      senderId: otherUserId,
      receiverId: BigInt(readerId),
      status: {
        in: ["sent", "delivered"],
      },
    },
    select: {
      id: true,
    },
  });

  const messageIds = unreadMessages.map((message) => message.id);

  if (messageIds.length === 0) {
    return {
      conversationId: BigInt(conversationId),
      readByUserId: BigInt(readerId),
      messageIds: [],
      readAt: null,
      otherUserId,
    };
  }

  const now = new Date();

  await prisma.message.updateMany({
    where: {
      id: {
        in: messageIds,
      },
    },
    data: {
      status: "read",
      deliveredAt: now,
      readAt: now,
    },
  });

  return {
    conversationId: BigInt(conversationId),
    readByUserId: BigInt(readerId),
    messageIds,
    readAt: now,
    otherUserId,
  };
};

export const updateUserPresence = async (userId, isOnline) => {
  const now = new Date();

  return await prisma.userPresence.upsert({
    where: {
      userId: BigInt(userId),
    },
    update: {
      isOnline,
      lastSeen: isOnline ? null : now,
    },
    create: {
      userId: BigInt(userId),
      isOnline,
      lastSeen: isOnline ? null : now,
    },
  });
};

export const uploadChatAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, "No file uploaded", null, 400);
    }

    const extension = path.extname(req.file.originalname);

    const fileName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${extension}`;

    const filePath = path.join(chatUploadPath, fileName);

    fs.writeFileSync(filePath, req.file.buffer);

    return successResponse(res, "File uploaded successfully", {
      attachment_url: `/uploads/chat/${fileName}`,
      attachment_name: req.file.originalname,
      attachment_type: req.file.mimetype,
      attachment_size: req.file.size,
    });
  } catch (error) {
    return errorResponse(res, "File upload failed", error.message, 500);
  }
};

export const getOrCreateConversationWithUser = async (req, res) => {
  try {
    const authUserId = req.user?.id || req.user?.userId || req.user?.sub;

    if (!authUserId) {
      return errorResponse(res, "Authenticated user ID missing", null, 401);
    }

    const params = parseWithSchema(getConversationWithUserSchema, req.params);

    const otherUser = await prisma.user.findUnique({
      where: {
        id: params.userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!otherUser) {
      return errorResponse(res, "User not found", null, 404);
    }

    const conversation = await findOrCreateConversation(authUserId, params.userId);

    return successResponse(
      res,
      "Conversation loaded successfully",
      safePayload(conversation)
    );
  } catch (error) {
    return errorResponse(
      res,
      error.message || "Failed to load conversation",
      error.message,
      error.status || 500
    );
  }
};

export const getConversationMessages = async (req, res) => {
  try {
    const authUserId = req.user?.id || req.user?.userId || req.user?.sub;

    if (!authUserId) {
      return errorResponse(res, "Authenticated user ID missing", null, 401);
    }

    const payload = {
      ...req.params,
      ...req.query,
    };

    const data = parseWithSchema(getConversationMessagesSchema, payload);

    const conversation = await userBelongsToConversation(
      authUserId,
      data.conversationId
    );

    if (!conversation) {
      return errorResponse(
        res,
        "You do not have access to this conversation",
        null,
        403
      );
    }

    const page = data.page || 1;
    const limit = data.limit || 50;
    const skip = (page - 1) * limit;

    const messages = await prisma.message.findMany({
      where: {
        conversationId: data.conversationId,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return successResponse(res, "Messages loaded successfully", {
      page,
      limit,
      messages: safePayload(messages.reverse()),
    });
  } catch (error) {
    return errorResponse(
      res,
      error.message || "Failed to load messages",
      error.message,
      error.status || 500
    );
  }
};

export const getMyConversations = async (req, res) => {
  try {
    const authUserId = req.user?.id || req.user?.userId || req.user?.sub;

    if (!authUserId) {
      return errorResponse(res, "Authenticated user ID missing", null, 401);
    }

    const currentUserId = BigInt(authUserId);

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ userOneId: currentUserId }, { userTwoId: currentUserId }],
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        userOne: {
          select: {
            id: true,
            name: true,
            email: true,
            presence: true,
          },
        },
        userTwo: {
          select: {
            id: true,
            name: true,
            email: true,
            presence: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    const formatted = conversations.map((conversation) => {
      const otherUser =
        conversation.userOneId === currentUserId
          ? conversation.userTwo
          : conversation.userOne;

      return {
        id: conversation.id,
        other_user: otherUser,
        last_message: conversation.messages[0] || null,
        created_at: conversation.createdAt,
        updated_at: conversation.updatedAt,
      };
    });

    return successResponse(
      res,
      "Conversations loaded successfully",
      safePayload(formatted)
    );
  } catch (error) {
    return errorResponse(
      res,
      "Failed to load conversations",
      error.message,
      500
    );
  }
};

export const getUnreadChatCount = async (req, res) => {
  try {
    const authUserId = req.user?.id || req.user?.userId || req.user?.sub;

    if (!authUserId) {
      return errorResponse(res, "Authenticated user ID missing", null, 401);
    }

    const unreadCount = await prisma.message.count({
      where: {
        receiverId: BigInt(authUserId),
        status: {
          in: ["sent", "delivered"],
        },
      },
    });

    return successResponse(res, "Unread chat count loaded successfully", {
      unread_count: unreadCount,
    });
  } catch (error) {
    return errorResponse(
      res,
      "Failed to load unread chat count",
      error.message,
      500
    );
  }
};