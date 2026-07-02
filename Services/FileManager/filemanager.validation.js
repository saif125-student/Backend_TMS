import path from "path";
import { z } from "zod";

/**
 * Checks if path is trying to escape root folder.
 * Allows:
 *   ""
 *   "Gg"
 *   "Gg/new-folder"
 *
 * Blocks:
 *   "../secret"
 *   "/etc/passwd"
 *   "C:\\Users\\..."
 */
const safePath = z
  .string()
  .optional()
  .default("")
  .transform((val) => String(val || "").trim().replace(/\\/g, "/"))
  .refine((val) => !val.includes("\0"), {
    message: "Invalid path",
  })
  .refine((val) => !path.isAbsolute(val) && !path.win32.isAbsolute(val), {
    message: "Absolute paths are not allowed",
  })
  .refine((val) => {
    const parts = val.split("/").filter(Boolean);
    return !parts.includes("..");
  }, {
    message: "Invalid path",
  });

const requiredSafePath = safePath.refine((val) => val.length > 0 && val !== ".", {
  message: "Path is required",
});


export const uploadSchema = z.object({
  path: safePath,

  filename: z
    .string()
    .trim()
    .max(255, "Filename is too long")
    .refine((val) => !val.includes("/") && !val.includes("\\"), {
      message: "Filename cannot contain slashes",
    })
    .refine((val) => val !== "." && val !== "..", {
      message: "Invalid filename",
    })
    .optional(),
});

const folderName = z
  .string()
  .trim()
  .min(1, "Folder name is required")
  .max(255, "Folder name is too long")
  .refine((val) => !val.includes("\0"), {
    message: "Invalid folder name",
  })
  .refine((val) => !val.includes("/") && !val.includes("\\"), {
    message: "Folder name cannot contain slashes",
  })
  .refine((val) => val !== "." && val !== "..", {
    message: "Invalid folder name",
  });

export const createFolderSchema = z.object({
  // parent folder path, can be "" for root
  path: safePath,

  // new folder name
  name: folderName,
});

export const deleteSchema = z.object({
  path: requiredSafePath,
});

export const renameSchema = z.object({
  oldPath: requiredSafePath,
  newPath: requiredSafePath,
});

export const moveSchema = z.object({
  from: requiredSafePath,
  to: requiredSafePath,
});

export const copySchema = z.object({
  from: requiredSafePath,
  to: requiredSafePath,
});


export const zipSchema = z.object({
  path: requiredSafePath,
});