import express from "express";
import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getProfile,
  UpdateUser,
  deleteUser,
 getAllUser,
 SendForgotPasswordEmail,
 ResetPassword,
} from "../Users/user.controller.js";
import { authenticateToken, authorize } from "../../utils/auth.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh-token", refreshToken);
router.post("/logout", logoutUser);
router.get("/me", authenticateToken, getProfile);
router.post(
  "/create",
  authenticateToken,
  authorize("user.create"),
  registerUser
);
router.put("/update/:id", authenticateToken, authorize("user.edit"), UpdateUser);
router.delete("/delete/:id", authenticateToken, authorize("user.delete"), deleteUser);
router.get("/all", authenticateToken, authorize("user.view"), getAllUser);
router.post("/send-forgot-password", SendForgotPasswordEmail);
router.post("/reset-password", ResetPassword);



export default router;