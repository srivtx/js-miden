# v1 — The Naive Data Sync (Pure JS)

You want to keep two clients in sync. You build a quick WebSocket relay.

```js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const documents = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    if (data.type === 'save') {
      documents.set(data.id, data.content);
    }
    
    if (data.type === 'get') {
      ws.send(JSON.stringify({ id: data.id, content: documents.get(data.id) }));
    }
    
    // Broadcast to all other clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});

console.log('Sync server on 8080');
```

Save a document. Broadcast changes. Done.

## Then the Pain Hits

**No offline support.** A client goes offline, edits a document, comes back online. Their changes overwrite whatever was saved while they were gone. Data is lost silently.

**No conflict handling.** Two clients edit the same document simultaneously. The last one to broadcast wins. The first client's changes vanish without a trace.

**No deletion propagation.** Alice deletes a document. Bob was offline. Bob comes back and broadcasts his old copy. The deleted document resurrects. Alice is confused.

**No ordering guarantees.** Message A arrives before message B on the server, but Bob receives B before A due to network jitter. The document state diverges.

**No persistence.** Restart the server and all documents are gone.

## The Realization

Broadcasting raw messages is not sync. You need:
1. **Causality tracking** — know which events happened before others
2. **Conflict-free merging** — concurrent edits must not lose data
3. **Tombstones** — deletions must propagate and stick
4. **Offline-first** — clients must work without the server
5. **Encryption** — data in transit and at rest must be private

This is where the evolution starts.
