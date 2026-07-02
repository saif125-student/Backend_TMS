import fs from "fs-extra";
import path from "path";
import {
  uploadSchema,
  renameSchema,
  moveSchema,
  copySchema,
  deleteSchema,
} from "../filemanager.validation.js";
import { resolvePath } from "../../../utils/path.js";

/**
 * 📤 UPLOAD FILE (custom filename supported)
 */
export const uploadFile = async (req, res) => {
  try {
    const { path: filePath = "", filename } = uploadSchema.parse(req.body);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const dir = resolvePath(req.user.id, filePath);
    await fs.ensureDir(dir);

    const uploadedExt = path.extname(req.file.originalname); // extension from uploaded file

    let finalFileName;

    if (filename && filename.trim()) {
      // remove any extension user sent
      const userBaseName = path.parse(filename.trim()).name;

      // save with uploaded file extension
      finalFileName = `${userBaseName}${uploadedExt}`;
    } else {
      finalFileName = req.file.originalname;
    }

    const fullPath = path.join(dir, finalFileName);

    const alreadyExists = await fs.pathExists(fullPath);

    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: "File already exists",
      });
    }

    await fs.writeFile(fullPath, req.file.buffer);

    return res.status(201).json({
      success: true,
      message: "File uploaded",
      file: finalFileName,
      path: filePath,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};


/**
 * 🗑 DELETE FILE
 */
export const deleteFile = async (req, res) => {
  try {
    const { path: filePath } = deleteSchema.parse(req.body);

    const fullPath = resolvePath(req.user.id, filePath);

    await fs.remove(fullPath);

    return res.json({
      success: true,
      message: "File deleted",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * ✏️ RENAME FILE
 */
export const renameFile = async (req, res) => {
  try {
    const { oldPath, newPath } = renameSchema.parse(req.body);

    const oldFull = resolvePath(req.user.id, oldPath);
    const newFull = resolvePath(req.user.id, newPath);

    await fs.move(oldFull, newFull);

    return res.json({
      success: true,
      message: "File renamed",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * 📦 MOVE FILE
 */
export const moveFile = async (req, res) => {
  try {
    const { from, to } = moveSchema.parse(req.body);

    const src = resolvePath(req.user.id, from);
    const dest = resolvePath(req.user.id, to);

    await fs.move(src, dest);

    return res.json({
      success: true,
      message: "File moved",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * 📋 COPY FILE
 */
export const copyFile = async (req, res) => {
  try {
    const { from, to } = copySchema.parse(req.body);

    const src = resolvePath(req.user.id, from);
    const dest = resolvePath(req.user.id, to);

    await fs.copy(src, dest);

    return res.json({
      success: true,
      message: "File copied",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};


export const downloadFile = async (req, res) => {
  try {
    const { path: filePath } = deleteSchema.parse(req.body);

    const fullPath = resolvePath(req.user.id, filePath);

    const exists = await fs.pathExists(fullPath);

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      return res.status(400).json({
        success: false,
        message: "Path is a folder, not a file",
      });
    }

    const fileName = path.basename(fullPath);

    res.setHeader("Content-Length", stat.size);

    return res.download(fullPath, fileName, (err) => {
      if (err && !res.headersSent) {
        return res.status(500).json({
          success: false,
          message: "Failed to download file",
        });
      }
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};