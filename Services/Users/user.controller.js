import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../prisma/client.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/auth.js";
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  validateRegisterUser,
  validateLoginUser,
  validateRefreshToken,
  validateUpdateUser,
  validateUserId,
} from "./user.validation.js";
import sendEmail  from "../../utils/email.js";

const createSafeUser = (user, roleData = { roles: [], permissions: [] }) => ({
  id: user.id.toString(),
  name: user.name,
  email: user.email,
  roles: roleData.roles,
  permissions: roleData.permissions,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const getUserRolePermissions = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!user?.role) {
    return { roles: [], permissions: [] };
  }

  const roles = [{ id: user.role.id, name: user.role.name }];
  const permissions = user.role.permissions.map((rolePermission) => rolePermission.permission.name);

  return {
    roles: [...new Set(roles)],
    permissions: [...new Set(permissions)],
  };
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, roleId } = validateRegisterUser(req.body);

    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return errorResponse(res, "Role not found", null, 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return errorResponse(res, "Email is already registered", null, 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roleId,
      },
      include: {
        role: true,
      },
    });

    const roleData = await getUserRolePermissions(user.id);

    return successResponse(res, "User registered successfully", createSafeUser(user, roleData), 201);
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return errorResponse(res, "Error creating user", error);
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = validateLoginUser(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return errorResponse(res, "Invalid email or password", null, 401);
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return errorResponse(res, "Invalid email or password", null, 401);
    }

    const payload = { id: user.id.toString(), email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    const roleData = await getUserRolePermissions(user.id);

    return successResponse(res, "Login successful", {
      user: createSafeUser(user, roleData),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return errorResponse(res, "Error logging in", error);
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = validateRefreshToken(req.body);

    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const userId = BigInt(payload.id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshTokenHash) {
      return errorResponse(res, "Invalid refresh token", null, 403);
    }

    const tokenMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!tokenMatch) {
      return errorResponse(res, "Invalid refresh token", null, 403);
    }

    const newPayload = { id: user.id.toString(), email: user.email };
    const accessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    return successResponse(res, "Token refreshed", {
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return errorResponse(res, "Invalid or expired refresh token", error, 401);
  }
};

export const logoutUser = async (req, res) => {
  try {
    const { refreshToken } = validateRefreshToken(req.body);

    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const userId = BigInt(payload.id);

    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    return successResponse(res, "Logout successful");
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return errorResponse(res, "Logout failed", error, 400);
  }
};

export const getProfile = async (req, res) => {
  try {
    const userId = BigInt(req.user.id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return errorResponse(res, "User not found", null, 404);
    }

    const roleData = await getUserRolePermissions(user.id);
    return successResponse(res, "User profile fetched successfully", createSafeUser(user, roleData));
  } catch (error) {
    return errorResponse(res, "Error fetching profile", error, 500);
  }
};

export const UpdateUser = async (req, res) => {
  try {
    const id = validateUserId(req.params.id);
    const validated = validateUpdateUser(req.body);
    const data = {
      ...(validated.name && { name: validated.name }),
      ...(validated.email && { email: validated.email }),
      ...(validated.password && { password: await bcrypt.hash(validated.password, 10) }),
      ...(validated.roleId && { roleId: validated.roleId }),
    };

    const updatedUser = await prisma.user.update({
      where: { id },
      data,
    });

    return successResponse(res, "User updated successfully", createSafeUser(updatedUser));
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return errorResponse(res, "Error updating user", error);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const id = validateUserId(req.params.id);
    await prisma.user.delete({
      where: { id },
    });

    return successResponse(res, "User deleted successfully");
  } catch (error) {
    if (error?.status) {
      return errorResponse(res, error.message, null, error.status);
    }
    return errorResponse(res, "Error deleting user", error);
  }
};


export const getAllUser = async (req, res) => {
  try {
    const users = await prisma.user.findMany();

    return successResponse(res, "Users fetched successfully", users);
  } catch (error) {
    return errorResponse(res, "Error fetching users", error, 500);
  }
};


export const SendForgotPasswordEmail = async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        return errorResponse(res, "User not found", null, 404);
    }

    const resetToken = jwt.sign(
  { id: user.id },
  process.env.JWT_SECRET,
  { expiresIn: "5m" }
);

    const resetLink = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    await sendEmail(
      user.email,
      "Password Reset",
      `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`
    );

    return successResponse(res, "Password reset email sent");

}



export const ResetPassword = async (req, res) => {
  const { token, password } = req.body;

try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
        where: { id: decoded.id },
        data: {
            password: hashedPassword,
        },
    });

    return successResponse(res, "Password updated");
} catch (err) {
    return errorResponse(res, "Invalid or expired token");
}
}
