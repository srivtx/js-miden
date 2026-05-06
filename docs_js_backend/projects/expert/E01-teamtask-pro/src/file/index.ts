import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/teamtask_file');

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // BUG: Using req.query.orgId which can be manipulated - no validation against token
    const orgId = (req.query.orgId as string) || 'default';
    const uploadPath = path.join(process.env.STORAGE_PATH || './uploads', orgId);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  path: { type: String, required: true },
  organizationId: { type: String, required: true },
  taskId: { type: String },
  uploadedBy: { type: String, required: true },
}, { timestamps: true });

const File = mongoose.model('File', fileSchema);

function authenticate(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/upload', authenticate, upload.single('file'), async (req: any, res) => {
  try {
    const user = req.user;
    // BUG: File access not scoped to tenant - using query param instead of token org
    const organizationId = (req.query.orgId as string) || user.organizationId;

    const fileRecord = await File.create({
      filename: req.file!.filename,
      originalName: req.file!.originalname,
      mimeType: req.file!.mimetype,
      size: req.file!.size,
      path: req.file!.path,
      organizationId,
      taskId: req.query.taskId,
      uploadedBy: user.userId,
    });

    res.status(201).json({ file: fileRecord });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// BUG: Download doesn't verify file belongs to user's organization
app.get('/:id/download', authenticate, async (req: any, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    // BUG: No check that file.organizationId === req.user.organizationId
    res.download(file.path, file.originalName);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/task/:taskId', authenticate, async (req: any, res) => {
  try {
    const files = await File.find({
      taskId: req.params.taskId,
      // BUG: Missing organizationId filter
    });
    res.json({ files });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'file' });
});

app.listen(PORT, () => {
  console.log(`File Service running on port ${PORT}`);
});
