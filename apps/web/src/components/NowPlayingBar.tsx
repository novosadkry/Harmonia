'use client';

import { usePlaybackStore } from '@/store/playback';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';

async function sendCommand(guildId: string, command: object) {
  await apiFetch(`/api/guild/${guildId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });
}

export default function NowPlayingBar({ guildId }: { guildId: string }) {
  const { state } = usePlaybackStore();
  const [elapsed, setElapsed] = useState(0);
  const [localVolume, setLocalVolume] = useState(state.volume);
  const isLoading = state.status === 'loading';

  useEffect(() => {
    setLocalVolume(state.volume);
  }, [state.volume]);

  const commandMutation = useMutation({
    mutationFn: (command: object) => sendCommand(guildId, command),
  });

  useEffect(() => {
    if (state.status !== 'playing' || !state.startedAt) {
      setElapsed(
        state.pausedAt && state.startedAt ? (state.pausedAt - state.startedAt) / 1000 : 0,
      );
      return;
    }
    const interval = setInterval(() => {
      setElapsed((Date.now() - (state.startedAt ?? 0)) / 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [state.status, state.startedAt, state.pausedAt]);

  const duration = state.currentTrack?.durationSeconds ?? 0;
  const progress = duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0;

  if (!state.currentTrack) {
    return (
      <div className="h-20 bg-surface border-t border-white/5 flex items-center justify-center">
        <p className="text-sm text-white/30">No track playing</p>
      </div>
    );
  }

  return (
    <div className="relative h-20 bg-surface border-t border-white/5 flex items-center px-6 gap-6">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 overflow-hidden">
        {isLoading ? (
          <div className="relative h-full">
            <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent animate-shimmer" />
          </div>
        ) : (
          <div
            className="h-full bg-accent transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        )}
      </div>

      {state.currentTrack.thumbnailUrl && (
        <Image
          src={state.currentTrack.thumbnailUrl}
          alt={state.currentTrack.title}
          width={48}
          height={48}
          className="rounded-lg object-cover"
        />
      )}

      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate text-sm">{state.currentTrack.title}</p>
        <p className="text-white/50 text-xs truncate">{state.currentTrack.artist}</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={isLoading || commandMutation.isPending}
          onClick={() => commandMutation.mutate({ type: 'SEEK', positionSeconds: 0 })}
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        <button
          disabled={isLoading || commandMutation.isPending}
          onClick={() =>
            commandMutation.mutate(
              state.status === 'playing' ? { type: 'PAUSE' } : { type: 'PLAY' },
            )
          }
          className="p-2 rounded-full bg-accent hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.status === 'playing' ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>

        <button
          disabled={isLoading || commandMutation.isPending}
          onClick={() => commandMutation.mutate({ type: 'SKIP' })}
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Volume2 className="w-4 h-4 text-white/40" />
        <input
          type="range"
          min="0"
          max="100"
          value={localVolume}
          disabled={isLoading}
          onChange={(e) => setLocalVolume(parseInt(e.target.value, 10))}
          onPointerUp={(e) =>
            commandMutation.mutate({
              type: 'SET_VOLUME',
              volume: parseInt((e.target as HTMLInputElement).value, 10),
            })
          }
          className="w-24 accent-accent disabled:opacity-30 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
