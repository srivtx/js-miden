# 00-PROBLEM

## WHAT
Build a secure file upload service that handles multipart forms, validates file types by magic numbers (not extensions), scans for viruses, enforces size limits, abstracts storage (local/S3), and performs image processing.

## WHY
Untrusted file uploads are one of the most common attack vectors. Developers often trust file extensions, skip validation, and write directly to disk without sanitizing filenames. A single upload endpoint can lead to remote code execution, path traversal, or SSRF.

## Constraints
- Must support files up to 5MB.
- Must reject files based on magic numbers.
- Must not block the event loop during image processing.
- Must abstract storage so S3 can be swapped in without code changes.
- Virus scanning may be a stub, but the interface must support a real integration later.
