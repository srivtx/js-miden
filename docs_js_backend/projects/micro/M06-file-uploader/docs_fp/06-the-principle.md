# M06 File Uploader: The Principle

## The Principle

> **Never let a stranger name the file, choose the room, or hand it directly to the guests.**

## Why This Matters

File upload is the only HTTP operation where the client sends binary data that your server will persist, name, and potentially execute. Every other operation — GET, POST JSON, form data — deals with text you can inspect. File upload deals with opaque payloads.

The principle has four parts:

1. **Sanitize the name.**
   The filename is metadata, not content. It can contain path traversal, null bytes, Unicode homoglyphs, and shell metacharacters. Treat it as toxic. Generate your own name.

2. **Validate the content.**
   MIME types lie. Extensions lie. Only the bytes tell the truth. Check magic numbers. Parse the file with a library. If it is not what it claims to be, reject it.

3. **Isolate the storage.**
   User-generated files do not belong in the webroot. They do not belong next to application code. They belong in a quarantined directory, served through a gatekeeper, on a separate domain if possible.

4. **Bound the resources.**
   Every upload consumes disk, memory, and CPU. Without limits, one user can exhaust all three. Enforce size limits. Enforce rate limits. Enforce per-user quotas.

## The One-Sentence Rule

Before allowing any file upload, ask:

> "If the most malicious actor on the internet crafted this file specifically to destroy my system, what would happen?"

If the answer is "they could overwrite my server code, steal user data, or turn my domain into a malware host," your upload handler is not ready.

## The Deeper Pattern

This principle extends beyond HTTP file uploads:

- **Email attachments:** Sanitize filenames, scan for malware, sandbox execution.
- **CI/CD artifact uploads:** Validate signatures, quarantine untrusted builds, scan for secrets.
- **Package managers (npm, PyPI):** Validate metadata, scan for malicious post-install scripts, isolate installation.
- **LLM file ingestion:** Parse documents in a sandbox, prevent prompt injection via crafted PDFs.

In every case, the pattern is identical:
1. Untrusted binary data arrives at the boundary.
2. You must decide: accept, reject, or quarantine.
3. That decision requires validation at multiple layers.
4. The data must be stored in isolation from critical systems.

## The Final Test

Hand your upload endpoint to a penetration tester. Give them one instruction: "Break this." If they come back in an hour with shell access, you failed. If they come back in a week with a report of minor information disclosure, you succeeded.

> The goal is not perfect security. The goal is to raise the attacker's cost so high that they move to an easier target. File upload is where many developers lower their guard because "it is just an image." Do not be one of them.
