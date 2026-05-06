import type { WebSocketServer, WebSocket } from 'ws';
import { auctions } from './db.js';

const clients = new Map<string, WebSocket[]>();

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const auctionId = url.searchParams.get('auctionId');
    
    if (!auctionId) {
      ws.close(4000, 'Missing auctionId');
      return;
    }
    
    const list = clients.get(auctionId) || [];
    list.push(ws);
    clients.set(auctionId, list);
    
    // Send current state
    const auction = auctions.get(auctionId);
    if (auction) {
      ws.send(JSON.stringify({ type: 'state', auction }));
    }
    
    ws.on('close', () => {
      const list = clients.get(auctionId) || [];
      clients.set(
        auctionId,
        list.filter(c => c !== ws)
      );
    });
  });
}

export function broadcastBid(auctionId: string, bid: any) {
  const list = clients.get(auctionId) || [];
  const message = JSON.stringify({ type: 'bid', bid });
  for (const ws of list) {
    if (ws.readyState === 1) {
      ws.send(message);
    }
  }
}
