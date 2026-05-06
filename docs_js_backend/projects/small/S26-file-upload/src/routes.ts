import { Router } from 'express';
import multer from 'multer';
import { uploadFile, getFile } from './controller.js';
import { validateFileType } from './middleware.js';

const upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 } });
const router = Router();

router.post('/', upload.single('file'), validateFileType, uploadFile);
router.get('/:filename', getFile);

export { router as uploadRouter };
