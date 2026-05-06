# S04 Image Resizer — References

## Sharp & libvips

1. **Sharp Documentation**
   https://sharp.pixelplumbing.com/
   > Official API reference for resize, format conversion, streaming, and concurrency control.

2. **libvips Performance Benchmarks**
   https://github.com/libvips/libvips/wiki/Speed-and-memory-use
   > Compares libvips against ImageMagick, GraphicsMagick, and OpenCV for resize and thumbnail operations.

3. **Sharp GitHub — Issue #1476 (Memory Management)**
   https://github.com/lovell/sharp/issues/1476
   > Community discussion on controlling native memory usage in containerized environments.

## Image Formats

4. **Google Developers — WebP**
   https://developers.google.com/speed/webp
   > Compression study showing WebP is 25-34% smaller than JPEG.

5. **AVIF Comparison by Netflix**
   https://netflixtechblog.com/avif-for-next-generation-image-coding-b1d75675fe4
   > Netflix's analysis of AVIF efficiency vs. JPEG and WebP.

6. **MDN — Image File Types and Format Guides**
   https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
   > Browser support matrix for JPEG, PNG, WebP, AVIF, and GIF.

## Security

7. **OWASP — Unrestricted File Upload**
   https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload
   > Why trusting MIME types and extensions is dangerous; recommends magic-byte validation.

8. **File-type npm package**
   https://github.com/sindresorhus/file-type
   > Detects file type by reading magic bytes; supports 100+ formats.

## Streams & Memory

9. **Node.js Documentation — Stream**
   https://nodejs.org/api/stream.html
   > Why streams are essential for memory-efficient file processing.

10. **Node.js — Backpressure in Streams**
    https://nodejs.org/es/docs/guides/backpressuring-in-streams/
    > How to handle backpressure when piping Sharp output to HTTP responses.

## Multer & Upload Security

11. **Multer Documentation**
    https://github.com/expressjs/multer
    > Configuration for file size limits, file filters, and storage engines.

12. **Express.js — Production Best Practices**
    https://expressjs.com/en/advanced/best-practice-performance.html
    > Guidance on error handling, process managers, and graceful shutdown.
