# M32: Mental Models

## Hot Path
1. Client sends `Accept: application/json, text/html;q=0.9, */*;q=0.8`
2. Parse into weighted list: `[{type:'application',subtype:'json',q:1.0}, ...]`
3. Sort by q-value descending
4. Iterate supported formats, return first match
5. If no match, default to JSON

## Danger Zones
- **Wildcard handling**: `*/*`, `application/*`, and `text/*` must be handled before exact matching or the match logic fails
- **Malformed headers**: Missing q-values, invalid MIME types, empty strings
- **Priority inversion**: A client sending `text/plain;q=1.0, application/json;q=0.5` must get plain text even if JSON is server-preferred
- **Charset confusion**: `Accept-Charset` is separate but often conflated

## Key Insight
Content negotiation is a bipartite matching problem between client preferences and server capabilities. The server's preference order (JSON first) is irrelevant when the client explicitly ranks formats. Wildcards are catch-alls, not exact types.
