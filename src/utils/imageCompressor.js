import sharp from 'sharp';

/**
 * Compress image buffer using sharp
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Compression options
 * @returns {Promise<Buffer>} Compressed image buffer
 */
export const compressImage = async (buffer, options = {}) => {
  const {
    quality = 80, // JPEG quality (1-100)
    maxWidth = 1920, // Maximum width
    maxHeight = 1920, // Maximum height
    format = null, // 'jpeg', 'png', 'webp' - null keeps original format
  } = options;

  try {
    let image = sharp(buffer);

    // Get image metadata
    const metadata = await image.metadata();
    const isImage = ['jpeg', 'jpg', 'png', 'webp'].includes(metadata.format);

    // If not an image, return original buffer
    if (!isImage) {
      return buffer;
    }

    // Resize if needed (maintain aspect ratio)
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      image = image.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Compress based on format
    if (format === 'jpeg' || metadata.format === 'jpeg' || metadata.format === 'jpg') {
      return image.jpeg({ quality }).toBuffer();
    } else if (format === 'png' || metadata.format === 'png') {
      return image.png({ compressionLevel: 9, quality }).toBuffer();
    } else if (format === 'webp' || metadata.format === 'webp') {
      return image.webp({ quality }).toBuffer();
    }

    // Default: convert to JPEG for better compression
    return image.jpeg({ quality }).toBuffer();
  } catch (error) {
    console.error('Image compression error:', error.message);
    // Return original buffer if compression fails
    return buffer;
  }
};

/**
 * Compress multer file buffer
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} Updated file object with compressed buffer
 */
export const compressMulterFile = async (file) => {
  if (!file || !file.buffer) {
    return file;
  }

  // Only compress images
  const imageMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!imageMimeTypes.includes(file.mimetype)) {
    return file; // Return original for non-images (e.g., PDFs)
  }

  try {
    const compressedBuffer = await compressImage(file.buffer, {
      quality: 80,
      maxWidth: 1920,
      maxHeight: 1920,
    });

    // Update file buffer and size
    file.buffer = compressedBuffer;
    file.size = compressedBuffer.length;

    return file;
  } catch (error) {
    console.error('Error compressing file:', error.message);
    return file; // Return original if compression fails
  }
};
