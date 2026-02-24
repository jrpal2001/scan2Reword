import path from "path";
import { putObject } from "../utils/Aws/putObject.js";

/**
 * 📤 Generic uploader: uploads all files from req.files to S3.
 * Handles both multer.any() and multer.fields().
 * Automatically normalizes nested fields (like bankDetails.signature → req.s3Uploads.bankDetails.signature)
 */
export const uploadManagerDocsToS3 = async (req, res, next) => {
  try {
    const uploads = {};

    // Helper to safely set nested paths like bankDetails.signature or familyDetails[0][familyPhoto]
    const setNestedUpload = (obj, fieldPath, value) => {
      // Convert bracket notation to dot notation: familyDetails[0][familyPhoto] → familyDetails.0.familyPhoto
      const normalizedPath = fieldPath
        .replace(/\[(\d+)\]/g, ".$1")  // [0] → .0
        .replace(/\[([^\]]+)\]/g, ".$1"); // [familyPhoto] → .familyPhoto

      const parts = normalizedPath.split(".");
      let current = obj;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          // Check if next part is a number (array index)
          const nextPart = parts[i + 1];
          current[part] = /^\d+$/.test(nextPart) ? {} : {};
        }
        current = current[part];
      }

      const last = parts[parts.length - 1];

      // ✅ If multiple files uploaded for same field, convert to array
      if (current[last]) {
        if (Array.isArray(current[last])) {
          current[last].push(value);
        } else {
          current[last] = [current[last], value];
        }
      } else {
        current[last] = value;
      }
    };


    // Helper to process one file
    const processFile = async (file, fieldName) => {
      const ext = path.extname(file.originalname) || "";
      const time = Date.now();
      const safeField = (fieldName || file.fieldname || "file")
        .replace(/\./g, "_")
        .replace(/[^a-zA-Z0-9-_]/g, "_");

      const s3Key = `users/manager/${safeField}-${time}${ext}`;
      const { url, key: savedKey } = await putObject(file, s3Key);
      const uploaded = { url, key: savedKey, contentType: file.mimetype };

      // ✅ Store into nested structure (supports "bankDetails.signature")
      setNestedUpload(uploads, fieldName, uploaded);
    };

    // Handle both multer.any() (array) and multer.fields() (object)
    if (Array.isArray(req.files)) {
      for (const file of req.files) {
        await processFile(file, file.fieldname);
      }
    } else if (req.files && typeof req.files === "object") {
      for (const [fieldName, fileArray] of Object.entries(req.files)) {
        if (!Array.isArray(fileArray)) continue;
        for (const file of fileArray) {
          await processFile(file, fieldName);
        }
      }
    }

    req.s3Uploads = uploads;
    next();
  } catch (err) {
    console.error("S3 Upload Error:", err);
    next(err);
  }
};
