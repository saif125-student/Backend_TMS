import multer from "multer";
import path from "path";
import fs from "fs";
import { errorResponse } from "../../utils/response.js";

const TEMP_DIR = path.join("uploads", "temp");
const PROFILE_DIR = path.join("uploads", "profiles");
const DOCUMENT_DIR = path.join("uploads", "documents");
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_DOCUMENTS = 10;
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const DOCUMENT_MIMES = [...IMAGE_MIMES, "application/pdf"];

const ensureDirectory = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDirectory(TEMP_DIR);
ensureDirectory(PROFILE_DIR);
ensureDirectory(DOCUMENT_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_DIR),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    cb(null, fileName);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "profile") {
    return IMAGE_MIMES.includes(file.mimetype)
      ? cb(null, true)
      : cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "profile"), false);
  }

  if (file.fieldname === "documents") {
    return DOCUMENT_MIMES.includes(file.mimetype)
      ? cb(null, true)
      : cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "documents"), false);
  }

  cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

const fields = [
  { name: "profile", maxCount: 1 },
  { name: "documents", maxCount: MAX_DOCUMENTS },
];

export const employeeUpload = (req, res, next) => {
  upload.fields(fields)(req, res, (error) => {
    if (!error) {
      return next();
    }

    let message = "File upload failed";
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        message = "Each uploaded file must be 10 MB or smaller.";
      } else if (error.code === "LIMIT_UNEXPECTED_FILE") {
        message = "Only JPG, PNG, WebP, and PDF uploads are allowed. One profile image and up to ten documents are permitted.";
      } else {
        message = error.message;
      }
    } else if (error && error.message) {
      message = error.message;
    }

    return errorResponse(res, message, null, 400);
  });
};

export const cleanupUploadedFiles = async (files) => {
  if (!files) return;

  const fileList = [];
  if (files.profile) fileList.push(...files.profile);
  if (files.documents) fileList.push(...files.documents);

  await Promise.all(
    fileList.map(async (file) => {
      try {
        await fs.promises.unlink(file.path);
      } catch {
        // ignore cleanup errors
      }
    })
  );
};

export const moveSavedFile = async (file, destinationDir) => {
  if (!file) return null;
  ensureDirectory(destinationDir);
  const targetPath = path.join(destinationDir, path.basename(file.path));
  await fs.promises.rename(file.path, targetPath);
  return targetPath;
};

export const makeRelativePath = (absolutePath) => {
  return path.relative(process.cwd(), absolutePath).replace(/\\/g, "/");
};

export const PROFILE_STORAGE_DIR = PROFILE_DIR;
export const DOCUMENT_STORAGE_DIR = DOCUMENT_DIR;
