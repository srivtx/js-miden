# Old vs. New

## Old Approach: Monolithic File Serving

```javascript
// Old: Serve entire file, no streaming support
app.get('/video', (req, res) => {
  res.sendFile('/path/to/video.mp4'); // Downloads entire file
});
```

Problems:
- Cannot seek without downloading whole file
- No quality adaptation
- Wastes bandwidth on mobile/low-bandwidth connections
- Single point of failure for large files

## New Approach: Segmented Adaptive Streaming

```typescript
// New: HLS/DASH with range request support
app.get('/streams/video/:id', rangeRequest, streamVideo);
app.get('/streams/hls/:id/master.m3u8', getHlsManifest);
app.get('/streams/segment/:id/:variant/:segment', getSegment);
```

Benefits:
- Instant seeking via range requests
- Quality adapts to network conditions
- Segments cache efficiently at CDN edge
- Supports live and on-demand content

## Evolution of Upload Handling

| Aspect | Old | New |
|--------|-----|-----|
| Upload | Single POST, timeout prone | Chunked, resumable sessions |
| Storage | Flat directory | Hierarchical by video/variant |
| Processing | Synchronous blocking | Async worker queue |
| Metadata | File name only | Rich JSON with variants |
