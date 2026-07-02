import fs from "fs-extra";
import path from "path";

import {
  createFolderSchema,
  deleteSchema,
  renameSchema,
  moveSchema,
  copySchema,
} from "../filemanager.validation.js";

import { resolvePath } from "../../../utils/path.js";

/**
 * 📁 CREATE FOLDER
 *
 * Body:
 * {
 *   "path": "Gg",
 *   "name": "new-folder"
 * }
 *
 * Creates:
 * uploads/file-manager/<userId>/Gg/new-folder
 */
export const createFolder = async (req, res) => {
  try {
    const { path: parentPath, name } = createFolderSchema.parse(req.body);

    const targetPath = parentPath
      ? path.posix.join(parentPath, name)
      : name;

    const fullPath = resolvePath(req.user.id, targetPath);

    const alreadyExists = await fs.pathExists(fullPath);

    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: "Folder already exists",
      });
    }

    await fs.ensureDir(fullPath);

    return res.status(201).json({
      success: true,
      message: "Folder created",
      path: targetPath,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * 🗑 DELETE FOLDER
 *
 * Body:
 * {
 *   "path": "Gg/new-folder"
 * }
 */
export const deleteFolder = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    const { path: folderPath } = deleteSchema.parse(req.body);

    const fullPath = resolvePath(req.user.id, folderPath);

    const exists = await fs.pathExists(fullPath);

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Folder not found",
      });
    }

    const stat = await fs.stat(fullPath);

    if (!stat.isDirectory()) {
      return res.status(400).json({
        success: false,
        message: "Path is not a folder",
      });
    }

    await fs.remove(fullPath);

    return res.json({
      success: true,
      message: "Folder deleted",
      path: folderPath,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * ✏️ RENAME FOLDER
 *
 * Body:
 * {
 *   "oldPath": "Gg/old-folder",
 *   "newPath": "Gg/new-folder"
 * }
 */
export const renameFolder = async (req, res) => {
  try {
    const { oldPath, newPath } = renameSchema.parse(req.body);

    const oldFull = resolvePath(req.user.id, oldPath);
    const newFull = resolvePath(req.user.id, newPath);

    const oldExists = await fs.pathExists(oldFull);

    if (!oldExists) {
      return res.status(404).json({
        success: false,
        message: "Folder not found",
      });
    }

    const oldStat = await fs.stat(oldFull);

    if (!oldStat.isDirectory()) {
      return res.status(400).json({
        success: false,
        message: "Old path is not a folder",
      });
    }

    const newExists = await fs.pathExists(newFull);

    if (newExists) {
      return res.status(409).json({
        success: false,
        message: "Destination already exists",
      });
    }

    await fs.move(oldFull, newFull);

    return res.json({
      success: true,
      message: "Folder renamed",
      oldPath,
      newPath,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * 📦 MOVE FOLDER
 *
 * Body:
 * {
 *   "from": "Gg/new-folder",
 *   "to": "Documents/new-folder"
 * }
 */
export const moveFolder = async (req, res) => {
  try {
    const { from, to } = moveSchema.parse(req.body);

    const src = resolvePath(req.user.id, from);
    const dest = resolvePath(req.user.id, to);

    const srcExists = await fs.pathExists(src);

    if (!srcExists) {
      return res.status(404).json({
        success: false,
        message: "Source folder not found",
      });
    }

    const srcStat = await fs.stat(src);

    if (!srcStat.isDirectory()) {
      return res.status(400).json({
        success: false,
        message: "Source path is not a folder",
      });
    }

    const destExists = await fs.pathExists(dest);

    if (destExists) {
      return res.status(409).json({
        success: false,
        message: "Destination already exists",
      });
    }

    await fs.move(src, dest);

    return res.json({
      success: true,
      message: "Folder moved",
      from,
      to,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * 📋 COPY FOLDER
 *
 * Body:
 * {
 *   "from": "Gg/new-folder",
 *   "to": "Backup/new-folder"
 * }
 */
export const copyFolder = async (req, res) => {
  try {
    const { from, to } = copySchema.parse(req.body);

    const src = resolvePath(req.user.id, from);
    const destInput = resolvePath(req.user.id, to);

    const srcExists = await fs.pathExists(src);

    if (!srcExists) {
      return res.status(404).json({
        success: false,
        message: "Source folder not found",
      });
    }

    const srcStat = await fs.stat(src);

    if (!srcStat.isDirectory()) {
      return res.status(400).json({
        success: false,
        message: "Source path is not a folder",
      });
    }

    let finalDest = destInput;

    const destInputExists = await fs.pathExists(destInput);

    if (destInputExists) {
      const destInputStat = await fs.stat(destInput);

      if (!destInputStat.isDirectory()) {
        return res.status(400).json({
          success: false,
          message: "Destination path is not a folder",
        });
      }

      // If "to" is an existing folder, copy source folder inside it
      finalDest = path.join(destInput, path.basename(src));
    }

    const finalDestExists = await fs.pathExists(finalDest);

    if (finalDestExists) {
      return res.status(409).json({
        success: false,
        message: "Folder already exists inside destination",
      });
    }

    await fs.copy(src, finalDest);

    return res.json({
      success: true,
      message: "Folder copied",
      from,
      to,
      copiedTo: path.relative(resolvePath(req.user.id, ""), finalDest),
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};