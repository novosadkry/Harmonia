'use client';

import { usePlaybackStore } from '@/store/playback';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

const sendCommand = (guildId: string, command: object) =>
  apiFetch(`/api/guild/${guildId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });

const takeDJ = (guildId: string) =>
  apiFetch(`/api/guild/${guildId}/dj/take`, { method: 'POST' });

const releaseDJ = (guildId: string) =>
  apiFetch(`/api/guild/${guildId}/dj/release`, { method: 'POST' });

export default function NowPlayingView({ guildId }: { guildId: string }) {
  const { state, currentTrack, djUserId, botError } = usePlaybackStore();
  const [elapsed, setElapsed] = useState(0);
  const [djDisplayName, setDjDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!djUserId) { setDjDisplayName(null); return; }
    apiFetch<{ displayName: string | null }>(`/api/guild/${guildId}/dj`)
      .then((data) => setDjDisplayName(data.displayName))
      .catch(() => {});
  }, [djUserId, guildId]);

  const commandMutation = useMutation({
    mutationFn: (command: object) => sendCommand(guildId, command),
  });

  const djMutation = useMutation({
    mutationFn: (action: 'take' | 'release') =>
      action === 'take' ? takeDJ(guildId) : releaseDJ(guildId),
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

  const duration = currentTrack?.durationSeconds ?? 0;
  const progress = duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center max-w-xl mx-auto py-8">
      {currentTrack?.thumbnailUrl ? (
        <div className="relative mb-8">
          <div
            className="absolute inset-0 rounded-2xl blur-3xl opacity-30 scale-110"
            style={{
              backgroundImage: `url(${currentTrack.thumbnailUrl})`,
              backgroundSize: 'cover',
            }}
          />
          <Image
            src={currentTrack.thumbnailUrl}
            alt={currentTrack.title}
            width={300}
            height={300}
            className="relative rounded-2xl object-cover shadow-2xl"
          />
        </div>
      ) : (
        <div className="w-72 h-72 rounded-2xl bg-surface-2 mb-8 flex items-center justify-center">
          <span className="text-6xl text-white/20">♪</span>
        </div>
      )}

      <div className="w-full text-center mb-6">
        <h2 className="text-2xl font-display font-bold truncate">
          {currentTrack?.title ?? 'Nothing playing'}
        </h2>
        <p className="text-white/50 mt-1">{currentTrack?.artist ?? '—'}</p>
        <p className="text-xs text-yellow-500 mt-1">Playing via YouTube</p>
      </div>

      <div className="w-full mb-4">
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/40 mt-1">
          <span>{formatTime(elapsed)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-6 mb-6">
        <button
          onClick={() => commandMutation.mutate({ type: 'TOGGLE_SHUFFLE' })}
          className={cn(
            'p-2 rounded-full transition-colors',
            state.shuffle ? 'text-accent' : 'text-white/40 hover:text-white',
          )}
        >
          <Shuffle className="w-5 h-5" />
        </button>

        <button
          onClick={() => commandMutation.mutate({ type: 'SEEK', positionSeconds: 0 })}
          className="p-2 rounded-full text-white/60 hover:text-white transition-colors"
        >
          <SkipBack className="w-6 h-6" />
        </button>

        <button
          onClick={() =>
            commandMutation.mutate(
              state.status === 'playing' ? { type: 'PAUSE' } : { type: 'PLAY' },
            )
          }
          className="p-4 rounded-full bg-accent hover:bg-accent-hover transition-colors shadow-lg shadow-accent/30"
        >
          {state.status === 'playing' ? (
            <Pause className="w-7 h-7" />
          ) : (
            <Play className="w-7 h-7" />
          )}
        </button>

        <button
          onClick={() => commandMutation.mutate({ type: 'SKIP' })}
          className="p-2 rounded-full text-white/60 hover:text-white transition-colors"
        >
          <SkipForward className="w-6 h-6" />
        </button>

        <button
          onClick={() => {
            const next =
              state.loop === 'none' ? 'track' : state.loop === 'track' ? 'queue' : 'none';
            commandMutation.mutate({ type: 'SET_LOOP', mode: next });
          }}
          className={cn(
            'p-2 rounded-full transition-colors',
            state.loop !== 'none' ? 'text-accent' : 'text-white/40 hover:text-white',
          )}
        >
          {state.loop === 'track' ? (
            <Repeat1 className="w-5 h-5" />
          ) : (
            <Repeat className="w-5 h-5" />
          )}
        </button>
      </div>

      {state.status === 'playing' && (
        <div className="flex items-end gap-1 h-8 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-accent rounded-full animate-waveform"
              style={{ animationDelay: `${i * 0.12}s`, height: '100%' }}
            />
          ))}
        </div>
      )}

      <div className="w-full bg-surface rounded-xl p-4 mt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/40">DJ Control</p>
            <p className="text-sm font-medium">{djDisplayName ?? 'No DJ active'}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {(djMutation.isError || botError) && (
              <p className="text-xs text-red-400">
                {botError ?? (djMutation.error instanceof Error ? djMutation.error.message : 'Error')}
              </p>
            )}
            <button
              disabled={djMutation.isPending}
              onClick={() => djMutation.mutate(djUserId ? 'release' : 'take')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50',
                djUserId
                  ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  : 'bg-accent/20 text-accent-light hover:bg-accent/30',
              )}
            >
              {djMutation.isPending ? '...' : djUserId ? 'Release DJ' : 'Take DJ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
