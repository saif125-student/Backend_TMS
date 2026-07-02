// Services/Chat/Chat.routes.js

import express from "express";
import { authenticateToken } from "../../utils/auth.js";
import { chatUpload } from "../../utils/filehandler.js";
import {
  getConversationMessages,
  getMyConversations,
  getOrCreateConversationWithUser,
  uploadChatAttachment,
  getUnreadChatCount,
} from "./Chat.controller.js";

const router = express.Router();

router.post(
  "/upload",
  authenticateToken,
  chatUpload.single("file"),
  uploadChatAttachment
);

router.get("/unread-count", authenticateToken, getUnreadChatCount);

router.get(
  "/conversations",
  authenticateToken,
  getMyConversations
);

router.get(
  "/conversations/with/:userId",
  authenticateToken,
  getOrCreateConversationWithUser
);

router.get(
  "/conversations/:conversationId/messages",
  authenticateToken,
  getConversationMessages
);

export default router;