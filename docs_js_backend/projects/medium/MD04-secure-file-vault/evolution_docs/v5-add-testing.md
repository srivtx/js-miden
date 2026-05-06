# MD04 Secure File Vault — v5 Adding Testing

## The Bug

You "fixed" encryption. You wrote:

```ts
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
```

You deploy. A user downloads a file. It's corrupted. You check. You forgot to append the GCM authentication tag. The decryption succeeds (OpenSSL doesn't error) but produces garbage. Without the auth tag, an attacker could modify the ciphertext undetected.

Tests would have caught this.

## The Fix: Comprehensive Tests

### Unit Tests: Encryption

```ts
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../src/crypto/encryption';

describe('Encryption', () => {
  it('round-trips data correctly', () => {
    const plaintext = Buffer.from('Hello, secure world!');
    const { ciphertext, iv, tag } = encrypt(plaintext, process.env.ENCRYPTION_KEY!);
    const decrypted = decrypt(ciphertext, iv, tag, process.env.ENCRYPTION_KEY!);
    expect(decrypted.toString()).toBe('Hello, secure world!');
  });

  it('produces different ciphertexts for same plaintext', () => {
    const plaintext = Buffer.from('Hello');
    const a = encrypt(plaintext, process.env.ENCRYPTION_KEY!);
    const b = encrypt(plaintext, process.env.ENCRYPTION_KEY!);
    expect(a.ciphertext.toString('hex')).not.toBe(b.ciphertext.toString('hex'));
  });

  it('fails on tampered ciphertext', () => {
    const plaintext = Buffer.from('Secret');
    const { ciphertext, iv, tag } = encrypt(plaintext, process.env.ENCRYPTION_KEY!);

    ciphertext[0] ^= 0xFF; // Flip bits

    expect(() => {
      decrypt(ciphertext, iv, tag, process.env.ENCRYPTION_KEY!);
    }).toThrow();
  });

  it('fails on wrong key', () => {
    const plaintext = Buffer.from('Secret');
    const { ciphertext, iv, tag } = encrypt(plaintext, process.env.ENCRYPTION_KEY!);

    expect(() => {
      decrypt(ciphertext, iv, tag, 'wrong-key-'.repeat(4));
    }).toThrow();
  });
});
```

### Integration Tests: Upload/Download

```ts
import { describe, it, expect } from 'vitest';
import { createTestDatabase } from './helpers/db';
import { FileVaultService } from '../src/services/fileVaultService';
import { createReadStream } from 'fs';

describe('FileVaultService', () => {
  it('uploads and retrieves a file', async () => {
    const db = await createTestDatabase();
    const vault = new FileVaultService(db);

    const buffer = Buffer.from('Test file content');
    const file = await vault.upload(buffer, {
      filename: 'test.txt',
      originalName: 'test.txt',
      contentType: 'text/plain',
      size: buffer.length,
      ownerId: 'user-1',
    });

    expect(file.id).toBeDefined();
    expect(file.checksum).toBeDefined();

    const { stream, meta } = await vault.download(file.id, 'user-1');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    const downloaded = Buffer.concat(chunks);

    expect(downloaded.toString()).toBe('Test file content');
    expect(meta.filename).toBe('test.txt');
  });

  it('rejects unauthorized download', async () => {
    const db = await createTestDatabase();
    const vault = new FileVaultService(db);

    const buffer = Buffer.from('Secret');
    const file = await vault.upload(buffer, {
      filename: 'secret.txt',
      originalName: 'secret.txt',
      contentType: 'text/plain',
      size: buffer.length,
      ownerId: 'user-1',
    });

    await expect(
      vault.download(file.id, 'user-2')
    ).rejects.toThrow('Unauthorized');
  });

  it('enforces size limits', async () => {
    const db = await createTestDatabase();
    const vault = new FileVaultService(db);

    const hugeBuffer = Buffer.alloc(101 * 1024 * 1024); // 101MB
    await expect(
      vault.upload(hugeBuffer, {
        filename: 'huge.bin',
        originalName: 'huge.bin',
        contentType: 'application/octet-stream',
        size: hugeBuffer.length,
        ownerId: 'user-1',
      })
    ).rejects.toThrow('exceeds');
  });
});
```

### Signed URL Tests

```ts
describe('Signed URLs', () => {
  it('allows download with valid signed URL', async () => {
    const db = await createTestDatabase();
    const vault = new FileVaultService(db);

    const buffer = Buffer.from('Shared content');
    const file = await vault.upload(buffer, {
      filename: 'shared.txt',
      originalName: 'shared.txt',
      contentType: 'text/plain',
      size: buffer.length,
      ownerId: 'user-1',
    });

    const signed = await vault.createSignedUrl({
      fileId: file.id,
      expiresInMinutes: 5,
    });

    const { stream } = await vault.downloadWithSignedUrl(signed.url);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString()).toBe('Shared content');
  });

  it('rejects expired signed URL', async () => {
    const db = await createTestDatabase();
    const vault = new FileVaultService(db);

    const buffer = Buffer.from('Temp');
    const file = await vault.upload(buffer, {
      filename: 'temp.txt',
      originalName: 'temp.txt',
      contentType: 'text/plain',
      size: buffer.length,
      ownerId: 'user-1',
    });

    const signed = await vault.createSignedUrl({
      fileId: file.id,
      expiresInMinutes: 0, // Already expired
    });

    // Fast-forward time (mock clock)
    jest.advanceTimersByTime(60000);

    await expect(
      vault.downloadWithSignedUrl(signed.url)
    ).rejects.toThrow('Expired');
  });
});
```

## What Tests Caught

- Missing GCM auth tag → caught (round-trip test)
- Tampered ciphertext accepted → caught (integrity test)
- Wrong key accepted → caught (key validation)
- Unauthorized download → caught (ACL test)
- Size limit bypass → caught (boundary test)
- Expired signed URL works → caught (TTL test)

## The Confidence

Now you can rotate encryption keys, switch storage backends, or add streaming compression and know that:
1. Encryption is authenticated
2. Access control works
3. Size limits are enforced
4. Signed URLs expire correctly
5. Audit logs are accurate

**Next:** Let's modernize the module system.
