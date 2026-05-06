export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'error';
  roomId: string;
  peerId: string;
  targetPeerId?: string;
  payload?: unknown;
  timestamp: number;
}

export interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface RTCIceCandidateInit {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface Room {
  id: string;
  peers: Set<string>;
  createdAt: number;
  maxPeers: number;
}

export interface Peer {
  id: string;
  ws: WebSocket;
  roomId: string | null;
  connectedAt: number;
}

export interface IceCandidateEntry {
  id: string;
  roomId: string;
  peerId: string;
  candidate: RTCIceCandidateInit;
  timestamp: number;
}