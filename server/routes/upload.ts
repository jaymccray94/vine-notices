import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
];

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, _file, cb) => {
      const ext = path.extname(_file.originalname);
      cb(null, crypto.randomUUID() + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("File type not supported. Accepted: PDF, Word, Excel, JPEG, PNG."));
  },
});

/**
 * Safely resolve a filename within the uploads directory.
 * Prevents path traversal attacks.
 */
export function safeUploadPath(filename: string): string | null {
  const resolved = path.resolve(uploadDir, filename);
  if (!resolved.startsWith(uploadDir + path.sep) && resolved !== uploadDir) {
    return null;
  }
  return resolved;
}

/**
 * Delete an uploaded file if it exists.
 */
export function deleteUploadedFile(filename: string): void {
  const filePath = safeUploadPath(filename);
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
