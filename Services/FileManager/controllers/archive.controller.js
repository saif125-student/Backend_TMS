import fs from "fs-extra";
import path from "path";
import { zip } from "zip-a-folder";
import { zipSchema } from "../filemanager.validation.js";
import { resolvePath } from "../../../utils/path.js";

/**
 * 📦 ZIP FOLDER DOWNLOAD
 *
 * Body:
 * {
 *   "path": "documents"
 * }
 */
export const downloadZip = async (req, res) => {
  try {
    const { path: folderPath } = zipSchema.parse(req.body);

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

    const zipName = folderPath.replaceAll("/", "_") + ".zip";

    const outputPath = path.join(
      process.cwd(),
      "uploads",
      "file-manager",
      String(req.user.id),
      zipName
    );

    await zip(fullPath, outputPath);

    return res.download(outputPath, zipName);
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};