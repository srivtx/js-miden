import type { Server, Socket } from 'socket.io';

const rooms = new Map<string, Set<string>>();

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    socket.on('join', (room: string) => {
      socket.join(room);
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room)!.add(socket.id);

      // Notify room of join
      socket.to(room).emit('notification', { text: `${socket.id} joined ${room}` });
      socket.emit('joined', room);
    });

    socket.on('message', (data: { room: string; text: string }) => {
      // BUG: Broadcasts to ALL connected clients instead of just the room
      io.emit('message', {
        room: data.room,
        text: data.text,
        sender: socket.id,
      });
    });

    socket.on('leave', (room: string) => {
      socket.leave(room);
      rooms.get(room)?.delete(socket.id);
      socket.to(room).emit('notification', { text: `${socket.id} left ${room}` });
    });

    socket.on('disconnect', () => {
      for (const [room, users] of rooms) {
        if (users.has(socket.id)) {
          users.delete(socket.id);
          socket.to(room).emit('notification', { text: `${socket.id} disconnected` });
        }
      }
    });
  });
}
