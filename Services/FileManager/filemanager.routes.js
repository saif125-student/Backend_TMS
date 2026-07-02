import express from "express";
import { chatUpload } from "../../utils/filehandler.js";
import { authenticateToken } from "../../utils/auth.js";

/* FOLDER CONTROLLERS */
import {
  createFolder,
  deleteFolder,
  renameFolder,
  moveFolder,
  copyFolder,
} from "./controllers/folder.controller.js";

/* FILE CONTROLLERS */
import {
  uploadFile,
  deleteFile,
  renameFile,
  moveFile,
  copyFile,
  downloadFile,
} from "./controllers/file.controller.js";

/* ARCHIVE CONTROLLER */
import {
  downloadZip,
} from "./controllers/archive.controller.js";


import {
  getTree,
  listFolder,
} from "./controllers/browse.controller.js";


const router = express.Router();

/* ======================================================
   📁 FOLDER ROUTES
====================================================== */

/**
 * Create folder
 * body: { path }
 */
router.post("/folder/create", authenticateToken, createFolder);

/**
 * Delete folder
 * body: { path }
 */
router.delete("/folder/delete", authenticateToken, deleteFolder);

/**
 * Rename folder
 * body: { oldPath, newPath }
 */
router.patch("/folder/rename", authenticateToken, renameFolder);

/**
 * Move folder
 * body: { from, to }
 */
router.post("/folder/move", authenticateToken, moveFolder);

/**
 * Copy folder (recursive)
 * body: { from, to }
 */
router.post("/folder/copy", authenticateToken, copyFolder);

/* ======================================================
   📄 FILE ROUTES
====================================================== */

/**
 * Upload file
 * form-data: file + path + filename(optional handled in controller)
 */
router.post("/file/upload", authenticateToken, chatUpload.single("file"), uploadFile);

/**
 * Delete file
 * body: { path }
 */
router.delete("/file/delete", authenticateToken, deleteFile);

/**
 * Rename file
 * body: { oldPath, newPath }
 */
router.patch("/file/rename", authenticateToken, renameFile);

/**
 * Move file
 * body: { from, to }
 */
router.post("/file/move", authenticateToken, moveFile);

/**
 * Copy file
 * body: { from, to }
 */
router.post("/file/copy", authenticateToken, copyFile);

/* ======================================================
   📦 ARCHIVE ROUTES
====================================================== */

/**
 * Download folder as ZIP
 * query: ?path=folder/subfolder
 */
router.get("/folder/download-zip", authenticateToken, downloadZip);
router.post("/file/download", authenticateToken, downloadFile);
router.get("/list", authenticateToken, listFolder);
router.get("/tree", authenticateToken, getTree);


export default router;