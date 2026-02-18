import multer from "multer";
import sharp from "sharp";
import fs from "fs";
import path from "path";

// ====== 1️⃣ Setup upload directory ======
const uploadPath = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);

// ====== 2️⃣ Multer memory storage ======
const storage = multer.memoryStorage();

// ====== 3️⃣ Allowed file types ======
const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/svg+xml",
  "application/pdf",
];

// ====== 4️⃣ File filter for security ======
const fileFilter = (req, file, cb) => {
  console.log("📎 File received:", {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  if (allowedTypes.includes(file.mimetype)) {
    console.log("✅ File accepted:", file.originalname);
    cb(null, true);
  } else {
    console.log("❌ File rejected:", file.mimetype, "- Not in allowed types");
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPG, PNG, WEBP, GIF, SVG, and PDF are allowed.`), false);
  }
};

// ====== 5️⃣ Multer configuration ======
export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter,
});

// ====== 6️⃣ Compression middleware (ONLY for images) ======
export const compressAndSave = async (req, res, next) => {
  try {
    if (!req.file) return next(); // no file uploaded

    const isImage = req.file.mimetype.startsWith("image/");
    const ext = isImage ? ".jpeg" : path.extname(req.file.originalname);
    const filename = `file-${Date.now()}${ext}`;
    const filePath = path.join(uploadPath, filename);

    if (isImage) {
      // 🧠 Compress + resize only images
      await sharp(req.file.buffer)
        .resize({ width: 1080, withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toFile(filePath);
    } else {
      // 🚫 No compression for non-images — save directly
      fs.writeFileSync(filePath, req.file.buffer);
    }

    // ✅ Attach file info to request
    req.file.filename = filename;
    req.file.path = filePath;

    next();
  } catch (error) {
    console.error("File upload error:", error);
    next(error);
  }
};
