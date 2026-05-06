# M32: Senior Engineer Review

## Strengths
- Teaches the RFC 7231 algorithm explicitly
- Extensible formatter structure
- Clean `res.negotiate()` API

## Weaknesses
- **Reinventing the wheel**: Express already has `req.accepts()`
- **No `Vary: Accept` header**: Caches may serve wrong format to different clients
- **XML formatter is naive**: Just wraps JSON in a tag; not real XML serialization

## Recommendations
1. For production, use `req.accepts(['json', 'html'])` and early-return patterns
2. Always set `Vary: Accept` when negotiating
3. Use `fast-xml-parser` or `xml2js` for real XML generation
4. Add charset negotiation (`Accept-Charset`) if serving non-UTF-8 locales

## Grade: B
Good for learning, but production code should use built-in Express utilities.
