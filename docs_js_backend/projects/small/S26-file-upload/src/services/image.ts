import sharp from 'sharp';
import path from 'path';

export async function processImage(filePath: string) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  const thumbnailPath = path.join(dir, `${base}_thumb${ext}`);
  const resizedPath = path.join(dir, `${base}_resized${ext}`);

  await sharp(filePath)
    .resize(200, 200, { fit: 'cover' })
    .toFile(thumbnailPath);

  await sharp(filePath)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .composite([
      { input: Buffer.from('<svg><text x="10" y="20" fill="white">WATERMARK</text></svg>'), gravity: 'southeast' }
    ])
    .toFile(resizedPath);
}
