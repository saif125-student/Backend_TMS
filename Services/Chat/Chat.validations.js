// Services/Chat/Chat.validations.js

import {
  z,
  parsePositiveBigInt,
  parseNonNegativeInteger,
  sanitizeNullableString,
} from "../../utils/zodValidation.js";

export const getConversationWithUserSchema = z.object({
  userId: z
    .any()
    .transform(parsePositiveBigInt)
    .refine(Boolean, "Valid userId is required"),
});

export const getConversationMessagesSchema = z.object({
  conversationId: z
    .any()
    .transform(parsePositiveBigInt)
    .refine(Boolean, "Valid conversationId is required"),

  page: z
    .any()
    .optional()
    .transform((value) => parseNonNegativeInteger(value) || 1),

  limit: z
    .any()
    .optional()
    .transform((value) => parseNonNegativeInteger(value) || 50),
});

export const sendMessageSchema = z.object({
  toUserId: z
    .any()
    .transform(parsePositiveBigInt)
    .refine(Boolean, "Valid toUserId is required"),

  message: z
    .any()
    .optional()
    .transform(sanitizeNullableString),

  messageType: z
    .enum(["text", "image", "pdf", "document", "file"])
    .optional(),

  attachmentUrl: z
    .any()
    .optional()
    .transform(sanitizeNullableString),

  attachmentName: z
    .any()
    .optional()
    .transform(sanitizeNullableString),

  attachmentType: z
    .any()
    .optional()
    .transform(sanitizeNullableString),

  attachmentSize: z
    .any()
    .optional()
    .transform((value) => parseNonNegativeInteger(value)),
});

export const messageDeliveredSchema = z.object({
  messageId: z
    .any()
    .transform(parsePositiveBigInt)
    .refine(Boolean, "Valid messageId is required"),
});

export const messageReadSchema = z.object({
  conversationId: z
    .any()
    .transform(parsePositiveBigInt)
    .refine(Boolean, "Valid conversationId is required"),
});