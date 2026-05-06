# 03-extract.md

## WHAT

Extract reads raw data from the source system.

## WHY

Extraction should be fast and non-destructive. Don't modify source data.

## HOW

```typescript
async function extract(source: string): Promise<string> {
  // Read CSV file
  const data = await fs.readFile(source, 'utf-8');
  return data;
}
```

For large files:
- Stream data instead of loading entirely into memory
- Use pagination for API sources
- Handle connection failures with retry
