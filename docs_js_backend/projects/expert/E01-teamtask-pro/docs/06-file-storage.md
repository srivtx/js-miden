# File Attachments

## Overview
The File Service handles file uploads, storage, and downloads for task attachments.

## Storage Architecture

```
Storage Root (/app/uploads)
├── org-123/
│   ├── task-456/
│   │   ├── 1700000000000-spec.pdf
│   │   └── 1700000000001-design.png
│   └── task-789/
│       └── 1700000000002-report.docx
└── org-456/
    └── task-abc/
        └── 1700000000003-data.csv
```

## Upload Flow

1. Client sends multipart form:
   ```
   POST /api/v1/files/upload?taskId=task456&orgId=org123
   Content-Type: multipart/form-data
   ```

2. File Service:
   - Validates JWT
   - Stores file in tenant-scoped directory
   - Saves metadata to MongoDB
   - Returns file record

## File Metadata
```typescript
interface FileRecord {
  _id: string;
  filename: string;        // Stored filename
  originalName: string;    // Original filename
  mimeType: string;
  size: number;            // Bytes
  path: string;            // Filesystem path
  organizationId: string;
  taskId?: string;
  uploadedBy: string;
  createdAt: Date;
}
```

## Security
- Maximum file size: 10MB
- MIME type stored but not strictly validated
- Files organized by organization ID
- Downloads require valid JWT

## Known Vulnerabilities
1. **Cross-tenant upload**: Uses `orgId` query parameter instead of JWT `organizationId`
2. **Cross-tenant download**: Does not verify file belongs to user's organization
3. **Missing org filter**: `GET /task/:taskId` returns files without organization filter

See `07-security.md` for details.
