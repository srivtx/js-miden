# Streaming Encryption

## The Problem
Loading a 10 GB video into memory to encrypt it will:
1. Exhaust RAM and crash the process
2. Block the event loop
3. Violate Node.js memory limits

**Solution**: Encrypt and decrypt in chunks (streaming), holding only a small buffer at a time.

## How AES-GCM Streaming Works

AES-GCM is not naturally a streaming cipher because the authentication tag (GHASH) is computed over the **entire** ciphertext. However, we can stream the plaintext **into** the cipher and stream the ciphertext **out**.

```
File on disk (10 GB)
┌────────────────────────────────────────────────────┐
│ chunk 0 │ chunk 1 │ chunk 2 │ ... │ chunk N        │
│  64 KB  │  64 KB  │  64 KB  │     │  < 64 KB       │
└────┬────┴────┬────┴────┬────┴─────┴────┬───────────┘
     │         │         │               │
     ▼         ▼         ▼               ▼
┌─────────┐ ┌─────────┐ ┌─────────┐   ┌─────────┐
│ cipher  │ │ cipher  │ │ cipher  │   │ cipher  │
│ .update │ │ .update │ │ .update │   │ .final  │
│ (chunk) │ │ (chunk) │ │ (chunk) │   │ + tag   │
└────┬────┘ └────┬────┘ └────┬────┘   └────┬────┘
     │           │           │             │
     ▼           ▼           ▼             ▼
  ciphertext stream  ───────────────────────▶  Storage
                                               (IV + tag + chunks)
```

## Node.js Streaming Implementation

```typescript
import { createReadStream, createWriteStream } from 'fs';
import { createCipheriv, randomBytes, scryptSync } from 'crypto';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;
const CHUNK_SIZE = 64 * 1024; // 64 KB

export async function encryptFile(inputPath: string, outputPath: string, key: Buffer) {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);

  const writeStream = createWriteStream(outputPath);
  // Write IV first
  writeStream.write(iv);

  await pipeline(
    createReadStream(inputPath, { highWaterMark: CHUNK_SIZE }),
    cipher,
    writeStream
  );

  // Append authentication tag at the end
  const tag = cipher.getAuthTag();
  writeStream.write(tag);
  writeStream.end();
}
```

## Decrypting a Stream

The receiver reads the IV first, then decrypts chunks, and finally validates the tag.

```typescript
import { createReadStream, createWriteStream } from 'fs';
import { createDecipheriv } from 'crypto';
import { Readable, pipeline } from 'stream';

export async function decryptFile(inputPath: string, outputPath: string, key: Buffer) {
  const readStream = createReadStream(inputPath);

  // Extract IV
  const iv = await readBytes(readStream, IV_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);

  // We need to hold back the last TAG_LEN bytes for setAuthTag()
  // A simple approach: stream to a temp file, then set tag at end.
  // For true streaming, use a Transform that buffers the tail.
  const tailBuffer = new TailBuffer(TAG_LEN);

  await pipeline(
    readStream,
    tailBuffer,
    decipher,
    createWriteStream(outputPath)
  );

  decipher.setAuthTag(tailBuffer.tail);
  decipher.final(); // throws if tampered
}

class TailBuffer extends Transform {
  private buf = Buffer.alloc(0);
  public tail = Buffer.alloc(0);

  constructor(private tailLen: number) { super(); }

  _transform(chunk: Buffer, _encoding: string, callback: Function) {
    this.buf = Buffer.concat([this.buf, chunk]);
    const cutoff = this.buf.length - this.tailLen;
    if (cutoff > 0) {
      this.push(this.buf.subarray(0, cutoff));
      this.tail = this.buf.subarray(cutoff);
      this.buf = Buffer.alloc(0);
    }
    callback();
  }

  _flush(callback: Function) {
    // At this point, `this.tail` holds the final TAG_LEN bytes
    callback();
  }
}
```

## Chunked Architecture for Very Large Files

For files larger than memory limits, split into independently encrypted **segments**:

```
Segmented File Layout
┌────────┬────────┬────────┬────────┬─────────────────┐
│ Seg 0  │ Seg 1  │ Seg 2  │ ...    │ Footer          │
│ Header │ Header │ Header │        │ (segment table) │
│+ Ciphertext│+ Ciphertext│+ Ciphertext│               │
└────────┴────────┴────────┴────────┴─────────────────┘

Segment Header (per segment):
- IV (16 bytes)
- Tag (16 bytes)
- Plaintext length (8 bytes)
```

This allows:
- **Random access decryption** (seek to a segment)
- **Parallel upload/download** of segments
- **Resumable transfers**

## Security Considerations

| Concern | Mitigation |
|---|---|
| **Nonce reuse** | Generate a fresh random IV for every file (and every segment if segmented) |
| **Tag truncation** | Always use full 16-byte tag; never accept partial tags |
| **Timing attacks** | Use `timingSafeEqual` when comparing derived tags (though GCM handles this internally) |
| **Memory DoS** | Cap chunk size; use backpressure (`pipeline` handles this) |

## OWASP Reference
> "Encrypt large data using streaming APIs to avoid loading entire payloads into memory. Verify the authentication tag before trusting decrypted data." — OWASP Cryptographic Storage Cheat Sheet
