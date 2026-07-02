import fs from "fs-extra";
import path from "path";
import { resolvePath, getUserRoot } from "../../../utils/path.js";

/**
 * 🌳 GET FILE TREE (recursive)
 *
 * Uses req.user.id to resolve: uploads/file-manager/<userId>
 * Returns the full recursive folder/file hierarchy.
 */
export const getTree = async (req, res) => {
  try {
    const fullPath = getUserRoot(req.user.id);

    await fs.ensureDir(fullPath);

    const tree = await buildTree(fullPath, "");

    return res.json({
      success: true,
      tree: {
        name: "root",
        type: "folder",
        path: "",
        children: tree,
      },
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * 📂 LIST FOLDER (flat, one level)
 *
 * Uses req.user.id to resolve: uploads/file-manager/<userId>
 * Returns a flat list of items inside the user's root folder.
 */
export const listFolder = async (req, res) => {
  try {
    const fullPath = getUserRoot(req.user.id);

    await fs.ensureDir(fullPath);

    const entries = await fs.readdir(fullPath);
    const items = [];

    for (const entry of entries) {
      const entryFullPath = path.join(fullPath, entry);
      const entryStat = await fs.stat(entryFullPath);

      if (entryStat.isDirectory()) {
        items.push({
          name: entry,
          type: "folder",
          path: entry,
        });
      } else {
        items.push({
          name: entry,
          type: "file",
          path: entry,
          size: entryStat.size,
          extension: path.extname(entry),
          modifiedAt: entryStat.mtime,
        });
      }
    }

    // Sort: folders first, then files, both alphabetically
    items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "folder" ? -1 : 1;
    });

    return res.json({
      success: true,
      path: "",
      items,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/* ──────────────────────────────────────────────
   Helper: recursively build a tree structure
   ────────────────────────────────────────────── */
async function buildTree(dirPath, relativePath) {
  const entries = await fs.readdir(dirPath);
  const children = [];

  for (const entry of entries) {
    const entryFullPath = path.join(dirPath, entry);
    const entryStat = await fs.stat(entryFullPath);
    const entryRelativePath = relativePath
      ? path.posix.join(relativePath, entry)
      : entry;

    if (entryStat.isDirectory()) {
      const subChildren = await buildTree(entryFullPath, entryRelativePath);

      children.push({
        name: entry,
        type: "folder",
        path: entryRelativePath,
        children: subChildren,
      });
    } else {
      children.push({
        name: entry,
        type: "file",
        path: entryRelativePath,
        size: entryStat.size,
        extension: path.extname(entry),
        modifiedAt: entryStat.mtime,
      });
    }
  }

  // Sort: folders first, then files, both alphabetically
  children.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "folder" ? -1 : 1;
  });

  return children;
}
