# M35: Old Patterns vs New Patterns

## 2015: Moment.js with `moment-timezone`
```js
var moment = require('moment-timezone');
moment.tz('2024-07-01 12:00', 'UTC').tz('America/New_York').format();
```
- **Problems**: Mutable, 232KB bundle, now in legacy mode

## 2025: `Intl.DateTimeFormat` or `date-fns-tz`
```ts
import { formatInTimeZone } from 'date-fns-tz';
formatInTimeZone(date, 'America/New_York', 'yyyy-MM-dd HH:mm:ss');
```
- **Benefits**: Immutable, tree-shakeable, native Intl backend

## Native Alternative
```ts
new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/New_York',
  dateStyle: 'full',
  timeStyle: 'long',
}).format(new Date());
```
- No dependencies, built into Node.js, automatically updates with ICU
