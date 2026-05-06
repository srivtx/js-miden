# MD04 Secure File Vault — v2 Adding TypeScript

## The Bug

You just debugged why a file download returned corrupted data.

```js
app.get('/download/:fileId', (req, res) => {
  const filepath = path.join(UPLOAD_DIR, req.params.fileId);
  res.sendFile(path.resolve(filepath));
});
```

A user uploaded a file with metadata:
```json
{ "filename": "report.pdf", "contentType": "application/pdf", "size": 1048576 }
```

But you stored the file as a raw buffer. The `contentType` was never saved. The browser downloads it as `application/octet-stream` instead of opening it as a PDF. Users complain.

TypeScript would have forced you to save the metadata alongside the file.

## The Fix: Types First

```ts
// types.ts
export interface FileUpload {
  id: string;
  filename: string;
  originalName: string;
  contentType: string;
  size: number;
  ownerId: string;
  uploadedAt: Date;
  encryptedAtRest: boolean;
  checksum: string; // SHA-256
}

export interface FileAccessLog {
  fileId: string;
  userId: string;
  action: 'upload' | 'download' | 'share' | 'delete';
  timestamp: Date;
  ip: string;
}

export interface SignedUrlRequest {
  fileId: string;
  expiresInMinutes: number;
  allowedIPs?: string[];
}

export interface SignedUrl {
  url: string;
  expiresAt: Date;
}
```

## The Vault Service Interface

```ts
// vaultService.ts
export interface IFileVaultService {
  upload(file: Buffer, meta: Omit<FileUpload, 'id' | 'uploadedAt'>): Promise<FileUpload>;
  download(fileId: string, userId: string): Promise<{ stream: Readable; meta: FileUpload }>;
  createSignedUrl(req: SignedUrlRequest): Promise<SignedUrl>;
  delete(fileId: string, userId: string): Promise<void>;
  getAccessLog(fileId: string): Promise<FileAccessLog[]>;
}
```

## Why Types Matter Here

File handling has many edge cases:
- `size` is in bytes, not kilobytes
- `contentType` must be a valid MIME type
- `checksum` is required for integrity verification
- `encryptedAtRest` is a boolean flag for compliance

Without types, it's easy to store `size` as a string (`"1MB"`) or forget `checksum` entirely. TypeScript makes the contract visible.

**Next:** Let's add validation so we don't accept 100GB uploads and paths like `../../../etc/passwd`.
