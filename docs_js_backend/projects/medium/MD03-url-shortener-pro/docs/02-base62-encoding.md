# MD03: Base62 Encoding — The Mathematics of Short Codes

## Why 62 Characters?

A URL shortener needs to generate short, human-readable, URL-safe identifiers. The character set must:
1. Be **unambiguous** (no `0` vs `O`, no `1` vs `l` — though we include all)
2. Be **URL-safe** (no `/`, `?`, `&`, `=`, `%`)
3. Be **compact** (maximize information per character)

The standard choice is **Base62**:
- Digits: `0-9` (10 characters)
- Lowercase: `a-z` (26 characters)
- Uppercase: `A-Z` (26 characters)
- **Total: 62 characters**

## Information Density

Each Base62 character carries `log₂(62) ≈ 5.954` bits of information.

| Code Length | Total Combinations | Approximate Scale |
|-------------|-------------------|-------------------|
| 1 | 62 | Dozens |
| 2 | 3,844 | Thousands |
| 3 | 238,328 | Hundreds of thousands |
| 4 | 14,776,336 | ~15 million |
| 5 | 916,132,832 | ~1 billion |
| 6 | 56,800,235,584 | ~57 billion |
| 7 | 3,521,614,606,208 | ~3.5 trillion |

With just **7 characters**, we have 3.5 trillion possible codes — enough for every human on Earth to create 400 short links.

## Comparison with Other Bases

| Base | Characters | Bits/Char | 6-Char Combinations |
|------|-----------|-----------|---------------------|
| Base16 (Hex) | 0-9, a-f | 4.000 | 16,777,216 |
| Base36 | 0-9, a-z | 5.170 | 2,176,782,336 |
| **Base62** | 0-9, a-z, A-Z | **5.954** | **56,800,235,584** |
| Base64 | A-Z, a-z, 0-9, +/ | 6.000 | 68,719,476,736 |

Base64 is slightly denser but uses `+` and `/`, which require URL encoding (`%2B`, `%2F`). Base62 is the sweet spot.

## The Math: Base10 ↔ Base62 Conversion

### Encoding (Integer → Base62)

```
Algorithm:
  While n > 0:
    remainder = n % 62
    prepend charset[remainder] to result
    n = floor(n / 62)
  Return result

Example: Encode 12345
  12345 ÷ 62 = 199 remainder 7  → charset[7] = '7'
  199   ÷ 62 = 3   remainder 13 → charset[13] = 'd'
  3     ÷ 62 = 0   remainder 3  → charset[3] = '3'
  Result: "3d7"
```

```javascript
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function encodeBase62(num) {
    if (num === 0) return BASE62[0];
    let result = '';
    while (num > 0) {
        result = BASE62[num % 62] + result;
        num = Math.floor(num / 62);
    }
    return result;
}

function decodeBase62(str) {
    let result = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const value = BASE62.indexOf(char);
        if (value === -1) throw new Error(`Invalid character: ${char}`);
        result = result * 62 + value;
    }
    return result;
}

// Verify
console.log(encodeBase62(12345)); // "3d7"
console.log(decodeBase62("3d7")); // 12345
```

### Why Not Use a Hash (MD5/SHA)?

A cryptographic hash produces a fixed-length output (e.g., MD5 = 128 bits = 32 hex chars). This is too long for a short URL.

Instead, we can:
1. Hash the long URL to get a large number
2. Take a portion of it
3. Encode in Base62

But this introduces **collision risk** (see `03-hash-collisions.md`).

## Sequential vs. Random Codes

### Sequential Counter (Snowflake-Style)

Use a distributed counter (see `04-distributed-counters.md`) and encode the counter value:

```
Counter: 1      → "1"
Counter: 61     → "z"
Counter: 62     → "10"
Counter: 100000 → "q0u"
```

**Pros**: Guaranteed unique, monotonic, fast.
**Cons**: Predictable (`bit.ly/abc` → `bit.ly/abd`). Can be scraped.

### Random Code

Generate a random integer in the 6-7 character range:

```javascript
function generateRandomCode(length = 6) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += BASE62[Math.floor(Math.random() * 62)];
    }
    return result;
}
```

**Pros**: Unpredictable, resistant to scraping.
**Cons**: Collision possible (must check database).

### Hybrid: Counter + Shuffle

Use a counter but apply a **bijective function** (like a block cipher or Knuth's multiplicative hash) to shuffle the sequence:

```javascript
// Knuth's multiplicative hash for shuffling
function shuffleId(id, prime = 916132831, max = 56800235584) {
    return (id * prime) % max;
}

// Sequential IDs become seemingly random
shuffleId(1);  // 916132831
shuffleId(2);  // 1832265662
shuffleId(3);  // 2748398493
```

This gives the uniqueness of sequential counters with the unpredictability of random codes.

## Custom Aliases

Users may request specific codes:

```sql
-- Check if custom code is available
SELECT NOT EXISTS (
    SELECT 1 FROM urls WHERE short_code = 'sale2024'
) AS is_available;

-- Reserve it
INSERT INTO urls (short_code, long_url)
VALUES ('sale2024', 'https://example.com/summer-sale');
```

Custom aliases bypass the encoding scheme entirely. They must be checked against reserved words (`admin`, `api`, `login`) to prevent phishing.

## Key Insight

> "Base62 is not just a compression scheme. It is a bijection between the natural numbers and a URL-safe string space, enabling deterministic and reversible short code generation." — Number Theory in Computer Science

The choice of 62 is not arbitrary. It is the largest integer base that can be represented using only alphanumeric characters without URL encoding. This makes Base62 the mathematically optimal encoding for short URL identifiers.
