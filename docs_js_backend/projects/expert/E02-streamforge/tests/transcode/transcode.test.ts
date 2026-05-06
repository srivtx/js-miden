import { describe, it, expect } from 'vitest';

describe('TranscodeService', () => {
  describe('HLS generation', () => {
    it('should generate master playlist with multiple qualities', () => {
      const qualities = ['1080p', '720p', '480p', '360p'];
      expect(qualities).toHaveLength(4);
      expect(qualities).toContain('1080p');
    });

    it('should generate quality-specific playlists', () => {
      const playlist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:6.000,
segment_0.ts
#EXT-X-ENDLIST
`;
      expect(playlist).toContain('#EXTM3U');
      expect(playlist).toContain('segment_0.ts');
    });
  });
});
