# 02-architecture.md

## WHAT

The API routes requests to the appropriate version handler.

## WHY

Centralized version routing ensures consistent behavior and allows monitoring per version.

## HOW

```
Client → Version Router → v1 Handler → v1 Response
                    → v2 Handler → v2 Response
```

- Version is determined by URL path or Accept header
- Each version has its own route handlers
- Transformation functions convert between formats
