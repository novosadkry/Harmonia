'use client';

import { usePlaybackStore } from '@/store/playback';
import { Play, Pause, SkipForward, Volume2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
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
  const { state, queue } = usePlaybackStore();
  const currentTrack = queue[0] ?? null;

  const commandMutation = useMutation({
    mutationFn: (command: object) => sendCommand(guildId, command),
  });

  if (state.status === 'stopped' && !currentTrack) {
    return (
      <div className="h-20 bg-surface border-t border-white/5 flex items-center justify-center">
        <p className="text-sm text-white/30">No track playing</p>
      </div>
    );
  }

  return (
    <div className="h-20 bg-surface border-t border-white/5 flex items-center px-6 gap-6">
      {currentTrack?.thumbnailUrl && (
        <Image
          src={currentTrack.thumbnailUrl}
          alt={currentTrack.title}
          width={48}
          height={48}
          className="rounded-lg object-cover"
        />
      )}

      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate text-sm">{currentTrack?.title ?? '—'}</p>
        <p className="text-white/50 text-xs truncate">{currentTrack?.artist ?? ''}</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            commandMutation.mutate(
              state.status === 'playing' ? { type: 'PAUSE' } : { type: 'PLAY' },
            )
          }
          className="p-2 rounded-full bg-accent hover:bg-accent-hover transition-colors"
        >
          {state.status === 'playing' ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={() => commandMutation.mutate({ type: 'SKIP' })}
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white"
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
          value={state.volume}
          onChange={(e) =>
            commandMutation.mutate({ type: 'SET_VOLUME', volume: parseInt(e.target.value, 10) })
          }
          className="w-24 accent-accent"
        />
      </div>
    </div>
  );
}
