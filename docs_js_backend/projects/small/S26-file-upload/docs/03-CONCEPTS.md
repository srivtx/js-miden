# 03-CONCEPTS

## Magic Numbers
- **WHAT**: File signatures at the start of a file (e.g., PNG starts with `89 50 4E 47`).
- **WHY**: Extensions are user-controlled and meaningless.
- **HOW**: Use `file-type` to read the first few bytes and match against a whitelist.
- **WRONG**: `if (filename.endsWith('.png'))`.
- **RIGHT**: `const type = await fileTypeFromFile(path); if (!ALLOWED.includes(type.mime)) reject`.

## Path Traversal
- **WHAT**: Using `../` sequences in filenames to escape the intended directory.
- **WHY**: Attackers can overwrite system files or read sensitive data.
- **HOW**: Sanitize filenames using `path.basename()` or a UUID, never trust `originalname`.
- **WRONG**: `fs.writeFile(path.join('uploads', req.file.originalname), data)`.
- **RIGHT**: `const safe = crypto.randomUUID() + path.extname(req.file.originalname)`.

## Storage Abstraction
- **WHAT**: Interface that hides whether files are local or remote.
- **WHY**: Allows testing with local files and production with S3 without changing business logic.
- **HOW**: `interface Storage { store(temp, name): Promise<string>; retrieve(name): Promise<string|null>; }`.
