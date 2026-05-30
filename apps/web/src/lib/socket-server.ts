import type { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { Socket } from 'socket.io';
import { createSubscriber, keys } from '@harmonia/redis';
import type { BotEvent } from '@harmonia/types';

let io: SocketIOServer | null = null;
const guildSubscribers = new Map<string, ReturnType<typeof createSubscriber>>();

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    cors: { origin: process.env['NEXTAUTH_URL'] ?? '*', credentials: true },
    path: '/socket.io',
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join-guild', (guildId: string) => {
      socket.join(`guild:${guildId}`);
      ensureGuildSubscription(guildId);
    });

    socket.on('leave-guild', (guildId: string) => {
      socket.leave(`guild:${guildId}`);
    });
  });

  return io;
}

function ensureGuildSubscription(guildId: string): void {
  if (guildSubscribers.has(guildId)) return;

  const sub = createSubscriber();
  const channel = keys.eventChannel(guildId);

  sub.subscribe(channel).catch(console.error);
  sub.on('message', (_ch: string, message: string) => {
    try {
      const event = JSON.parse(message) as BotEvent;
      io?.to(`guild:${guildId}`).emit('event', event);
    } catch {
      // ignore malformed messages
    }
  });

  guildSubscribers.set(guildId, sub);
}

export function getIO(): SocketIOServer | null {
  return io;
}
