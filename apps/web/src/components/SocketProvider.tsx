'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { usePlaybackStore } from '@/store/playback';
import type { BotEvent } from '@harmonia/types';

const SocketContext = createContext<Socket | null>(null);

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}

export default function SocketProvider({
  guildId,
  children,
}: {
  guildId: string;
  children: React.ReactNode;
}) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { setState, setQueue, setDjUserId } = usePlaybackStore();

  useEffect(() => {
    const s = io({ path: '/socket.io', transports: ['websocket'] });

    s.on('connect', () => {
      s.emit('join-guild', guildId);
    });

    s.on('event', (event: BotEvent) => {
      switch (event.type) {
        case 'PLAYBACK_STATE_CHANGED':
          setState(event.state);
          break;
        case 'QUEUE_UPDATED':
          setQueue(event.queue);
          break;
        case 'DJ_CHANGED':
          setDjUserId(event.userId);
          break;
        default:
          break;
      }
    });

    setSocket(s);

    return () => {
      s.emit('leave-guild', guildId);
      s.disconnect();
    };
  }, [guildId, setState, setQueue, setDjUserId]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
