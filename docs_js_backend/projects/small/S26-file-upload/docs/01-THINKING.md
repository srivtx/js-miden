# 01-THINKING

## Mental Model
Treat every upload as a potential attack. The server does not own the client; the client is hostile.

## Hot Path
1. Multipart stream arrives.
2. Multer writes to temp disk.
3. Magic-number validation runs on the temp file.
4. Virus scan stub runs.
5. File is moved to permanent storage (local or S3).
6. If image, Sharp processes thumbnails/watermark in background.
7. Temp file is cleaned up.

## Danger Zones
- **Filename**: `originalname` must never touch the filesystem without sanitization. Path traversal (`../`) and null bytes are classic attacks.
- **Magic numbers vs extensions**: Extensions are user-controlled and meaningless.
- **Temp file cleanup**: If validation throws, the temp file may remain and fill disk.
- **Image processing**: Complex image formats can exploit parser vulnerabilities (ImageTragick-style).
- **Storage abstraction**: Direct filesystem calls bypass abstractions and make S3 migration painful.
