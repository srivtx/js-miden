import { Router } from 'express';
import { upload } from '../middleware/upload.js';

const router = Router();

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // With diskStorage this URL would be valid because multer writes the file.
  // With memoryStorage the file only exists in RAM and is lost after the response.
  const fileUrl = `/uploads/${req.file.originalname}`;

  res.status(200).json({
    message: 'File uploaded successfully',
    url: fileUrl,
    size: req.file.size,
  });
});

export default router;
