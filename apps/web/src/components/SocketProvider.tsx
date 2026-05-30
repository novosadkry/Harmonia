'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { usePlaybackStore } from '@/store/playback';
import { apiFetch } from '@/lib/api';
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
  const { setState, setCurrentTrack, setQueue, setDjUserId, setBotError } = usePlaybackStore();

  useEffect(() => {
    const s = io({ path: '/socket.io', transports: ['websocket'] });

    s.on('connect', () => {
      s.emit('join-guild', guildId);
      // Hydrate initial DJ state — socket events only fire on changes
      apiFetch<{ userId: string | null }>(`/api/guild/${guildId}/dj`)
        .then((data) => setDjUserId(data.userId))
        .catch(() => {});
    });

    s.on('event', (event: BotEvent) => {
      switch (event.type) {
        case 'TRACK_STARTED':
          setCurrentTrack(event.track);
          break;
        case 'TRACK_ENDED':
          setCurrentTrack(null);
          break;
        case 'PLAYBACK_STATE_CHANGED':
          setState(event.state);
          if (event.state.status === 'stopped')
            setCurrentTrack(null);
          break;
        case 'QUEUE_UPDATED':
          setQueue(event.queue);
          break;
        case 'DJ_CHANGED':
          setDjUserId(event.userId);
          break;
        case 'BOT_ERROR':
          setBotError(event.error);
          break;
        case 'BOT_JOINED':
          setBotError(null);
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
  }, [guildId, setState, setQueue, setDjUserId, setBotError]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
