# Three Wrong Ways to Hash Passwords

---

## Wrong #1: MD5

```javascript
const hash = crypto.createHash('md5').update(password).digest('hex');
```

**Why it looks right:** MD5 is a hash function. It produces a fixed-size output.

**Why it's wrong:**
- MD5 is **broken**. Collisions can be found in seconds.
- MD5 is **fast**. 200 billion hashes per second on a GPU.
- MD5 has no salt. Rainbow tables exist for every common password.

**Real-world:** LinkedIn used SHA-1 (slightly better than MD5, still broken). 6.5 million passwords cracked in hours.

---

## Wrong #2: Client-Side Hashing

```javascript
// Browser
const hash = sha256(password);
fetch('/login', { body: JSON.stringify({ username, hash }) });
```

**Why it looks right:** The server never sees the plaintext password. Privacy!

**Why it's wrong:**
- The "hash" becomes the password. If the database leaks, attackers use the hashes directly.
- You can't salt client-side (the salt would be public).
- It provides zero additional security.

**The server must hash.** Client-side hashing is theater.

---

## Wrong #3: Custom "Encryption"

```javascript
function encryptPassword(password) {
  const key = 'my-secret-key-123';
  return password.split('').map((c, i) => 
    String.fromCharCode(c.charCodeAt(0) ^ key.charAt(i % key.length).charCodeAt(0))
  ).join('');
}
```

**Why it looks right:** It's "encryption." The output looks scrambled.

**Why it's wrong:**
- This is XOR cipher. It's broken by frequency analysis.
- The "key" is hardcoded and 17 bytes long.
- It's reversible. Anyone with the code can decrypt.

**Rule:** Never roll your own crypto. Use bcrypt, Argon2, or scrypt.
