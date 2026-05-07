# Fundamentals: UUID Generation

**Task:** Generate UUID v4 from crypto random bytes.

```javascript
import { randomUUID } from 'node:crypto';
const uuid = randomUUID(); // '550e8400-e29b-41d4-a716-446655440000'
```

UUID v4: 122 random bits. 2^122 combinations.
