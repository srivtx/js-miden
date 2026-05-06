# M33: Old Patterns vs New Patterns

## 2015: `uuid` v3 + v4 only
```js
var uuid = require('uuid');
uuid.v4(); // Only option for random
```
- **Problems**: v4 is not time-sortable; database index fragmentation

## 2025: Native `crypto.randomUUID` + UUID v7
```ts
import { randomUUID } from 'crypto';
randomUUID(); // v4

// v7: time-sortable, native in some libraries
```
- **Benefits**: v7 replaces v1 (MAC address leak) and v4 (random) for database keys
- **Trend**: UUID v7 is now recommended by IETF for new systems

## ULID vs UUID v7
- ULID: 26 chars, base32, lexicographically sortable
- UUID v7: 36 chars, standard UUID format, time-sortable
- **2025 trend**: UUID v7 is gaining over ULID because it fits existing UUID columns
