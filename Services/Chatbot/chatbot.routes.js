import express from "express";
import {getChatbotResponse} from "./chatbot.js";

const router = express.Router();

router.post("/response", getChatbotResponse);

export default router;