import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import prisma from '../../prisma/client.js'
import { successResponse, errorResponse } from "../../utils/response.js";
import {
  validateCreateAdmin,
  validateUpdateAdmin,
  validateAdminId,
} from "./admin.validation.js";

const uploadPath = "uploads/";

const saveProfileFile = async (file, filename) => {
  if (!file || !filename) return;
  await fs.promises.writeFile(path.join(uploadPath, filename), file.buffer);
};

export const createAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, roleId } = validateCreateAdmin(req.body);

    const profileFile = req.file;
    const profile = profileFile
      ? Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(profileFile.originalname)
      : null;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          roleId,
          admin: {
            create: {
              phone,
              profile,
            },
          },
        },
        include: {
          admin: true,
        },
      });

      return user;
    });

    if (profileFile && profile) {
      await saveProfileFile(profileFile, profile);
    }

    return successResponse(res, "Admin created successfully", result, 201);

  } catch (error) {
    return errorResponse(res, "Failed to create admin", error);
  }
};




export const getAdmins = async (req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
    });

    return successResponse(res, "Admins fetched successfully", admins);
  } catch (error) {
    return errorResponse(res, "Failed to fetch admins", error);
  }
};


export const updateAdmin = async (req, res) => {
  try {
    const id = validateAdminId(req.params.id);

    const profileFile = req.file;
    // console.log("UPDATE ADMIN - FILE:", profileFile);
   const hasBodyFields = Object.values(req.body || {}).some(
  (val) => val !== undefined && val !== null && val !== ""
);

const hasFile = !!req.file;

if (!hasBodyFields && !hasFile) {
  return errorResponse(res, "At least one field is required");
}

    const validated = validateUpdateAdmin(req.body);
 const profile = profileFile
      ? Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        path.extname(profileFile.originalname)
      : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const admin = await tx.admin.findUnique({
        where: { id },
      });

      if (!admin) throw new Error("Admin not found");

      const hashedPassword = validated.password
        ? await bcrypt.hash(validated.password, 10)
        : undefined;

      const user = await tx.user.update({
        where: { id: admin.userId },
        data: {
          ...(validated.name !== undefined && { name: validated.name }),
          ...(validated.email !== undefined && { email: validated.email }),
          ...(hashedPassword && { password: hashedPassword }),
          ...(validated.roleId !== undefined && { roleId: validated.roleId }),
        },
      });

      const updatedAdmin = await tx.admin.update({
        where: { id },
        data: {
          ...(validated.phone !== undefined && { phone: validated.phone }),
          ...(profile && { profile }),
        },
      });

      return { user, updatedAdmin };
    });

    if (profileFile && profile) {
      await saveProfileFile(profileFile, profile);
    }

    return successResponse(res, "Admin updated successfully", result);
  } catch (error) {
    console.error("UPDATE ADMIN ERROR:", error);
    return errorResponse(res, "Failed to update admin", error.message);
  }
};



export const deleteAdmin = async (req, res) => {
  try {
    const id = validateAdminId(req.params.id);

    await prisma.$transaction(async (tx) => {

      const admin = await tx.admin.findUnique({
        where: { id },
      });

      if (!admin) throw new Error("Admin not found");

      // delete admin
      await tx.admin.delete({
        where: { id: BigInt(id) },
      });

      // delete user
      await tx.user.delete({
        where: { id: admin.userId },
      });
    });

    return successResponse(res, "Admin deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete admin", error);
  }
};