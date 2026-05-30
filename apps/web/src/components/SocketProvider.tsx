'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { usePlaybackStore } from '@/store/playback';
import { useQueryClient } from '@tanstack/react-query';
import type { BotEvent, PlaybackState, TrackInQueue } from '@harmonia/types';
import { apiFetch } from '@/lib/api';

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
  const { setState, setQueue, setDjUserId, setBotError } = usePlaybackStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    const s = io({ path: '/socket.io', transports: ['websocket'] });

    s.on('connect', () => {
      s.emit('join-guild', guildId);
      queryClient.invalidateQueries({ queryKey: ['dj', guildId] });

      apiFetch<PlaybackState>(`/api/guild/${guildId}/playback`)
        .then((playback) => {
          setState(playback);
          return apiFetch<TrackInQueue[]>(`/api/guild/${guildId}/queue`);
        })
        .then((queue) => setQueue(queue ?? []))
        .catch(() => {});
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
          queryClient.invalidateQueries({ queryKey: ['dj', guildId] });
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
  }, [guildId, queryClient, setState, setQueue, setDjUserId, setBotError]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
