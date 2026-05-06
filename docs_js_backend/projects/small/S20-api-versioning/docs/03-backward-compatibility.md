# 03-backward-compatibility.md

## WHAT

Backward compatibility means old clients continue to work.

## WHY

Breaking changes force all clients to update simultaneously, which is impossible at scale.

## HOW

Rules for backward compatibility:
- Don't remove fields
- Don't change field types
- Don't make optional fields required
- Add new fields as optional
- Return sensible defaults for new fields

When breaking changes are necessary, create a new version.
