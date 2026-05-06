import multer from 'multer';

// ---------------------------------------------------------------------------
// BUG: Using memoryStorage instead of diskStorage.
//
// Files are buffered entirely in RAM rather than being streamed to disk.
// This means:
//   1. Uploaded files disappear after the request ends (not persisted).
//   2. Concurrent large uploads can exhaust memory and crash the process.
// ---------------------------------------------------------------------------
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpg, .png, .gif files are allowed'));
    }
  },
});
