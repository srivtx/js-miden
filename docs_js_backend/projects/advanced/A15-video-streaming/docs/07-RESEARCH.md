# Research & References

## HLS Specification
- Apple HLS Authoring Specification: https://developer.apple.com/documentation/http_live_streaming
- RFC 8216: HTTP Live Streaming

## DASH Specification
- MPEG-DASH ISO/IEC 23009-1
- DASH-IF Guidelines: https://dashif.org/guidelines/

## FFmpeg
- FFmpeg Streaming Guide: https://trac.ffmpeg.org/wiki/StreamingGuide
- HLS encoding command:
  ```bash
  ffmpeg -i input.mp4 \
    -filter_complex "[0:v]split=3[v1][v2][v3]; [v1]scale=1920:1080[v1out]; [v2]scale=1280:720[v2out]; [v3]scale=854:480[v3out]" \
    -map [v1out] -c:v libx264 -b:v 5000k -f hls -hls_time 6 1080p/playlist.m3u8 \
    -map [v2out] -c:v libx264 -b:v 2500k -f hls -hls_time 6 720p/playlist.m3u8 \
    -map [v3out] -c:v libx264 -b:v 1000k -f hls -hls_time 6 480p/playlist.m3u8
  ```

## HTTP Range Requests
- RFC 7233: Range Requests
- MDN: https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests

## CDN Best Practices
- CloudFront Origin Shield: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html
- Cache-Control for video: `Cache-Control: public, max-age=31536000, immutable`
