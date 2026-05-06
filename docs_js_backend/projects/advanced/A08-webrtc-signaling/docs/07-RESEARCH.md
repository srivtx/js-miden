# Research Notes

## Standards & RFCs

1. **WebRTC 1.0: Real-Time Communication Between Browsers**
   W3C Recommendation, 2021.
   https://www.w3.org/TR/webrtc/
   Key finding: Signaling is explicitly out of scope. The spec defines the peer connection API but leaves the signaling channel to the application.

2. **RFC 8445: Interactive Connectivity Establishment (ICE)**
   Rosenberg, J., 2018.
   https://datatracker.ietf.org/doc/html/rfc8445
   Key finding: ICE gathers candidates in priority order (host > srflx > relay) and performs connectivity checks using STUN binding requests.

3. **RFC 5389: Session Traversal Utilities for NAT (STUN)**
   Rosenberg, J., et al., 2008.
   https://datatracker.ietf.org/doc/html/rfc5389
   Key finding: STUN is a lightweight request/response protocol for discovering public IP:port mappings.

4. **RFC 8656: Traversal Using Relays around NAT (TURN)**
   Lennox, J., et al., 2020.
   https://datatracker.ietf.org/doc/html/rfc8656
   Key finding: TURN allocates a relay address on the server and forwards packets. Required for symmetric NAT traversal.

5. **RFC 3711: The Secure Real-time Transport Protocol (SRTP)**
   Baugher, M., et al., 2004.
   https://datatracker.ietf.org/doc/html/rfc3711
   Key finding: SRTP provides confidentiality and message authentication for RTP media streams. WebRTC uses it for all media.

6. **RFC 6455: The WebSocket Protocol**
   Fette, I., & Melnikov, A., 2011.
   https://datatracker.ietf.org/doc/html/rfc6455
   Key finding: WebSocket provides full-duplex communication over a single TCP connection with a lightweight framing protocol.

## Books

7. **Johnston, A. B., & Burnett, D. C.** *WebRTC: APIs and RTCWEB Protocols of the HTML5 Real-Time Web*. Digital Codex LLC, 2012.
   The definitive guide to WebRTC protocol internals.

## Academic Papers

8. **Singh, V., & Ott, J.** "Evaluating Congestion Control for Interactive Real-Time Communication." *ACM MMSys*, 2013.
   Key finding: GCC (Google Congestion Control) is the default algorithm in WebRTC. It adapts bitrate based on delay and loss.

## Industry Sources

9. **"WebRTC Signaling Concepts," MDN Web Docs, Mozilla.**
   https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling

10. **"NAT Traversal with WebRTC," webrtc.org, Google.**
    https://webrtc.org/getting-started/turn-server

## Tools

11. **Coturn — Open Source TURN Server**
    https://github.com/coturn/coturn
    Production-grade TURN/STUN server used by Jitsi, Nextcloud Talk, and Matrix.

12. **WebRTC Internals (Chrome)**
    chrome://webrtc-internals/
    Live debugging of ICE state, candidate pairs, bandwidth estimates, and codec stats.

## Related Systems

13. **Janus WebRTC Server**
    https://github.com/meetecho/janus-gateway
    General-purpose WebRTC gateway with SFU, MCU, and recording capabilities.

14. **Mediasoup**
    https://mediasoup.org/
    Modern WebRTC SFU with Node.js/Rust/Ruby/C++ APIs. Used by Around, Watchrtc, and others.

15. **Pion (Go)**
    https://github.com/pion/webrtc
    Pure Go implementation of WebRTC. Excellent for learning internals.

## Benchmarks

| Metric | WebSocket Signaling | HTTP Polling | SSE |
|--------|---------------------|--------------|-----|
| Latency | ~5ms | ~250ms | ~20ms |
| Connection overhead | 1 TCP | 1 TCP per poll | 1 TCP |
| Bidirectional | Yes | No | No |
| Browser support | 99%+ | 100% | 98%+ |

## Industry Adoption

- **Discord**: Custom WebSocket signaling (Erlang/Elixir). Handles 4M+ concurrent voice channels.
- **Zoom**: Initially used proprietary protocol, now migrating to WebRTC for browser clients. Their signaling handles 300M+ daily participants.
- **Jitsi Meet**: Open-source WebRTC video conferencing. Uses XMPP (Jicofo) for signaling, Prosody for presence.
- **Google Meet**: Custom signaling over QUIC/HTTP/2. Uses SFU for groups > 3.
