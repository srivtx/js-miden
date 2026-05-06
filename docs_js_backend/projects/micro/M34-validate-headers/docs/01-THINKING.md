# M34: Mental Models

## Hot Path
1. Request arrives with headers
2. For each rule, look up header value
3. Run required check, then pattern/validator check
4. Accumulate errors
5. If strict mode: abort with 400
6. If lenient mode: attach warnings and continue

## Danger Zones
- **Case sensitivity**: HTTP headers are case-insensitive. Looking up `req.headers['content-type']` vs `req.headers['Content-Type']` yields different results in some Node.js versions
- **Duplicate headers**: Node.js concatenates duplicates with `, `. Regex patterns must handle this
- **Type coercion**: `req.headers` values are `string | string[] | undefined`
- **Performance**: Validating every header on every request adds latency; cache compiled regexes

## Key Insight
HTTP/1.1 (RFC 2616) and HTTP/2 (RFC 7540) both treat header field names as case-insensitive. Node.js lowercases incoming headers, but custom frameworks or proxies may preserve original case. Your lookup must normalize.
